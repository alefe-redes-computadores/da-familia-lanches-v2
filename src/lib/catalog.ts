import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";
import { products as fallbackProducts, type Product, type ProductCategory } from "@/data/products";
import { ADDONS as fallbackAddons, type Addon } from "@/data/addons";

export const CATALOG_PRODUCTS_COLLECTION = "CatalogoProdutos";
export const CATALOG_ADDONS_COLLECTION = "CatalogoAdicionais";

export type CatalogSource = "fallback" | "hybrid";

const categories = new Set<ProductCategory>([
  "promocoes",
  "combos",
  "tradicionais",
  "artesanais",
  "hotdogs",
  "bebidas",
]);

function finiteMoney(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function finiteOrder(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function booleanOrUndefined(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return Array.from(new Set(value.map((item) => text(item)).filter(Boolean)));
}

export function normalizeRemoteProduct(snapshot: QueryDocumentSnapshot<DocumentData>): Product | null {
  const raw = snapshot.data();
  const id = text(raw.id) || snapshot.id;
  const name = text(raw.name ?? raw.nome);
  const description = text(raw.description ?? raw.descricao);
  const image = text(raw.image ?? raw.imagem);
  const category = text(raw.category ?? raw.categoria) as ProductCategory;
  const price = finiteMoney(raw.price ?? raw.preco);

  if (!id || !name || !description || !image || !categories.has(category) || price === null) {
    console.warn("[catalog] Produto remoto ignorado por dados invalidos:", snapshot.id);
    return null;
  }

  const oldPrice = finiteMoney(raw.oldPrice ?? raw.precoAnterior);
  const suggestion = booleanOrUndefined(raw.isSuggestion ?? raw.sugestao);
  const sortOrder = finiteOrder(raw.sortOrder ?? raw.ordem);
  const addonIds = stringArray(raw.addonIds ?? raw.adicionaisIds);

  return {
    id,
    name,
    description,
    price,
    ...(oldPrice !== null ? { oldPrice } : {}),
    image,
    category,
    disponivel: booleanOrUndefined(raw.disponivel ?? raw.available) ?? true,
    ...(suggestion !== undefined ? { isSuggestion: suggestion } : {}),
    ...(sortOrder !== undefined ? { sortOrder } : {}),
    ...(addonIds !== undefined ? { addonIds } : {}),
  };
}

export function normalizeRemoteAddon(snapshot: QueryDocumentSnapshot<DocumentData>): Addon | null {
  const raw = snapshot.data();
  const id = text(raw.id) || snapshot.id;
  const name = text(raw.name ?? raw.nome);
  const price = finiteMoney(raw.price ?? raw.preco);

  if (!id || !name || price === null) {
    console.warn("[catalog] Adicional remoto ignorado por dados invalidos:", snapshot.id);
    return null;
  }

  const sortOrder = finiteOrder(raw.sortOrder ?? raw.ordem);

  return {
    id,
    name,
    price,
    disponivel: booleanOrUndefined(raw.disponivel ?? raw.available) ?? true,
    ...(sortOrder !== undefined ? { sortOrder } : {}),
  };
}

export function mergeProducts(remote: Product[]): Product[] {
  if (!remote.length) return fallbackProducts;

  const byId = new Map(fallbackProducts.map((product) => [product.id, product]));
  for (const product of remote) {
    const fallback = byId.get(product.id);
    byId.set(product.id, fallback ? { ...fallback, ...product } : product);
  }
  return Array.from(byId.values());
}

export function mergeAddons(remote: Addon[]): Addon[] {
  if (!remote.length) return fallbackAddons;

  const byId = new Map(fallbackAddons.map((addon) => [addon.id, addon]));
  for (const addon of remote) {
    const fallback = byId.get(addon.id);
    byId.set(addon.id, fallback ? { ...fallback, ...addon } : addon);
  }

  return Array.from(byId.values())
    .filter((addon) => addon.disponivel !== false)
    .sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER));
}

export function availableAddonsForProduct(product: Product, addons: Addon[]): Addon[] {
  if (product.category === "bebidas") return [];
  if (product.addonIds === undefined) return addons.filter((addon) => addon.disponivel !== false);

  const allowed = new Set(product.addonIds);
  return addons.filter((addon) => addon.disponivel !== false && allowed.has(addon.id));
}

export function compareCatalogProducts(a: Product, b: Product): number {
  if (a.disponivel !== b.disponivel) return a.disponivel ? -1 : 1;
  if (Boolean(a.isSuggestion) !== Boolean(b.isSuggestion)) return a.isSuggestion ? -1 : 1;

  if (a.sortOrder !== undefined || b.sortOrder !== undefined) {
    return (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER);
  }

  return a.price - b.price;
}
