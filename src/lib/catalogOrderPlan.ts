/** V86 R2 R2: pure, deterministic catalog ordering; never changes product availability. */
export type CatalogSortMode = "price-asc" | "price-desc" | "alpha";
export type SortableCatalogItem = { id: string; name: string; price: number };

export function moveCatalogItem(ids: string[], id: string, direction: -1 | 1): string[] {
  const from = ids.indexOf(id), to = from + direction;
  if (from < 0 || to < 0 || to >= ids.length) return [...ids];
  const next = [...ids];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

export function sortCatalogIds<T extends SortableCatalogItem>(items: T[], mode: CatalogSortMode): string[] {
  const sorted = [...items];
  if (mode === "price-asc") sorted.sort((a,b)=>a.price-b.price || a.name.localeCompare(b.name,"pt-BR"));
  else if (mode === "price-desc") sorted.sort((a,b)=>b.price-a.price || a.name.localeCompare(b.name,"pt-BR"));
  else sorted.sort((a,b)=>a.name.localeCompare(b.name,"pt-BR"));
  return sorted.map(item => item.id);
}

export function buildCatalogSortPlan(activeIds: string[], pausedIds: string[]): Array<{id: string; sortOrder: number}> {
  const all=[...activeIds,...pausedIds];
  if (new Set(all).size !== all.length || all.some(id => !id || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(id))) {
    throw new Error("ORDER_INVALID");
  }
  if (all.length > 200) throw new Error("ORDER_TOO_LARGE");
  return all.map((id,index)=>({id,sortOrder:(index+1)*10}));
}
