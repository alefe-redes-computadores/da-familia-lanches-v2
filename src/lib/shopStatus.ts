import{doc,getDoc}from"firebase/firestore";import{db}from"@/lib/firebase";
import{DEFAULT_STORE_SETTINGS,evaluateStoreStatus,normalizeStoreSettings}from"@/lib/storeSchedule";
export type ShopStatus={isOpen:boolean;message:string;nextOpenLabel?:string;mode?:string;source?:string};
export const getScheduleShopStatus=():ShopStatus=>evaluateStoreStatus(DEFAULT_STORE_SETTINGS);
export function statusFromSetting(raw:unknown):ShopStatus|null{if(raw==null)return null;return evaluateStoreStatus(normalizeStoreSettings(typeof raw==="boolean"?{isOpen:raw}:raw));}
export async function getEffectiveShopStatus():Promise<ShopStatus>{try{const s=await getDoc(doc(db,"settings","loja"));return s.exists()?evaluateStoreStatus(normalizeStoreSettings(s.data())):getScheduleShopStatus()}catch(e){console.warn("Status remoto indisponível",e);return getScheduleShopStatus()}}
