"use client";
import { useEffect,useMemo,useState } from "react";
import { DEFAULT_SCHEDULING_CONFIG,getSchedulingConfig,saveSchedulingConfig,type SchedulingConfig } from "@/lib/schedulingConfig";
import styles from "./SchedulingAdmin.module.css";
const hhmm=(m:number)=>`${String(Math.floor(m/60)).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`;
export function SchedulingAdmin(){
 const[c,setC]=useState<SchedulingConfig>(DEFAULT_SCHEDULING_CONFIG),[busy,setBusy]=useState(false),[msg,setMsg]=useState("");
 useEffect(()=>{void getSchedulingConfig().then(setC).catch(()=>setMsg("Não foi possível carregar os agendamentos."));},[]);
 const times=useMemo(()=>{const a:string[]=[];for(let m=0;m<1440;m+=c.intervalMinutes)a.push(hhmm(m));return a},[c.intervalMinutes]);
 const toggle=(t:string)=>setC(v=>({...v,enabledTimes:v.enabledTimes.includes(t)?v.enabledTimes.filter(x=>x!==t):[...v.enabledTimes,t].sort()}));
 const period=(a:number,b:number)=>setC(v=>({...v,enabledTimes:[...new Set([...v.enabledTimes,...times.filter(t=>{const[h,m]=t.split(":").map(Number),x=h*60+m;return x>=a&&x<=b})])].sort()}));
 const save=async()=>{setBusy(true);setMsg("");try{await saveSchedulingConfig(c);setMsg("Agendamentos salvos e publicados.")}catch(e){console.error(e);setMsg("Não foi possível salvar os agendamentos.")}finally{setBusy(false)}};
 return <section className={styles.card}>
  <div className={styles.head}><div><span>AGENDA DE PEDIDOS</span><strong>Agendamentos</strong><p>Defina horários, intervalo, antecedência e capacidade por faixa.</p></div><button type="button" className={styles.status} data-enabled={c.enabled} onClick={()=>setC(v=>({...v,enabled:!v.enabled}))}>{c.enabled?"Ativado":"Desativado"}</button></div>
  <div className={styles.settings}>
   <label><span>INTERVALO</span><select value={c.intervalMinutes} onChange={e=>setC(v=>({...v,intervalMinutes:Number(e.target.value),enabledTimes:[]}))}><option value={30}>30 min</option><option value={60}>60 min</option></select></label>
   <label><span>CAPACIDADE PADRÃO</span><input type="number" min={1} max={50} value={c.defaultCapacity} onChange={e=>setC(v=>({...v,defaultCapacity:Math.max(1,Number(e.target.value)||1)}))}/></label>
   <label><span>ANTECEDÊNCIA</span><div className={styles.suffix}><input type="number" min={0} step={15} value={c.leadMinutes} onChange={e=>setC(v=>({...v,leadMinutes:Math.max(0,Number(e.target.value)||0)}))}/><b>min</b></div></label>
  </div>
  <div className={styles.quick}><span>ATALHOS</span><div><button type="button" onClick={()=>period(660,840)}>Almoço 11–14h</button><button type="button" onClick={()=>period(1080,1410)}>Noite 18–23:30</button><button type="button" onClick={()=>setC(v=>({...v,enabledTimes:times}))}>Todos</button><button type="button" onClick={()=>setC(v=>({...v,enabledTimes:[],capacityByTime:{}}))}>Limpar</button></div></div>
  <div className={styles.slotHead}><div><span>HORÁRIOS OFERECIDOS</span><strong>{c.enabledTimes.length} ativos</strong></div><small>Toque para liberar ou bloquear. A capacidade individual aparece nos horários ativos.</small></div>
  <div className={styles.slots}>{times.map(t=>{const on=c.enabledTimes.includes(t);return <article key={t} data-enabled={on}><button type="button" onClick={()=>toggle(t)}><strong>{t}</strong><span>{on?"Disponível":"Bloqueado"}</span></button>{on&&<label><span>Vagas</span><input aria-label={`Capacidade ${t}`} type="number" min={1} max={50} value={c.capacityByTime[t]??c.defaultCapacity} onChange={e=>setC(v=>({...v,capacityByTime:{...v.capacityByTime,[t]:Math.max(1,Number(e.target.value)||1)}}))}/></label>}</article>})}</div>
  {msg&&<div className={styles.feedback}>{msg}</div>}<button type="button" className={styles.save} disabled={busy} onClick={()=>void save()}>{busy?"Salvando…":"Salvar agendamentos"}</button>
 </section>
}
