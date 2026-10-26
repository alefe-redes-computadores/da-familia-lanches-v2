/** Somente recupera um bairro salvo se rua, numero e CEP identificam o MESMO endereco.
 *  Nunca infere bairros nem sobrescreve um bairro digitado pelo cliente. */
export type AddressDraftSnapshot = {
  street?: string | null;
  number?: string | null;
  cep?: string | null;
  district?: string | null;
};
const folded = (value: string | null | undefined) => String(value ?? "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
const zip = (value: string | null | undefined) => String(value ?? "").replace(/\D/g, "");
export function recoverSavedDistrictForExactAddress(
  current: AddressDraftSnapshot, saved: AddressDraftSnapshot,
): string | null {
  if (String(current.district ?? "").trim()) return null;
  const district = String(saved.district ?? "").trim();
  if (folded(district).length < 3) return null;
  if (!folded(current.street) || folded(current.street) !== folded(saved.street)) return null;
  if (!folded(current.number) || folded(current.number) !== folded(saved.number)) return null;
  const a = zip(current.cep), b = zip(saved.cep);
  if (a.length !== 8 || b.length !== 8 || a !== b) return null;
  return district;
}
