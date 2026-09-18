// src/lib/schedulingConfig.ts
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
export type SchedulingConfig={enabled:boolean;intervalMinutes:number;defaultCapacity:number;leadMinutes:number;enabledTimes:string[];capacityByTime:Record<string,number>};
export const DEFAULT_SCHEDULING_CONFIG:SchedulingConfig={enabled:true,intervalMinutes:30,defaultCapacity:2,leadMinutes:30,enabledTimes:[],capacityByTime:{}};
const num=(v:unknown,d:number,a:number,b:number)=>{const n=Math.trunc(Number(v));return Number.isFinite(n)?Math.min(b,Math.max(a,n)):d};
export function normalizeSchedulingConfig(raw:unknown):SchedulingConfig{const x=raw&&typeof raw==="object"?raw as Record<string,unknown>:{};const enabledTimes=Array.isArray(x.enabledTimes)?x.enabledTimes.filter((v):v is string=>typeof v==="string"&&/^\d{2}:\d{2}$/.test(v)):[];const cr=x.capacityByTime&&typeof x.capacityByTime==="object"?x.capacityByTime as Record<string,unknown>:{};return{enabled:x.enabled!==false,intervalMinutes:num(x.intervalMinutes,30,15,120),defaultCapacity:num(x.defaultCapacity,2,1,50),leadMinutes:num(x.leadMinutes,30,0,240),enabledTimes,capacityByTime:Object.fromEntries(Object.entries(cr).filter(([k])=>/^\d{2}:\d{2}$/.test(k)).map(([k,v])=>[k,num(v,2,1,50)]))}}
export async function getSchedulingConfig(){const s=await getDoc(doc(db,"settings","orderScheduling"));return s.exists()?normalizeSchedulingConfig(s.data()):DEFAULT_SCHEDULING_CONFIG}
export async function saveSchedulingConfig(v:SchedulingConfig){await setDoc(doc(db,"settings","orderScheduling"),normalizeSchedulingConfig(v),{merge:true})}
export const capacityForTime=(c:SchedulingConfig,t:string)=>c.capacityByTime[t]??c.defaultCapacity;
export const scheduleSlotId=(v:string)=>v.replace(/\D/g,"").slice(0,12);
