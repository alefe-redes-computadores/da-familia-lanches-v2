import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getShopStatus } from "@/lib/openingHours";

export type ShopStatus = {
  isOpen: boolean;
  message: string;
  source: "settings" | "schedule";
};

export function statusFromSetting(value: unknown): ShopStatus | null {
  if (typeof value !== "boolean") return null;
  return {
    isOpen: value,
    message: value ? "Aberto agora" : "Fechado agora",
    source: "settings",
  };
}

export function getScheduleShopStatus(): ShopStatus {
  const status = getShopStatus();
  return { ...status, source: "schedule" };
}

export async function getEffectiveShopStatus(): Promise<ShopStatus> {
  const fallback = getScheduleShopStatus();
  try {
    const snap = await getDoc(doc(db, "settings", "loja"));
    if (!snap.exists()) return fallback;
    return statusFromSetting(snap.data().isOpen) ?? fallback;
  } catch (error) {
    console.warn("Falha ao ler status remoto da loja; usando horário local.", error);
    return fallback;
  }
}
