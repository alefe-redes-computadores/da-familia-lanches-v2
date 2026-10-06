export type CheckoutDraft = {
  version: 2;
  updatedAt: number;
  step: 1 | 2;
  deliveryMode: "delivery" | "pickup";
  customerName: string;
  userPhone: string;
  cep: string;
  rua: string;
  bairro: string;
  numero: string;
  complemento: string;
  referencia: string;
  method: "pix" | "cartao" | "dinheiro";
  troco: string;
  orderObservation: string;
  couponCode: string;
  scheduledFor: string;
};

const PREFIX = "dfl:checkout-draft:";
const MAX_AGE = 72 * 60 * 60 * 1000;

function storageKey(uid?: string | null) {
  return `${PREFIX}${uid || "guest"}`;
}

export function saveCheckoutDraft(
  uid: string | null | undefined,
  draft: Omit<CheckoutDraft, "version" | "updatedAt">,
) {
  if (typeof window === "undefined") return;

  try {
    const payload: CheckoutDraft = {
      ...draft,
      version: 2,
      updatedAt: Date.now(),
    };

    window.localStorage.setItem(
      storageKey(uid),
      JSON.stringify(payload),
    );
  } catch {
    // Checkout continua funcionando mesmo se storage estiver indisponível.
  }
}

export function readCheckoutDraft(
  uid?: string | null,
): CheckoutDraft | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(storageKey(uid));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<CheckoutDraft>;

    if (
      parsed.version !== 2 ||
      typeof parsed.updatedAt !== "number" ||
      Date.now() - parsed.updatedAt > MAX_AGE
    ) {
      window.localStorage.removeItem(storageKey(uid));
      return null;
    }

    if (
      parsed.deliveryMode !== "delivery" &&
      parsed.deliveryMode !== "pickup"
    ) return null;

    if (
      parsed.method !== "pix" &&
      parsed.method !== "cartao" &&
      parsed.method !== "dinheiro"
    ) return null;

    return parsed as CheckoutDraft;
  } catch {
    return null;
  }
}

export function clearCheckoutDraft(uid?: string | null) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(storageKey(uid));
  } catch {}
}

export function migrateGuestCheckoutDraft(uid: string) {
  if (typeof window === "undefined" || !uid) return;

  try {
    const guestKey = storageKey(null);
    const userKey = storageKey(uid);

    const guest = window.localStorage.getItem(guestKey);
    const current = window.localStorage.getItem(userKey);

    if (!current && guest) {
      window.localStorage.setItem(userKey, guest);
    }

    if (guest) {
      window.localStorage.removeItem(guestKey);
    }
  } catch {}
}

export function checkoutDraftAgeMinutes(draft: { updatedAt?: number } | null | undefined): number | null {
  const updatedAt = Number(draft?.updatedAt);
  if (!Number.isFinite(updatedAt) || updatedAt <= 0) return null;
  return Math.max(0, Math.floor((Date.now() - updatedAt) / 60000));
}
