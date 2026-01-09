export function money(value: number): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "R$ 0,00";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(n);
}