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
const MAX_CLOCK_SKEW = 60_000;
const MAX_DRAFT_BYTES = 16_384;
const DRAFT_FIELDS = ["customerName", "userPhone", "cep", "rua", "bairro", "numero", "complemento", "referencia", "troco", "orderObservation", "couponCode", "scheduledFor"] as const;

/** Dados locais são não-confiáveis: PWA antigo, armazenamento truncado ou relógio alterado. */
function isValidDraft(value: unknown): value is CheckoutDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const draft = value as Partial<CheckoutDraft>;
  const timestamp = Number(draft.updatedAt);
  if (draft.version !== 2 || typeof draft.updatedAt !== "number" || !Number.isFinite(timestamp) || timestamp <= 0 ||
      timestamp > Date.now() + MAX_CLOCK_SKEW || Date.now() - timestamp > MAX_AGE) return false;
  if (draft.step !== 1 && draft.step !== 2) return false;
  if (draft.deliveryMode !== "delivery" && draft.deliveryMode !== "pickup") return false;
  if (draft.method !== "pix" && draft.method !== "cartao" && draft.method !== "dinheiro") return false;
  return DRAFT_FIELDS.every((key) => typeof draft[key] === "string" && (draft[key] as string).length <= 1024);
}


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
    const key = storageKey(uid);
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    if (raw.length > MAX_DRAFT_BYTES) {
      window.localStorage.removeItem(key);
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isValidDraft(parsed)) {
      window.localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    // Dados incompletos não podem bloquear o checkout. Próxima abertura começa limpa.
    try { window.localStorage.removeItem(storageKey(uid)); } catch {}
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

    // Migrar somente rascunhos válidos, sem sobrepor pedido do usuário logado.
    const guest = readCheckoutDraft(null);
    const current = readCheckoutDraft(uid);
    if (!current && guest) window.localStorage.setItem(userKey, JSON.stringify(guest));
    window.localStorage.removeItem(guestKey);
  } catch {}
}

export function checkoutDraftAgeMinutes(draft: { updatedAt?: number } | null | undefined): number | null {
  const updatedAt = Number(draft?.updatedAt);
  if (!Number.isFinite(updatedAt) || updatedAt <= 0) return null;
  return Math.max(0, Math.floor((Date.now() - updatedAt) / 60000));
}
