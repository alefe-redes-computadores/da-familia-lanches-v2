/** R233-R2: guard against clearly unfinished street fragments.
 * Does not infer a street, alter addresses, or authorize delivery coverage.
 * This is intentionally narrow: city streets can legitimately have short names.
 */
export function streetNeedsClarification(value: unknown): boolean {
  const raw = String(value ?? "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim()
    .replace(/\s+/g, " ");
  const withoutType = raw.replace(/^(?:rua|r\.?|avenida|av\.?|travessa|tv\.?)\s+/, "");
  // A cliente digitou ou recebeu "Deze". Prefixos de "Dezesseis"
  // (e possivelmente outros nomes) nao podem ser tratados como completos.
  return /^deze(?:s(?:s(?:e(?:i)?)?)?)?$/.test(withoutType);
}
