import { Timestamp } from "firebase/firestore";
import { couponAvailability, couponDiscount, normalizeCoupon, type StoreCoupon } from "@/lib/coupons";

export type PublicPromotion = StoreCoupon;
export type PromotionOpportunity =
  | { kind: "available"; coupon: PublicPromotion; discount: number }
  | { kind: "near"; coupon: PublicPromotion; missing: number };

const KEY = "dfl-public-promotions-v2";
const TTL = 10 * 60 * 1000;
let memory: { expiresAt: number; items: PublicPromotion[] } | null = null;
let inflight: Promise<PublicPromotion[]> | null = null;

function hydrate(values: unknown[]): PublicPromotion[] {
  return values
    .map((value) => {
      const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
      return normalizeCoupon(String(raw.code ?? ""), {
        ativo: raw.active === true,
        tipo: raw.type,
        valor: raw.value,
        minOrder: raw.minOrder,
        description: raw.description,
        startsAt: typeof raw.startsAt === "number" ? Timestamp.fromMillis(raw.startsAt) : raw.startsAt,
        expiresAt: typeof raw.expiresAt === "number" ? Timestamp.fromMillis(raw.expiresAt) : raw.expiresAt,
      });
    })
    .filter((coupon) => Boolean(coupon.code));
}

function serialize(items: PublicPromotion[]) {
  return items.map((coupon) => ({
    code: coupon.code,
    active: coupon.active,
    type: coupon.type,
    value: coupon.value,
    minOrder: coupon.minOrder,
    description: coupon.description,
    startsAt: coupon.startsAt?.toMillis() ?? null,
    expiresAt: coupon.expiresAt?.toMillis() ?? null,
  }));
}

export async function getPublicPromotions(): Promise<PublicPromotion[]> {
  const now = Date.now();
  if (memory && memory.expiresAt > now) return memory.items;

  if (typeof window !== "undefined") {
    try {
      const raw = sessionStorage.getItem(KEY);
      const cached = raw ? JSON.parse(raw) as { expiresAt?: number; items?: unknown[] } : null;
      if (cached?.expiresAt && cached.expiresAt > now && Array.isArray(cached.items)) {
        const items = hydrate(cached.items);
        memory = { expiresAt: cached.expiresAt, items };
        return items;
      }
    } catch {}
  }

  if (inflight) return inflight;
  inflight = fetch("/api/public/promotions", { headers: { accept: "application/json" } })
    .then(async (response) => {
      if (!response.ok) throw new Error("PUBLIC_PROMOTIONS_UNAVAILABLE");
      const payload = await response.json() as { items?: unknown[] };
      const items = hydrate(Array.isArray(payload.items) ? payload.items : []);
      const expiresAt = Date.now() + TTL;
      memory = { expiresAt, items };
      if (typeof window !== "undefined") {
        try { sessionStorage.setItem(KEY, JSON.stringify({ expiresAt, items: serialize(items) })); } catch {}
      }
      return items;
    })
    .catch((error) => {
      console.warn("[promotions] API pública indisponível.", error);
      return memory?.items ?? [];
    })
    .finally(() => { inflight = null; });

  return inflight;
}

export function selectPromotionOpportunity(promotions: PublicPromotion[], subtotal: number, now = Date.now()): PromotionOpportunity | null {
  if (subtotal <= 0) return null;
  const current = promotions.filter((coupon) =>
    coupon.active &&
    coupon.value > 0 &&
    (!coupon.startsAt || coupon.startsAt.toMillis() <= now) &&
    (!coupon.expiresAt || coupon.expiresAt.toMillis() >= now)
  );
  const available = current
    .filter((coupon) => couponAvailability(coupon, subtotal, now).ok)
    .map((coupon) => ({ coupon, discount: couponDiscount(coupon, subtotal) }))
    .filter((entry) => entry.discount > 0)
    .sort((a, b) => b.discount - a.discount)[0];
  if (available) return { kind: "available", ...available };

  const near = current
    .filter((coupon) => coupon.minOrder > subtotal)
    .map((coupon) => ({ coupon, missing: coupon.minOrder - subtotal }))
    .sort((a, b) => a.missing - b.missing)[0];
  return near ? { kind: "near", ...near } : null;
}
