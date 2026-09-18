export type StoreMode="auto"|"force_open"|"force_closed"|"test_open";
export type DayKey="sun"|"mon"|"tue"|"wed"|"thu"|"fri"|"sat";
export type DaySchedule={enabled:boolean;open:string;close:string};
export type StoreException={date:string;closed:boolean;open?:string;close?:string;label?:string};
export type StoreSettings={mode:StoreMode;timezone:string;schedule:Record<DayKey,DaySchedule>;exceptions:StoreException[];testAllowedEmails:string[]};

export const DAYS:Array<{key:DayKey;label:string}>=[
 {key:"sun",label:"Domingo"},{key:"mon",label:"Segunda"},{key:"tue",label:"Terça"},
 {key:"wed",label:"Quarta"},{key:"thu",label:"Quinta"},{key:"fri",label:"Sexta"},{key:"sat",label:"Sábado"}
];
export const DEFAULT_STORE_SETTINGS:StoreSettings={mode:"auto",timezone:"America/Sao_Paulo",schedule:{
 sun:{enabled:true,open:"18:00",close:"23:15"},mon:{enabled:true,open:"18:00",close:"22:45"},
 tue:{enabled:false,open:"18:00",close:"22:45"},wed:{enabled:true,open:"18:00",close:"22:45"},
 thu:{enabled:true,open:"18:00",close:"22:45"},fri:{enabled:true,open:"18:00",close:"23:15"},
 sat:{enabled:true,open:"18:00",close:"23:15"}},exceptions:[],testAllowedEmails:[]};

const time=(v:unknown):v is string=>typeof v==="string"&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v);
const mins=(v:string)=>{const [h,m]=v.split(":").map(Number);return h*60+m};
const inside=(n:number,a:string,b:string)=>{const x=mins(a),y=mins(b);return y>x?n>=x&&n<y:n>=x||n<y};

export function normalizeStoreSettings(raw:unknown):StoreSettings{
 const o=raw&&typeof raw==="object"?raw as Record<string,unknown>:{};
 const rs=o.schedule&&typeof o.schedule==="object"?o.schedule as Record<string,unknown>:{};
 const schedule={...DEFAULT_STORE_SETTINGS.schedule};
 for(const {key} of DAYS){const d=rs[key]&&typeof rs[key]==="object"?rs[key] as Record<string,unknown>:{};
  schedule[key]={enabled:typeof d.enabled==="boolean"?d.enabled:schedule[key].enabled,open:time(d.open)?d.open:schedule[key].open,close:time(d.close)?d.close:schedule[key].close};}
 const exceptions=Array.isArray(o.exceptions)?o.exceptions.flatMap((v):StoreException[]=>{if(!v||typeof v!=="object")return[];const e=v as Record<string,unknown>;
  if(typeof e.date!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(e.date))return[];
  return[{date:e.date,closed:e.closed===true,...(time(e.open)?{open:e.open}:{}),...(time(e.close)?{close:e.close}:{}),...(typeof e.label==="string"?{label:e.label.trim()}:{})}]}):[];
 const mode: StoreMode = o.mode==="force_open"||o.mode==="force_closed"||o.mode==="test_open"||o.mode==="auto"?o.mode:(typeof o.isOpen==="boolean"?(o.isOpen?"force_open":"force_closed"):"auto");
 const testAllowedEmails=Array.isArray(o.testAllowedEmails)?[...new Set(o.testAllowedEmails.map(v=>String(v??"").trim().toLowerCase()).filter(v=>v&&v.includes("@")))]:[];
 return{mode,timezone:typeof o.timezone==="string"&&o.timezone?o.timezone:DEFAULT_STORE_SETTINGS.timezone,schedule,exceptions,testAllowedEmails};
}
function parts(date:Date,tz:string){const f=new Intl.DateTimeFormat("en-CA",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit",weekday:"short",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
 const p=Object.fromEntries(f.formatToParts(date).map(x=>[x.type,x.value]));const map:Record<string,DayKey>={Sun:"sun",Mon:"mon",Tue:"tue",Wed:"wed",Thu:"thu",Fri:"fri",Sat:"sat"};
 return{date:`${p.year}-${p.month}-${p.day}`,day:map[p.weekday]??"sun",minutes:Number(p.hour)*60+Number(p.minute)};}
function nextOpen(s:StoreSettings,now:Date){const current=parts(now,s.timezone);for(let i=0;i<=7;i++){const p=parts(new Date(now.getTime()+i*86400000),s.timezone);const ex=s.exceptions.find(e=>e.date===p.date);if(ex?.closed)continue;
 const d=s.schedule[p.day],open=ex?.open??d.open,enabled=ex?.open&&ex?.close?true:d.enabled;if(!enabled)continue;if(i===0&&current.minutes>=mins(open))continue;
 if(i===0)return`hoje às ${open}`;if(i===1)return`amanhã às ${open}`;return`${DAYS.find(x=>x.key===p.day)?.label.toLowerCase()} às ${open}`;}return undefined;}
export function evaluateStoreStatus(s:StoreSettings,now=new Date()){
 if(s.mode==="force_open")return{isOpen:true,message:"Aberto agora",mode:s.mode,source:"manual" as const};
 if(s.mode==="force_closed")return{isOpen:false,message:"Fechado temporariamente",mode:s.mode,source:"manual" as const};
 if(s.mode==="test_open")return{isOpen:false,message:"Loja em manutenção • agendamento disponível",mode:s.mode,source:"manual" as const};
 const p=parts(now,s.timezone),ex=s.exceptions.find(e=>e.date===p.date);
 if(ex?.closed)return{isOpen:false,message:ex.label||"Fechado excepcionalmente",nextOpenLabel:nextOpen(s,now),mode:s.mode,source:"exception" as const};
 const d=s.schedule[p.day],open=ex?.open??d.open,close=ex?.close??d.close,enabled=ex?.open&&ex?.close?true:d.enabled;
 const isOpen=enabled&&inside(p.minutes,open,close),next=isOpen?undefined:nextOpen(s,now);
 return{isOpen,message:isOpen?"Aberto agora":`Fechado${next?` • ${next}`:""}`,nextOpenLabel:next,mode:s.mode,source:ex?"exception" as const:"schedule" as const};
}

export function canPlaceImmediateTestOrder(settings:StoreSettings,email:unknown){
 if(settings.mode!=="test_open")return false;
 const normalized=typeof email==="string"?email.trim().toLowerCase():"";
 return Boolean(normalized)&&settings.testAllowedEmails.includes(normalized);
}
