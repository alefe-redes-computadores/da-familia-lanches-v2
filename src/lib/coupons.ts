import { Timestamp } from "firebase/firestore";

export type CouponDiscountType = "fixed" | "percent";

export type StoreCoupon = {
  code: string;
  active: boolean;
  type: CouponDiscountType;
  value: number;
  minOrder: number;
  startsAt: Timestamp | null;
  expiresAt: Timestamp | null;
  description: string;
};

const clean = (value: unknown) => String(value ?? "").trim();
const finite = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const timestampOrNull = (value: unknown) => value instanceof Timestamp ? value : null;

export function normalizeCoupon(code: string, data: unknown): StoreCoupon {
  const raw = data && typeof data === "object" ? data as Record<string, unknown> : {};
  return {
    code: code.trim().toUpperCase(),
    active: raw.ativo === true || raw.active === true,
    type: raw.tipo === "percent" || raw.tipo === "porcentagem" || raw.type === "percent" ? "percent" : "fixed",
    value: Math.max(0, finite(raw.valor ?? raw.percent ?? 0, 0)),
    minOrder: Math.max(0, finite(raw.minOrder ?? raw.pedidoMinimo, 0)),
    startsAt: timestampOrNull(raw.startsAt ?? raw.inicio),
    expiresAt: timestampOrNull(raw.expiresAt ?? raw.validade),
    description: clean(raw.description ?? raw.descricao),
  };
}

export function couponAvailability(coupon: StoreCoupon, subtotal: number, now = Date.now()) {
  if (!coupon.active) return { ok: false as const, reason: "inactive" as const };
  if (coupon.value <= 0) return { ok: false as const, reason: "invalid" as const };
  if (coupon.startsAt && coupon.startsAt.toMillis() > now) return { ok: false as const, reason: "not-started" as const };
  if (coupon.expiresAt && coupon.expiresAt.toMillis() < now) return { ok: false as const, reason: "expired" as const };
  if (subtotal < coupon.minOrder) return { ok: false as const, reason: "min-order" as const };
  return { ok: true as const };
}

export function couponDiscount(coupon: StoreCoupon, subtotal: number) {
  const raw = coupon.type === "percent" ? subtotal * coupon.value / 100 : coupon.value;
  return Math.min(subtotal, Math.max(0, raw));
}
