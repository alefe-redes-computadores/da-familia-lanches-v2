"use client";

export type PublicCatalogApiRecord = {
  id?: unknown;
  data?: unknown;
};

export type PublicCatalogPayload = {
  products?: PublicCatalogApiRecord[];
  addons?: PublicCatalogApiRecord[];
  categories?: PublicCatalogApiRecord[];
  generatedAt?: string | null;
  degraded?: boolean;
};

type State = {
  payload: PublicCatalogPayload | null;
  ready: boolean;
  error: string;
};

let state: State = {
  payload: null,
  ready: false,
  error: "",
};

let inflight: Promise<State> | null = null;
const listeners = new Set<(value: State) => void>();

const emit = () => listeners.forEach((listener) => listener(state));

async function load(force = false): Promise<State> {
  if (state.ready && !force) return state;
  if (inflight) return inflight;

  inflight = fetch("/api/public/catalog", {
    headers: { Accept: "application/json" },
    cache: force ? "no-store" : "default",
  })
    .then(async (response) => {
      if (!response.ok) throw new Error(`catalog_http_${response.status}`);
      return response.json() as Promise<PublicCatalogPayload>;
    })
    .then((payload) => {
      state = { payload, ready: true, error: "" };
      emit();
      return state;
    })
    .catch((error) => {
      console.warn("[catalog] API pública indisponível; fallback local.", error);
      state = {
        payload: null,
        ready: true,
        error: "Não foi possível atualizar o cardápio agora.",
      };
      emit();
      return state;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export function subscribePublicCatalog(listener: (value: State) => void) {
  listeners.add(listener);
  listener(state);
  void load();
  return () => {
    listeners.delete(listener);
  };
}

export function readPublicCatalog() {
  return state;
}

export function patchPublicCatalogProduct(id: string, data: Record<string, unknown>) {
  const payload = state.payload;
  if (!payload) return false;
  const current = Array.isArray(payload.products) ? payload.products : [];
  const index = current.findIndex((item) => String(item?.id ?? "") === id);
  const previous = index >= 0 && current[index]?.data && typeof current[index].data === "object"
    ? current[index].data as Record<string, unknown> : {};
  const record = { id, data: { ...previous, ...data, id } };
  const products = [...current];
  if (index >= 0) products[index] = record; else products.push(record);
  state = { ...state, payload: { ...payload, products }, ready: true, error: "" };
  emit();
  return true;
}

export function reloadPublicCatalog() {
  state = { ...state, ready: false, error: "" };
  emit();
  return load(true);
}
