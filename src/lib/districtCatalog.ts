/** R38: indice local de bairros. NUNCA define area atendida nem preco de entrega. */
import { KNOWN_PATOS_DISTRICTS, normalizeDistrict, suggestDistricts } from "@/lib/addressIntelligence";

export type DistrictCatalogSource = "configured" | "reference";
export type DistrictCatalog = {
  source: DistrictCatalogSource;
  results: string[];
  total: number;
  limit: number;
};

const clampLimit = (limit: number) => Number.isFinite(limit) ? Math.max(1, Math.min(80, Math.floor(limit))) : 8;
const uniqueNames = (names: readonly string[]): string[] => {
  const seen = new Set<string>();
  return names.map(item => typeof item === "string" ? item.trim() : "")
    .filter(item => {
      const key = normalizeDistrict(item);
      if (!key || seen.has(key) || item.length > 100) return false;
      seen.add(key);
      return true;
    });
};

/** Consulta APENAS a tabela que o checkout ja leu; usa lista publica como referencia se ela faltar.
 * Um bairro de referencia pode nao estar na area atendida ou na tabela de taxas.
 */
export function searchDistrictCatalog(
  query: string,
  configured: readonly string[],
  requestedLimit = 8,
): DistrictCatalog {
  const configuredNames = uniqueNames(configured);
  const source: DistrictCatalogSource = configuredNames.length ? "configured" : "reference";
  const all = configuredNames.length ? configuredNames : uniqueNames(KNOWN_PATOS_DISTRICTS);
  const limit = clampLimit(requestedLimit);
  const q = normalizeDistrict(query).slice(0, 90);
  const ordered = [...all].sort((a, b) => a.localeCompare(b, "pt-BR"));
  if (!q) return { source, results: ordered.slice(0, limit), total: ordered.length, limit };
  const prefixes: string[] = [];
  const contains: string[] = [];
  for (const name of ordered) {
    const key = normalizeDistrict(name);
    if (key.startsWith(q)) prefixes.push(name);
    else if (q.length >= 3 && (key.includes(q) || key.split(" ").some(word => word.startsWith(q)))) contains.push(name);
  }
  const direct = new Set([...prefixes, ...contains].map(name => normalizeDistrict(name)));
  const permitted = new Set(all.map(name => normalizeDistrict(name)));
  const typo = q.length >= 4
    ? suggestDistricts(q, all, 8).filter(name => permitted.has(normalizeDistrict(name)) && !direct.has(normalizeDistrict(name)))
    : [];
  const results = [...prefixes, ...contains, ...typo];
  // R233: the shop's rate table can omit a familiar local name.
  // A reference result helps identify the FULL name but NEVER proves service coverage or price.
  // This fallback only runs when the configured list had ZERO matches.
  if (configuredNames.length > 0 && results.length === 0 && q.length >= 3) {
    const reference = searchDistrictCatalog(query, [], requestedLimit);
    if (reference.total > 0) return reference;
  }
  return { source, results: results.slice(0, limit), total: results.length, limit };
}
// DFL-R38-DISTRICT-CATALOG

/** R234: optional combined local discovery used only for suggestions.
 * Original searchDistrictCatalog remains unchanged for legacy callers and pricing.
 * Each match carries provenance: reference names NEVER assert store coverage.
 */
export type DistrictSearchMatch = { name: string; source: DistrictCatalogSource };
export type DistrictCompleteCatalog = DistrictCatalog & { matches: DistrictSearchMatch[] };

export function searchDistrictCatalogComplete(
  query: string,
  configured: readonly string[],
  requestedLimit = 8,
): DistrictCompleteCatalog {
  const limit = clampLimit(requestedLimit);
  const configuredNames = uniqueNames(configured);
  const configuredKeys = new Set(configuredNames.map(normalizeDistrict));
  // Existing matcher limits results to known, configured or reference names.
  const original = searchDistrictCatalog(query, configuredNames, 80);
  const fromTable = configuredNames.length && original.source === "configured"
    ? original.results : [];
  const q = normalizeDistrict(query).slice(0, 90);
  // Empty input shows only the store's table. A customer must type at least
  // 3 characters before we add reference names from the public city index.
  const fromReference = q.length >= 3 || !configuredNames.length
    ? searchDistrictCatalog(query, [], 80).results
    : [];
  const matches: DistrictSearchMatch[] = [];
  const seen = new Set<string>();
  for (const name of fromTable) {
    const key = normalizeDistrict(name);
    if (seen.has(key)) continue;
    seen.add(key);
    matches.push({ name, source: "configured" });
  }
  for (const name of fromReference) {
    const key = normalizeDistrict(name);
    // Reference cannot upgrade a missing table rate to a confirmed coverage.
    // Entries already in the table must use the table's canonical spelling.
    if (seen.has(key) || configuredKeys.has(key)) continue;
    seen.add(key);
    matches.push({ name, source: "reference" });
  }
  const shown = matches.slice(0, limit);
  return {
    source: shown[0]?.source ?? original.source,
    results: shown.map(item => item.name),
    matches: shown,
    total: matches.length,
    limit,
  };
}
// DFL-R234-COMPOUND-DISTRICTS
