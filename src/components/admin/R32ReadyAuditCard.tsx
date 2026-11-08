'use client';
/** R32 — operator-triggered, single-order readiness trace. No polling. */
import {useState} from 'react';
import {AlertCircle,Search,ShieldCheck} from 'lucide-react';
import {auth} from '@/lib/firebase';
import styles from './R32ReadyAuditCard.module.css';
type Entry={eventRef:string|null;sourceEventRef?:string|null;state?:string;eventType?:string;reason?:string|null;stage?:string;occurredAt?:string|null};
type Snapshot={ok:true;orderId:string;commercialStatus:string|null;orderExists:boolean;fulfillment:string;
  consentGranted:boolean;consentTimestampPresent:boolean;phonePresent:boolean;gateReason:string|null;
  readyOutbox:Entry[];readyIntents:Entry[];reason:string;sampleLimited:boolean;providerDeliveryVerified:false;checkedAt:string;note:string};
const pretty:Record<string,string>={order_not_found:'Pedido não encontrado',intent_suppressed:'Evento suprimido pelas políticas',intent_failed:'Falha no processamento do evento',queued_not_delivered:'Enfileirado — entrega ao WhatsApp não comprovada',processing_or_pending:'Processamento ou fila pendente',no_ready_outbox_in_sample:'Sem evento Pronto na amostra da outbox',current_policy_blocked:'Regra atual impediria um novo envio',projection_or_provider_not_confirmed:'Projeção/retorno do provedor ainda não confirmado'};
export function R32ReadyAuditCard(){
 const [id,setId]=useState('');const [state,setState]=useState<Snapshot|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const run=async()=>{
   if(busy)return;
   if(!/^[A-Za-z0-9_-]{8,100}$/.test(id.trim())){setError('Informe o ID interno do pedido (8 a 100 caracteres).');return;}
   setBusy(true);setError('');
   const controller=new AbortController(),timer=window.setTimeout(()=>controller.abort(),12000);
   try{
     const u=auth.currentUser;if(!u)throw Error('Faça login novamente no Admin.');
     const jwt=await u.getIdToken();
     const response=await fetch(`/api/admin/messaging-ready-audit?orderId=${encodeURIComponent(id.trim())}`,{method:'GET',cache:'no-store',signal:controller.signal,headers:{Authorization:`Bearer ${jwt}`}});
     const result=await response.json().catch(()=>null) as Snapshot|null;
     if(!response.ok||result?.ok!==true||!Array.isArray(result.readyIntents)||!Array.isArray(result.readyOutbox))throw Error('Consulta indisponível. Verifique o ID e tente novamente.');
     setState(result);
   }catch(e){setError(e instanceof Error&&e.name==='AbortError'?'Tempo esgotado. Dados anteriores preservados.':e instanceof Error?e.message:'Falha na consulta.');}
   finally{window.clearTimeout(timer);setBusy(false);}
 };
 return <section className={styles.root} aria-label="Auditoria do aviso Pedido Pronto">
  <div className={styles.header}><div><strong>Pedido pronto · rastreio de eventos</strong><p>Por ID interno, confira o pedido, o evento e o motivo do aviso não ter chegado à fila.</p></div><ShieldCheck size={19} aria-hidden="true"/></div>
  <form className={styles.form} onSubmit={e=>{e.preventDefault();void run();}}>
   <label htmlFor="r32-order-id">ID interno do pedido</label><div className={styles.controls}>
    <input id="r32-order-id" value={id} onChange={e=>setId(e.target.value)} placeholder="Cole o ID do pedido" autoComplete="off" maxLength={100}/>
    <button type="submit" disabled={busy}><Search size={15}/>{busy?'Consultando…':'Investigar'}</button>
   </div>
  </form>
  {error&&<p className={styles.error} role="alert"><AlertCircle size={15}/>{error}</p>}
  {state&&<div className={styles.result} role="status">
   <p className={styles.verdict}><strong>{pretty[state.reason]||'Diagnóstico disponível'}</strong> · Estado atual: {state.commercialStatus||'indisponível'}</p>
   <div className={styles.summary}>
    <span>Consentimento: {state.consentGranted&&state.consentTimestampPresent?'registrado':'ausente/incompleto'}</span>
    <span>Telefone: {state.phonePresent?'cadastrado':'ausente'}</span>
    <span>Regra atual: {state.gateReason||'sem bloqueio detectado'}</span>
   </div>
   <div className={styles.groups}>
    <div><b>Outbox — Pronto ({state.readyOutbox.length})</b>{state.readyOutbox.length?state.readyOutbox.map((v,i)=><p key={i}>{v.eventRef||'Evento'} · {v.state||'A verificar'} · {v.stage||'Pronto'}</p>):<small>Nenhum evento encontrado na amostra.</small>}</div>
    <div><b>Mensageria ({state.readyIntents.length})</b>{state.readyIntents.length?state.readyIntents.map((v,i)=><p key={i}>{v.sourceEventRef||'Evento'} · {v.state||'A verificar'} {v.reason?`· ${v.reason}`:''}</p>):<small>Nenhuma intenção na amostra.</small>}</div>
   </div>
   <p className={styles.footnote}>{state.sampleLimited?'Amostra limitada: existem outros registros. ':''}Queued não significa entregue. Este painel não envia mensagens nem revela números de telefone.</p>
  </div>}
 </section>;
}
