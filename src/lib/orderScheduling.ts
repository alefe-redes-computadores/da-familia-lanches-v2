// src/lib/orderScheduling.ts
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { capacityForTime, getSchedulingConfig, scheduleSlotId } from "@/lib/schedulingConfig";

export type OrderScheduleSlot={value:string;date:string;time:string;label:string;disabled?:boolean};
type DayRule={enabled?:boolean;open?:string;close?:string};
type ExceptionRule={date?:string;closed?:boolean;open?:string;close?:string};
const ZONE="America/Sao_Paulo";
const DAY_KEYS=["sun","mon","tue","wed","thu","fri","sat"] as const;
const DAY_LABELS=["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"] as const;
function parts(date=new Date()){const p=new Intl.DateTimeFormat("en-CA",{timeZone:ZONE,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23",weekday:"short"}).formatToParts(date);const g=(t:string)=>p.find(x=>x.type===t)?.value??"";return{date:`${g("year")}-${g("month")}-${g("day")}`,time:`${g("hour")}:${g("minute")}`}}
function mins(v:string){const[h,m]=v.split(":").map(Number);return h*60+m}
function hhmm(n:number){return`${String(Math.floor(n/60)).padStart(2,"0")}:${String(n%60).padStart(2,"0")}`}
function addDays(key:string,n:number){const[y,m,d]=key.split("-").map(Number);const x=new Date(Date.UTC(y,m-1,d+n,12));return`${x.getUTCFullYear()}-${String(x.getUTCMonth()+1).padStart(2,"0")}-${String(x.getUTCDate()).padStart(2,"0")}`}
function weekday(key:string){const[y,m,d]=key.split("-").map(Number);return new Date(Date.UTC(y,m-1,d,12)).getUTCDay()}
function br(key:string){const[y,m,d]=key.split("-");return`${d}/${m}/${y}`}
export async function getOrderScheduleSlots(daysAhead=7):Promise<OrderScheduleSlot[]>{
 const cfg=await getSchedulingConfig();if(!cfg.enabled)return[];
 const snap=await getDoc(doc(db,"settings","loja"));const raw=(snap.exists()?snap.data():{}) as Record<string,unknown>;
 const schedule=(raw.schedule&&typeof raw.schedule==="object"?raw.schedule:{}) as Record<string,DayRule>;const exceptions=Array.isArray(raw.exceptions)?raw.exceptions as ExceptionRule[]:[];
 const now=parts(),nowM=mins(now.time),list:OrderScheduleSlot[]=[];
 for(let off=0;off<daysAhead;off++){const date=addDays(now.date,off),wd=weekday(date),ex=exceptions.find(x=>x.date===date);if(ex?.closed)continue;const rule=schedule[DAY_KEYS[wd]],enabled=ex?ex.closed!==true:rule?.enabled===true;if(!enabled)continue;const open=ex?.open||rule?.open||"",close=ex?.close||rule?.close||"";if(!open||!close)continue;let st=mins(open),en=mins(close);if(en<=st)en+=1440;for(let m=Math.ceil(st/cfg.intervalMinutes)*cfg.intervalMinutes;m<en;m+=cfg.intervalMinutes){const d=m>=1440?addDays(date,1):date,t=hhmm(m%1440);if(cfg.enabledTimes.length&&!cfg.enabledTimes.includes(t))continue;if(d===now.date&&mins(t)<nowM+cfg.leadMinutes)continue;list.push({value:`${d}T${t}:00-03:00`,date:d,time:t,label:`${d===now.date?"Hoje":DAY_LABELS[weekday(d)]+" "+br(d)} · ${t}`})}}
 const dates=[...new Set(list.map(x=>x.date))],used=new Map<string,number>();if(dates.length){const q=await getDocs(query(collection(db,"schedule_slots"),where("date","in",dates.slice(0,30))));q.forEach(x=>used.set(x.id,Math.max(0,Number(x.data().reserved)||0)))}
 return list.map(x=>{const n=used.get(scheduleSlotId(x.value))||0,cap=capacityForTime(cfg,x.time),left=Math.max(0,cap-n);return{...x,disabled:left===0,label:left===0?`${x.label} · Lotado`:`${x.label} · ${left} ${left===1?"vaga":"vagas"}`}})
}
export function scheduleHumanLabel(value:string){const m=value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);return m?`${m[3]}/${m[2]} às ${m[4]}:${m[5]}`:value}
