"use client";
import{useEffect,useMemo,useState}from"react";import{doc,serverTimestamp,setDoc}from"firebase/firestore";import{db}from"@/lib/firebase";
import{DAYS,DEFAULT_STORE_SETTINGS,evaluateStoreStatus,type StoreException,type StoreMode,type StoreSettings}from"@/lib/storeSchedule";
import styles from"./StoreOperationAdmin.module.css";
import { haptic } from "@/lib/haptics";
import{useAdminStoreSettings}from"@/hooks/useAdminStoreSettings";
export function StoreOperationAdmin(){const{settings:liveSettings,ready}=useAdminStoreSettings();const[s,setS]=useState<StoreSettings>(liveSettings),[busy,setBusy]=useState(false),[msg,setMsg]=useState("");
 const[ex,setEx]=useState<StoreException>({date:"",closed:true,label:""});useEffect(()=>{if(ready)setS(liveSettings)},[ready,liveSettings]);
 const current=useMemo(()=>evaluateStoreStatus(s),[s]);const save=async(next:StoreSettings,text:string)=>{setBusy(true);try{await setDoc(doc(db,"settings","loja"),{...next,updatedAt:serverTimestamp()},{merge:true});setS(next);setMsg(text);haptic("success")}catch(e){console.error(e);setMsg("Falha ao salvar funcionamento.");haptic("error")}finally{setBusy(false)}};
 const mode=(m:StoreMode)=>{
  if(m===s.mode)return;
  const risky=m==="force_open"||m==="force_closed";
  if(risky){
   const action=m==="force_open"?"abrir a loja ignorando a agenda":"fechar a loja temporariamente";
   if(!window.confirm(`Confirmar: ${action}?\n\nO controle manual ficará ativo até você voltar para Automático.`))return;
  }
  void save({...s,mode:m},m==="auto"?"Modo automático ativado.":m==="force_open"?"Loja forçada como aberta.":m==="test_open"?"Modo de teste ativado. Só os e-mails liberados fazem pedido imediato.":"Loja forçada como fechada.");
 };
 const[testEmail,setTestEmail]=useState("");
 useEffect(()=>{if(!msg)return;const id=window.setTimeout(()=>setMsg(""),3200);return()=>window.clearTimeout(id)},[msg]);
 const addTestEmail=()=>{const email=testEmail.trim().toLowerCase();if(!email||!email.includes("@"))return setMsg("Informe um e-mail válido.");if(s.testAllowedEmails.includes(email))return setMsg("Esse e-mail já está liberado.");setTestEmail("");void save({...s,testAllowedEmails:[...s.testAllowedEmails,email]},"E-mail liberado para teste.")};
 const removeTestEmail=(email:string)=>void save({...s,testAllowedEmails:s.testAllowedEmails.filter(x=>x!==email)},"E-mail removido do teste.");
 const addEx=()=>{if(!ex.date)return setMsg("Escolha a data.");if(!ex.closed&&(!ex.open||!ex.close))return setMsg("Informe abertura e fechamento.");void save({...s,exceptions:[...s.exceptions.filter(x=>x.date!==ex.date),ex].sort((a,b)=>a.date.localeCompare(b.date))},"Exceção salva.");setEx({date:"",closed:true,label:""})};
 if(!ready)return<div className={styles.state}>Carregando funcionamento...</div>;
 return<section className={styles.root}>
  <div className={styles.current} data-open={current.isOpen}><div><span>ESTADO EFETIVO</span><strong>{current.isOpen?"Loja aberta":"Loja fechada"}</strong><small>{current.message}</small></div><b>{current.source==="manual"?"MANUAL":current.source==="exception"?"EXCEÇÃO":"AUTOMÁTICO"}</b></div>
  <div className={styles.block}><header><div><span>CONTROLE</span><strong>Modo de funcionamento</strong></div><p>O modo manual tem prioridade sobre a agenda.</p></header><div className={styles.modes}>
   {([["auto","Automático","Segue os horários"],["force_open","Forçar aberto","Ignora a agenda"],["force_closed","Forçar fechado","Fecha temporariamente"],["test_open","Aberto para teste","Só e-mails liberados"]]as const).map(([m,t,c])=><button key={m} data-active={s.mode===m} disabled={busy} onClick={()=>mode(m)}><i/><span><strong>{t}</strong><small>{c}</small></span></button>)}
  </div>{s.mode==="test_open"&&<div className={styles.testAccess}>
   <div className={styles.testTitle}>E-mails liberados para pedido imediato</div>
   <div className={styles.testForm}><input type="email" value={testEmail} onChange={e=>setTestEmail(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addTestEmail()}}} placeholder="email@exemplo.com" className={styles.testInput}/><button disabled={busy} onClick={addTestEmail} className={styles.testAdd}>Liberar</button></div>
   <div className={styles.testList}>{s.testAllowedEmails.length?s.testAllowedEmails.map(email=><div key={email} className={styles.testRow}><span className={styles.testEmail}>{email}</span><button disabled={busy} onClick={()=>removeTestEmail(email)} className={styles.testRemove}>Remover</button></div>):<small>Nenhum e-mail liberado.</small>}</div>
  </div>}</div>
  <div className={styles.block}><header><div><span>AGENDA SEMANAL</span><strong>Dias e horários</strong></div><p>Horário de Brasília.</p></header><div className={styles.week}>{DAYS.map(({key,label})=>{const d=s.schedule[key];return<div className={styles.day} key={key}>
   <label className={styles.toggle}><input type="checkbox" checked={d.enabled} onChange={e=>setS({...s,schedule:{...s.schedule,[key]:{...d,enabled:e.target.checked}}})}/><strong>{label}</strong><b>{d.enabled?"Aberto":"Fechado"}</b></label>
   {d.enabled&&<div className={styles.times}><label>Abre<input type="time" value={d.open} onChange={e=>setS({...s,schedule:{...s.schedule,[key]:{...d,open:e.target.value}}})}/></label><label>Fecha<input type="time" value={d.close} onChange={e=>setS({...s,schedule:{...s.schedule,[key]:{...d,close:e.target.value}}})}/></label></div>}
  </div>})}</div><button className={styles.save} disabled={busy} onClick={()=>void save(s,"Horários atualizados.")}>{busy?"Salvando...":"Salvar horários"}</button></div>
  <div className={styles.block}><header><div><span>EXCEÇÕES</span><strong>Feriados e dias especiais</strong></div><p>A exceção vence a agenda daquele dia.</p></header><div className={styles.exform}>
   <label>Data<input type="date" value={ex.date} onChange={e=>setEx({...ex,date:e.target.value})}/></label><label className={styles.closed}><input type="checkbox" checked={ex.closed} onChange={e=>setEx({...ex,closed:e.target.checked})}/>Fechado o dia todo</label>
   {!ex.closed&&<><label>Abre<input type="time" value={ex.open??"18:00"} onChange={e=>setEx({...ex,open:e.target.value})}/></label><label>Fecha<input type="time" value={ex.close??"23:00"} onChange={e=>setEx({...ex,close:e.target.value})}/></label></>}
   <label className={styles.note}>Observação<input value={ex.label??""} onChange={e=>setEx({...ex,label:e.target.value})} placeholder="Ex.: feriado"/></label><button disabled={busy} onClick={addEx}>Adicionar</button>
  </div>{s.exceptions.length>0&&<div className={styles.exceptions}>{s.exceptions.map(x=><div key={x.date}><span><strong>{x.date.split("-").reverse().join("/")}</strong><small>{x.label||"Exceção"}</small></span><b>{x.closed?"FECHADO":`${x.open}–${x.close}`}</b><button onClick={()=>void save({...s,exceptions:s.exceptions.filter(y=>y.date!==x.date)},"Exceção removida.")}>×</button></div>)}</div>}</div>
  {msg&&<div className={styles.msg}>{msg}<button onClick={()=>setMsg("")}>×</button></div>}
 </section>}
