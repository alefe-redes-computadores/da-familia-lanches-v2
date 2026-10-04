export function parseAdminMoney(value: string | number | null | undefined, fallback = 0) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const parsed = Number(normalized.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function adminMoneyTyping(value: string, maxDigits = 10) {
  const digits = String(value ?? "").replace(/\D/g, "").slice(0, maxDigits);
  if (!digits) return "";
  return (Number(digits) / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function adminMoneyText(value: string | number | null | undefined) {
  return parseAdminMoney(value, 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function adminMoneyBRL(value: string | number | null | undefined) {
  return parseAdminMoney(value, 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function adminPercentText(value: string) {
  return String(value ?? "")
    .replace(/[^\d,.]/g, "")
    .slice(0, 6);
}
