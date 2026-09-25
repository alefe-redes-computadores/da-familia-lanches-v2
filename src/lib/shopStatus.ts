import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  DEFAULT_STORE_SETTINGS,
  canPlaceImmediateTestOrder,
  evaluateStoreStatus,
  normalizeStoreSettings,
  type StoreSettings,
} from "@/lib/storeSchedule";

export type ShopStatus = {
  isOpen: boolean;
  message: string;
  nextOpenLabel?: string;
  mode?: string;
  source?: string;
};

type StoreSnapshot = {
  at: number;
  settings: StoreSettings;
};

const CACHE_TTL = 20_000;
let cache: StoreSnapshot | null = null;
let inflight: Promise<StoreSnapshot> | null = null;

export const getScheduleShopStatus = (): ShopStatus =>
  evaluateStoreStatus(DEFAULT_STORE_SETTINGS);

export function statusFromSetting(raw: unknown): ShopStatus | null {
  if (raw == null) return null;
  return evaluateStoreStatus(
    normalizeStoreSettings(typeof raw === "boolean" ? { isOpen: raw } : raw),
  );
}

async function readStoreSettings(forceFresh = false): Promise<StoreSnapshot> {
  if (!forceFresh && cache && Date.now() - cache.at < CACHE_TTL) return cache;
  if (!forceFresh && inflight) return inflight;

  const request = getDoc(doc(db, "settings", "loja"))
    .then((snapshot) => {
      const settings = snapshot.exists()
        ? normalizeStoreSettings(snapshot.data())
        : DEFAULT_STORE_SETTINGS;
      const next = { at: Date.now(), settings };
      cache = next;
      return next;
    })
    .catch((error) => {
      console.warn("Status remoto indisponível", error);
      const next = { at: Date.now(), settings: DEFAULT_STORE_SETTINGS };
      if (!forceFresh) cache = next;
      return next;
    })
    .finally(() => {
      if (inflight === request) inflight = null;
    });

  if (!forceFresh) inflight = request;
  return request;
}

export async function getEffectiveShopStatus(): Promise<ShopStatus> {
  const { settings } = await readStoreSettings(false);
  return evaluateStoreStatus(settings);
}

/**
 * Checkout precisa de status + permissão de teste.
 * Antes eram duas leituras independentes do mesmo settings/loja.
 * Agora ambos são derivados do MESMO snapshot.
 *
 * forceFresh=true é usado imediatamente antes de registrar o pedido.
 */
export async function getCheckoutStoreAccess(
  email: string | null | undefined,
  forceFresh = false,
) {
  const { settings } = await readStoreSettings(forceFresh);
  return {
    status: evaluateStoreStatus(settings),
    testAccess: canPlaceImmediateTestOrder(settings, email),
  };
}

export function invalidateShopStatusCache() {
  cache = null;
}
