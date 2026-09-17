import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type CommercialSettings = {
  freeDeliveryEnabled: boolean;
  globalMinimum: number;
  neighborhoodMinimum: number;
  freeNeighborhoods: string[];
};
export const DEFAULT_COMMERCIAL_SETTINGS: CommercialSettings = {
  freeDeliveryEnabled: true,
  globalMinimum: 80,
  neighborhoodMinimum: 0,
  freeNeighborhoods: [],
};
export const normalizeCommercialText = (value: unknown) =>
  String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const safeMoney = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};
export function normalizeCommercialSettings(data?: Record<string, unknown>): CommercialSettings {
  if (!data) return DEFAULT_COMMERCIAL_SETTINGS;
  return {
    freeDeliveryEnabled: data.freeDeliveryEnabled !== false,
    globalMinimum: safeMoney(data.globalMinimum, 80),
    neighborhoodMinimum: safeMoney(data.neighborhoodMinimum, 0),
    freeNeighborhoods: Array.isArray(data.freeNeighborhoods)
      ? data.freeNeighborhoods.map(String).map((v) => v.trim()).filter(Boolean).slice(0, 100)
      : [],
  };
}
export async function getCommercialSettings() {
  const snap = await getDoc(doc(db, "settings", "commercial"));
  return snap.exists() ? normalizeCommercialSettings(snap.data()) : DEFAULT_COMMERCIAL_SETTINGS;
}
export function freeDeliveryThreshold(settings: CommercialSettings, district: string) {
  if (!settings.freeDeliveryEnabled) return null;
  const key = normalizeCommercialText(district);
  const special = Boolean(key) && settings.freeNeighborhoods.some((name) => normalizeCommercialText(name) === key);
  return special ? settings.neighborhoodMinimum : settings.globalMinimum;
}
