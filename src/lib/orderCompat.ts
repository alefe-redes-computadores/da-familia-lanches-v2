import type { Addon } from "@/data/addons";

export type CompatOrderItem = {
  id?: string;
  name: string;
  quantity: number;
  price: number;
  selectedAddons: Addon[];
  observation: string;
};

export function orderDateToDate(value: unknown): Date | null {
  if (!value) return null;

  try {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

    if (typeof value === "object" && value !== null) {
      const v = value as { toDate?: () => Date; seconds?: number; _seconds?: number };
      if (typeof v.toDate === "function") {
        const date = v.toDate();
        return Number.isNaN(date.getTime()) ? null : date;
      }
      const seconds = Number(v.seconds ?? v._seconds);
      if (Number.isFinite(seconds)) return new Date(seconds * 1000);
    }

    if (typeof value === "string" || typeof value === "number") {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    }
  } catch {
    return null;
  }

  return null;
}

export function orderDateToMillis(value: unknown): number {
  return orderDateToDate(value)?.getTime() ?? 0;
}

function positiveQuantity(value: unknown): number {
  const quantity = Math.floor(Number(value));
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

function finiteMoney(value: unknown): number {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}

function normalizeAddons(value: unknown): Addon[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((addon, index) => {
      if (typeof addon === "string") {
        return { id: `legacy-${index}`, name: addon, price: 0 } satisfies Addon;
      }
      if (!addon || typeof addon !== "object") return null;
      const raw = addon as Record<string, unknown>;
      const name = String(raw.name ?? raw.nome ?? "").trim();
      if (!name) return null;
      return {
        id: String(raw.id ?? `legacy-${index}`),
        name,
        price: finiteMoney(raw.price ?? raw.preco),
      } satisfies Addon;
    })
    .filter((addon): addon is Addon => Boolean(addon));
}

export function getOrderItems(order: unknown): CompatOrderItem[] {
  if (!order || typeof order !== "object") return [];
  const rawOrder = order as Record<string, unknown>;
  const source = Array.isArray(rawOrder.itens)
    ? rawOrder.itens
    : Array.isArray(rawOrder.itensObj)
      ? rawOrder.itensObj
      : [];

  const items: CompatOrderItem[] = [];

  for (const item of source) {
    if (!item || typeof item !== "object") continue;
    const raw = item as Record<string, unknown>;
    const name = String(raw.name ?? raw.nome ?? "").trim();
    if (!name) continue;

    const normalized: CompatOrderItem = {
      name,
      quantity: positiveQuantity(raw.quantity ?? raw.qtd),
      price: finiteMoney(raw.price ?? raw.preco),
      selectedAddons: normalizeAddons(raw.selectedAddons ?? raw.adicionais),
      observation: String(raw.observation ?? raw.observacao ?? "").trim(),
    };

    if (raw.id != null && String(raw.id).trim()) {
      normalized.id = String(raw.id);
    }

    items.push(normalized);
  }

  return items;
}

export function normalizePaymentMethod(value: unknown): "dinheiro" | "cartao" | "pix" | "outro" {
  const method = String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  if (method.includes("pix")) return "pix";
  if (method.includes("cash") || method.includes("dinheiro")) return "dinheiro";
  if (method.includes("card") || method.includes("cartao") || method.includes("credito") || method.includes("debito")) return "cartao";
  return "outro";
}

export function paymentLabel(value: unknown): string {
  const method = normalizePaymentMethod(value);
  if (method === "pix") return "PIX";
  if (method === "dinheiro") return "DINHEIRO";
  if (method === "cartao") return "CARTÃO";
  return String(value ?? "NÃO INFORMADO").trim() || "NÃO INFORMADO";
}

export function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
