import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";

export const CATALOG_CATEGORIES_COLLECTION = "CatalogoCategorias";

export type CatalogCategory = {
  id: string;
  label: string;
  active: boolean;
  sortOrder: number;
};

export const FALLBACK_CATEGORIES: CatalogCategory[] = [
  { id: "promocoes", label: "Promoções", active: true, sortOrder: 0 },
  { id: "combos", label: "Combos", active: true, sortOrder: 10 },
  { id: "tradicionais", label: "Tradicionais", active: true, sortOrder: 20 },
  { id: "artesanais", label: "Artesanais", active: true, sortOrder: 30 },
  { id: "hotdogs", label: "Hot Dogs", active: true, sortOrder: 40 },
  { id: "bebidas", label: "Bebidas", active: true, sortOrder: 50 },
];

function text(value: unknown) { return String(value ?? "").trim(); }

export function canonicalCategoryId(value: unknown) {
  return text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeRemoteCategory(snapshot: QueryDocumentSnapshot<DocumentData>): CatalogCategory | null {
  const raw = snapshot.data();
  const id = canonicalCategoryId(raw.id || snapshot.id);
  const label = text(raw.label ?? raw.nome);
  const rawOrder = raw.sortOrder ?? raw.ordem;
  const parsedOrder = rawOrder === null || rawOrder === undefined || rawOrder === "" ? undefined : Number(rawOrder);
  if (!id || !label) return null;
  return {
    id,
    label,
    active: typeof raw.active === "boolean" ? raw.active : typeof raw.ativa === "boolean" ? raw.ativa : true,
    sortOrder: Number.isFinite(parsedOrder) ? parsedOrder! : 999,
  };
}

export function mergeCategories(remote: CatalogCategory[]): CatalogCategory[] {
  if (!remote.length) return [...FALLBACK_CATEGORIES];
  const byId = new Map(FALLBACK_CATEGORIES.map((category) => [category.id, category]));
  for (const category of remote) {
    const id = canonicalCategoryId(category.id || category.label);
    if (!id) continue;
    const fallback = byId.get(id);
    byId.set(id, fallback ? { ...fallback, ...category, id } : { ...category, id });
  }
  return Array.from(byId.values()).sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "pt-BR"));
}
