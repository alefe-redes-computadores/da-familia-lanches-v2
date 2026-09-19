"use client";
import { useEffect,useMemo,useState } from "react";
import { doc,onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DEFAULT_SCHEDULING_CONFIG,getSchedulingConfig,saveSchedulingConfig,type SchedulingConfig } from "@/lib/schedulingConfig";
import { DEFAULT_STORE_SETTINGS,normalizeStoreSettings,type StoreSettings } from "@/lib/storeSchedule";
import styles from "./SchedulingAdmin.module.css";
const hhmm=(m:number)=>`${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`;
const mins=(t:string)=>{const[h,m]=t.split(":").map(Number);return h*60+m};
const inside=(t:string,a:string,b:string)=>{const x=mins(t),o=mins(a),c=mins(b);return c>=o?(x>=o&&x<=c):(x>=o||x<=c)};
const pulse=(ok=false)=>{if(typeof navigator!=="undefined"&&typeof navigator.vibrate==="function")navigator.vibrate(ok?[12,35,18]:8)};
export function SchedulingAdmin(){
 const[c,setC]=useState<SchedulingConfig>(DEFAULT_SCHEDULING_CONFIG),[store,setStore]=useState<StoreSettings>(DEFAULT_STORE_SETTINGS),[busy,setBusy]=useState(false),[msg,setMsg]=useState(""),[showAll,setShowAll]=useState(false);
 useEffect(()=>{void getSchedulingConfig().then(setC).catch(()=>setMsg("Não foi possível carregar os agendamentos."));},[]);
 useEffect(()=>onSnapshot(doc(db,"settings","loja"),x=>setStore(x.exists()?normalizeStoreSettings(x.data()):DEFAULT_STORE_SETTINGS),()=>setStore(DEFAULT_STORE_SETTINGS)),[]);
 useEffect(()=>{if(!msg)return;const id=window.setTimeout(()=>setMsg(""),3200);return()=>window.clearTimeout(id)},[msg]);
 const times=useMemo(()=>{const a:string[]=[];for(let m=0;m<1440;m+=c.intervalMinutes)a.push(hhmm(m));return a},[c.intervalMinutes]);
 const windows=useMemo(()=>Object.values(store.schedule).filter(d=>d.enabled&&d.open&&d.close).map(d=>({open:d.open,close:d.close})),[store.schedule]);
 const operational=useMemo(()=>times.filter(t=>c.enabledTimes.includes(t)||windows.some(w=>inside(t,w.open,w.close))),[times,c.enabledTimes,windows]);
 const visible=showAll?times:operational;
 const range=useMemo(()=>{if(!windows.length)return"sem janela semanal";const a=windows.map(w=>w.open).sort(),b=windows.map(w=>w.close).sort();return`${a[0]}–${b[b.length-1]}`},[windows]);
 const toggle=(t:string)=>{pulse();setC(v=>({...v,enabledTimes:v.enabledTimes.includes(t)?v.enabledTimes.filter(x=>x!==t):[...v.enabledTimes,t].sort()}))};
 const period=(a:number,b:number)=>{pulse();setC(v=>({...v,enabledTimes:[...new Set([...v.enabledTimes,...times.filter(t=>{const x=mins(t);return x>=a&&x<=b})])].sort()}))};
 const save=async()=>{setBusy(true);setMsg("");try{await saveSchedulingConfig(c);pulse(true);setMsg("Agendamentos salvos e publicados.")}catch(e){console.error(e);setMsg("Não foi possível salvar os agendamentos.")}finally{setBusy(false)}};
 return <section className={styles.card}>
  <div className={styles.head}><div><span>AGENDA DE PEDIDOS</span><strong>Agendamentos</strong><p>Capacidade, antecedência e horários oferecidos no checkout.</p></div><button type="button" className={styles.status} data-enabled={c.enabled} onClick={()=>{pulse();setC(v=>({...v,enabled:!v.enabled}))}}>{c.enabled?"Ativado":"Desativado"}</button></div>
  <div className={styles.settings}>
   <label><span>INTERVALO</span><div className={styles.segmented}><button type="button" data-active={c.intervalMinutes===30} onClick={()=>{pulse();setC(v=>({...v,intervalMinutes:30,enabledTimes:[]}))}}>30 min</button><button type="button" data-active={c.intervalMinutes===60} onClick={()=>{pulse();setC(v=>({...v,intervalMinutes:60,enabledTimes:[]}))}}>60 min</button></div></label>
   <label><span>CAPACIDADE PADRÃO</span><input type="number" min={1} max={50} value={c.defaultCapacity} onChange={e=>setC(v=>({...v,defaultCapacity:Math.max(1,Number(e.target.value)||1)}))}/></label>
   <label><span>ANTECEDÊNCIA</span><div className={styles.suffix}><input type="number" min={0} step={15} value={c.leadMinutes} onChange={e=>setC(v=>({...v,leadMinutes:Math.max(0,Number(e.target.value)||0)}))}/><b>min</b></div></label>
  </div>
  <div className={styles.quick}><span>ATALHOS</span><div><button type="button" onClick={()=>period(660,840)}>Almoço 11–14h</button><button type="button" onClick={()=>period(1080,1410)}>Noite 18–23:30</button><button type="button" onClick={()=>{pulse();setC(v=>({...v,enabledTimes:times}))}}>Todos</button><button type="button" onClick={()=>{pulse();setC(v=>({...v,enabledTimes:[],capacityByTime:{}}))}}>Limpar</button></div></div>
  <div className={styles.slotHead}><div><span>HORÁRIOS OFERECIDOS</span><strong>{c.enabledTimes.length} ativos · janela {range}</strong></div><div className={styles.slotTools}><small>{showAll?"Exibindo o dia inteiro.":"Primeiro, apenas a janela real de funcionamento."}</small><button type="button" onClick={()=>{pulse();setShowAll(v=>!v)}}>{showAll?"Mostrar só funcionamento":"Ver todos os horários"}</button></div></div>
  {visible.length?<div className={styles.slots}>{visible.map(t=>{const on=c.enabledTimes.includes(t);return <article key={t} data-enabled={on}><button type="button" onClick={()=>toggle(t)}><strong>{t}</strong><span>{on?"Disponível":"Bloqueado"}</span></button>{on&&<label><span>Vagas</span><input aria-label={`Capacidade ${t}`} type="number" min={1} max={50} value={c.capacityByTime[t]??c.defaultCapacity} onChange={e=>setC(v=>({...v,capacityByTime:{...v.capacityByTime,[t]:Math.max(1,Number(e.target.value)||1)}}))}/></label>}</article>})}</div>:<div className={styles.emptySlots}>Nenhum horário cai na janela semanal atual. Use “Ver todos os horários” para configuração avançada.</div>}
  {msg&&<div className={styles.feedback}>{msg}</div>}<button type="button" className={styles.save} disabled={busy} onClick={()=>void save()}>{busy?"Salvando…":"Salvar agendamentos"}</button>
 </section>
}
