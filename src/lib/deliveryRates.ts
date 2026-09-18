import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type DeliveryRate = { nome?: string; taxa?: number | string };
export const SAFE_DEFAULT_DELIVERY_FEE = 6;

export async function getDefaultDeliveryFee(): Promise<number> {
  try {
    const snap = await getDoc(doc(db, "settings", "delivery"));
    const value = Number(snap.data()?.defaultFee);
    return Number.isFinite(value) && value >= 0 ? value : SAFE_DEFAULT_DELIVERY_FEE;
  } catch {
    return SAFE_DEFAULT_DELIVERY_FEE;
  }
}
