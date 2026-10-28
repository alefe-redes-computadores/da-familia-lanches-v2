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
  return { source, results: results.slice(0, limit), total: results.length, limit };
}
// DFL-R38-DISTRICT-CATALOG
