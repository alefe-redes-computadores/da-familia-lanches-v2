// DFL-R100-FINAL-POLISH: auditoria de taxa aceita centavos pt-BR sem modificar precos.
/** Valida o formato numérico informado no painel; não calcula nem publica fretes. */
export function parseDeliveryFeeForAudit(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) && input >= 0 ? input : null;
  if (typeof input !== "string") return null;
  const raw = input.trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (!raw || !(/^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?$/.test(raw) || /^\d+(?:\.\d{1,2})?$/.test(raw))) return null;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const fee = Number(normalized);
  return Number.isFinite(fee) && fee >= 0 ? fee : null;
}
