/** DFL R39: conferência indicativa do endereço. Nunca determina cobertura, taxa ou autorização do pedido. */
export type PreviewInput = { district: string; street: string; number: string };
export type PreviewState = "confirmed" | "review" | "not_found";
export type PreviewResult = { state: PreviewState; message: string; point: { lat: number; lon: number } | null };
export const addressText = (v: unknown) => String(v ?? "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR")
  .replace(/\b(rua|avenida|av|bairro|residencial)\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
export function readPreviewInput(input: unknown): PreviewInput | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const obj = input as Record<string, unknown>;
  const clean = (key: string, max: number) => typeof obj[key] === "string" && (obj[key] as string).trim().length <= max &&
    !/[<>\x00-\x1f]/.test(obj[key] as string) ? (obj[key] as string).trim() : "";
  const value = { district: clean("district", 85), street: clean("street", 110), number: clean("number", 18) };
  if (addressText(value.district).length < 3 || addressText(value.street).length < 4 || !value.number ||
    !/^[\p{L}\p{N} .\/\-ºª#]+$/u.test(value.number) || value.number.length > 18) return null;
  return value;
}
const sameNumber = (a: string, b: string) => a.replace(/\D/g, "") !== "" && a.replace(/\D/g, "") === b.replace(/\D/g, "");
export function inspectGeoapifyAddress(input: PreviewInput, raw: unknown): PreviewResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {state:"not_found",message:"Não encontramos confirmação para esse endereço. Continue manualmente.",point:null};
  const records = "results" in raw && Array.isArray(raw.results) ? raw.results : [];
  let partial: PreviewResult | null = null;
  for (const entry of records.slice(0, 5)) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const city = addressText(row.city || row.municipality);
    const state = addressText(row.state);
    const country = String(row.country_code ?? "").toLowerCase();
    if (city !== "patos de minas" || country !== "br" || !(state === "minas gerais" || String(row.state_code ?? "").toLowerCase() === "mg")) continue;
    const street = addressText(row.street);
    const expected = addressText(input.street);
    const streetMatch = Boolean(street && expected && (street === expected || (street.length >= 8 && expected.length >= 8 && (street.includes(expected) || expected.includes(street)))));
    const numberMatch = sameNumber(input.number, String(row.housenumber ?? ""));
    const rank = row.rank && typeof row.rank === "object" ? row.rank as Record<string, unknown> : null;
    const confidence = typeof rank?.confidence === "number" ? rank.confidence : null;
    const lat = Number(row.lat), lon = Number(row.lon);
    const point = Number.isFinite(lat) && Number.isFinite(lon) && lat >= -23 && lat <= -14 && lon >= -51 && lon <= -42 ? {lat,lon} : null;
    if (streetMatch && numberMatch && point && (confidence === null || confidence >= .65)) {
      return {state:"confirmed",message:"Rua e número encontrados no mapa. Confira o bairro e o número antes de continuar; o frete continua na tabela da loja.",point};
    }
    if (!partial) partial = {state:"review",message:"Encontramos uma localização próxima, mas não confirmamos todos os dados. Revise o endereço ou peça ajuda à loja.",point:null};
  }
  return partial ?? {state:"not_found",message:"Não encontramos confirmação para esse endereço. Confira a escrita ou informe manualmente.",point:null};
}
export function readRouteDistanceKm(raw: unknown): number | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || !('results' in raw) || !Array.isArray(raw.results)) return null;
  const first = raw.results[0];
  if (!first || typeof first !== 'object') return null;
  const value = Number((first as Record<string,unknown>).distance);
  return Number.isFinite(value) && value > 0 && value <= 150000 ? Math.round(value / 100) / 10 : null;
}
