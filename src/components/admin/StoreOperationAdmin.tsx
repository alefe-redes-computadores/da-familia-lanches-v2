"use client";
import{useEffect,useMemo,useRef,useState}from"react";import{Save,Plus,Trash2,Bot,DoorOpen,DoorClosed,FlaskConical}from"lucide-react";import{doc,serverTimestamp,setDoc}from"firebase/firestore";import{db}from"@/lib/firebase";
import{DAYS,DEFAULT_STORE_SETTINGS,evaluateStoreStatus,type DayKey,type StoreException,type StoreMode,type StoreSettings}from"@/lib/storeSchedule";
import styles from"./StoreOperationAdmin.module.css";
import { haptic } from "@/lib/haptics";
import{useAdminStoreSettings}from"@/hooks/useAdminStoreSettings";
import{useAdminConfirm}from"@/components/admin/ui/AdminExperienceProvider";
export function StoreOperationAdmin(){const confirm=useAdminConfirm();const{settings:liveSettings,ready}=useAdminStoreSettings();const[s,setS]=useState<StoreSettings>(liveSettings),[busy,setBusy]=useState(false),[msg,setMsg]=useState("");
 const[ex,setEx]=useState<StoreException>({date:"",closed:true,label:""});
 // DFL-R100-FINAL-POLISH: fonte explicita para replicar somente horas em dias abertos.
 const[copySourceDay,setCopySourceDay]=useState<DayKey>("fri");
 const editingSchedule = useRef(false);
 useEffect(()=>{if(ready&&!editingSchedule.current)setS(liveSettings)},[ready,liveSettings]);
 // Estado efetivo vem da nuvem; edicoes locais de horario nao simulam loja aberta.
 const current=useMemo(()=>evaluateStoreStatus(liveSettings),[liveSettings]);
 const scheduleDirty=JSON.stringify(s.schedule)!==JSON.stringify(liveSettings.schedule);
 const scheduleSource: DayKey | undefined = s.schedule[copySourceDay].enabled ? copySourceDay : DAYS.find(({key})=>s.schedule[key].enabled)?.key;
 useEffect(()=>{if(!scheduleDirty)editingSchedule.current=false},[scheduleDirty]);
 const save=async(next:StoreSettings,text:string)=>{if(busy)return;setBusy(true);try{await setDoc(doc(db,"settings","loja"),{...next,updatedAt:serverTimestamp()},{merge:true});setS(next);editingSchedule.current=false;setMsg(text);haptic("success")}catch(e){console.error(e);setMsg("Falha ao salvar funcionamento.");haptic("error")}finally{setBusy(false)}};
 const mode=async(m:StoreMode)=>{
  if(m===s.mode)return;
  if(scheduleDirty){
   const approved=await confirm({title:"Horários ainda não salvos",message:"Ao mudar o modo, suas alterações de horários também serão salvas. Deseja continuar?",tone:"warning",confirmLabel:"Salvar tudo e continuar"});
   if(!approved)return;
  }
  const risky=m==="force_open"||m==="force_closed";
  if(risky){
   const approved=await confirm({
    title:m==="force_open"?"Abrir a loja manualmente?":"Fechar a loja manualmente?",
    message:"O controle manual ficará ativo até você voltar para Automático.",
    confirmLabel:m==="force_open"?"Abrir loja":"Fechar loja",
    tone:m==="force_closed"?"danger":"warning",
   });
   if(!approved)return;
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
  {scheduleDirty && <div className={styles.r35DirtyNotice} role="status"><div><strong>Horários alterados, mas ainda não salvos</strong><small>O funcionamento público continua usando a agenda publicada. Salve a agenda ou descarte as edições.</small></div><button type="button" disabled={busy} onClick={()=>{setS(liveSettings);editingSchedule.current=false;setMsg("Edições locais descartadas. A configuração publicada não mudou.");haptic("step")}}>Descartar edições</button></div>}
  {/* DFL-R93-OPERACAO-MACRO — situacao operacional sem leitura extra do Firebase. */}
  <div className={styles.r93OpPulse} aria-label="Resumo operacional">
    <div><small>SITUACAO PUBLICADA</small><strong>{current.isOpen ? "Aceitando pedidos conforme a operacao" : "Loja indisponivel para pedidos imediatos"}</strong></div>
    <div><small>MODO DA LOJA</small><strong>{s.mode === "auto" ? "Automatico" : s.mode === "force_open" ? "Abertura manual" : s.mode === "force_closed" ? "Fechamento manual" : "Teste controlado"}</strong></div>
    <div><small>AGENDA</small><strong>{scheduleDirty ? "Alteracoes nao salvas" : "Sem edicoes pendentes"}</strong></div>
  </div>
  {/* DFL-R95-MACRO: confianca operacional, sem alterar modo ou agenda. */}
  <div className={styles.r95CloudNotice} role="note"><strong>Estado publicado na nuvem</strong><span>O painel abaixo reflete o funcionamento efetivo. Alterações de horário só entram em vigor depois de salvar.</span></div>
  <div className={styles.current} data-open={current.isOpen}><div><span>ESTADO EFETIVO</span><strong>{current.isOpen?"Loja aberta":"Loja fechada"}</strong><small>{current.message}</small></div><b>{current.source==="manual"?"MANUAL":current.source==="exception"?"EXCEÇÃO":"AUTOMÁTICO"}</b></div>
  <div className={styles.block}><header><div><span>CONTROLE</span><strong>Modo de funcionamento</strong></div><p>O modo manual tem prioridade sobre a agenda.</p></header><div className={styles.modes}>
   {([["auto","Automático","Segue os horários",Bot],["force_open","Forçar aberto","Ignora a agenda",DoorOpen],["force_closed","Forçar fechado","Fecha temporariamente",DoorClosed],["test_open","Aberto para teste","Só e-mails liberados",FlaskConical]]as const).map(([m,t,c,Icon])=><button key={m} data-active={s.mode===m} disabled={busy} onClick={()=>{haptic("step");void mode(m)}}><i><Icon size={17}/></i><span><strong>{t}</strong><small>{c}</small></span></button>)}
  </div>{s.mode==="test_open"&&<div className={styles.testAccess}>
   <div className={styles.testTitle}>E-mails liberados para pedido imediato</div>
   <div className={styles.testForm}><input type="email" value={testEmail} onChange={e=>setTestEmail(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addTestEmail()}}} placeholder="email@exemplo.com" className={styles.testInput}/><button disabled={busy} onClick={addTestEmail} className={styles.testAdd}>Liberar</button></div>
   <div className={styles.testList}>{s.testAllowedEmails.length?s.testAllowedEmails.map(email=><div key={email} className={styles.testRow}><span className={styles.testEmail}>{email}</span><button disabled={busy} onClick={()=>removeTestEmail(email)} className={styles.testRemove}>Remover</button></div>):<small>Nenhum e-mail liberado.</small>}</div>
  </div>}</div>
  <div className={styles.r97SchedulePulse} role="status"><strong>Conferência da semana</strong><span>{DAYS.filter(({key})=>s.schedule[key].enabled).length} dia(s) com atendimento previsto · {s.exceptions.length} exceção(ões) cadastrada(s)</span><small>{scheduleDirty ? "Você está vendo alterações locais ainda não publicadas." : "Agenda exibida sincronizada com a configuração atual."}</small></div>
  {/* DFL-R98-MACRO-FINAL: atalho de padronizacao, altera apenas rascunho local. */}
  <div className={styles.r98ScheduleTools}>
    <strong>Horários em lote</strong>
    <span>Escolha um dia aberto como referência. Só as horas dos outros dias ativos serão copiadas; você precisa salvar depois.</span>
    <select aria-label="Dia de referência para horários" value={scheduleSource ?? ""} disabled={busy || !scheduleSource} onChange={e=>setCopySourceDay(e.target.value as DayKey)}>
      {!scheduleSource && <option value="">Nenhum dia ativo</option>}
      {DAYS.filter(({key})=>s.schedule[key].enabled).map(({key,label})=><option key={key} value={key}>{label}</option>)}
    </select>
    <button type="button" disabled={busy || !scheduleSource} onClick={() => {
      if (!scheduleSource) return;
      const nextSchedule = { ...s.schedule };
      for (const {key} of DAYS) if (key !== scheduleSource && nextSchedule[key].enabled) nextSchedule[key] = { ...nextSchedule[key], open: s.schedule[scheduleSource].open, close: s.schedule[scheduleSource].close };
      editingSchedule.current = true;
      setS({ ...s, schedule: nextSchedule });
      setMsg("Horários copiados para o rascunho. Confira e salve quando estiver pronto.");
      haptic("step");
    }}>Usar horário de segunda nos dias ativos</button>
  </div>
  <div className={styles.block}><header><div><span>AGENDA SEMANAL</span><strong>Dias e horários</strong></div><p>Horário de Brasília.</p></header>{scheduleDirty&&<p className={styles.scheduleNotice} role="status">Você tem horários editados que ainda não foram publicados.</p>}<div className={styles.week}>{DAYS.map(({key,label})=>{const d=s.schedule[key];return<div className={styles.day} data-enabled={d.enabled} key={key}>
   <label className={styles.toggle}><input type="checkbox" checked={d.enabled} onChange={e=>{editingSchedule.current=true;setS({...s,schedule:{...s.schedule,[key]:{...d,enabled:e.target.checked}}})}}/><strong>{label}</strong><b>{d.enabled?"Aberto":"Fechado"}</b></label>
   {d.enabled&&<div className={styles.times}><label>Abre<input type="time" value={d.open} onChange={e=>{editingSchedule.current=true;setS({...s,schedule:{...s.schedule,[key]:{...d,open:e.target.value}}})}}/></label><label>Fecha<input type="time" value={d.close} onChange={e=>{editingSchedule.current=true;setS({...s,schedule:{...s.schedule,[key]:{...d,close:e.target.value}}})}}/></label></div>}
  </div>})}</div><button className={styles.save} disabled={busy||!scheduleDirty} onClick={()=>void save(s,"Horários atualizados.")}>{busy?"Salvando...":scheduleDirty?<><Save size={15}/>Salvar horários</>:"Horários salvos"}</button></div>
  <div className={styles.block}><header><div><span>EXCEÇÕES</span><strong>Feriados e dias especiais</strong></div><p>A exceção vence a agenda daquele dia.</p></header><div className={styles.exform}>
   <label>Data<input type="date" value={ex.date} onChange={e=>setEx({...ex,date:e.target.value})}/></label><label className={styles.closed}><input type="checkbox" checked={ex.closed} onChange={e=>setEx({...ex,closed:e.target.checked,...(!e.target.checked?{open:ex.open||"18:00",close:ex.close||"23:00"}:{})})}/>Fechado o dia todo</label>
   {!ex.closed&&<><label>Abre<input type="time" value={ex.open??"18:00"} onChange={e=>setEx({...ex,open:e.target.value})}/></label><label>Fecha<input type="time" value={ex.close??"23:00"} onChange={e=>setEx({...ex,close:e.target.value})}/></label></>}
   <label className={styles.note}>Observação<input value={ex.label??""} onChange={e=>setEx({...ex,label:e.target.value})} placeholder="Ex.: feriado"/></label><button disabled={busy} onClick={addEx}><Plus size={15}/>Adicionar</button>
  </div>{s.exceptions.length>0&&<div className={styles.exceptions}>{s.exceptions.map(x=><div key={x.date}><span><strong>{x.date.split("-").reverse().join("/")}</strong><small>{x.label||"Exceção"}</small></span><b>{x.closed?"FECHADO":`${x.open}–${x.close}`}</b><button onClick={()=>void save({...s,exceptions:s.exceptions.filter(y=>y.date!==x.date)},"Exceção removida.")}><Trash2 size={14}/></button></div>)}</div>}</div>
  {msg&&<div className={styles.msg}>{msg}<button onClick={()=>setMsg("")}>×</button></div>}
 </section>}
// DFL-R35-OPERATION-DRAFT
