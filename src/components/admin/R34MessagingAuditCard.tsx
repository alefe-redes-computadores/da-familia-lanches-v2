'use client';
/** R34 — manual audit only; no polling, triggers or replay controls. */
import {useState} from 'react';
import {Activity,Search,ShieldCheck,AlertCircle} from 'lucide-react';
import {auth} from '@/lib/firebase';
import {R34_EVENTS,r34ValidQuery,type R34AuditData,type R34Event,type R34Source} from '@/lib/messaging/r34AuditPolicy';
import styles from './R34MessagingAuditCard.module.css';
const types=[['all','Todos os eventos'],['order.created','Pedido cadastrado'],['order.ready','Pronto'],['delivery.started','Saiu para entrega'],['delivery.next_stop','Próxima parada'],['delivery.completed','Concluído']] as const;
const titles:Record<string,string>={pending:'Aguardando worker',processing:'Processando',sent:'Aceito pelo provedor',failed:'Falhou',dead_letter:'Revisão necessária',suppressed:'Suprimido',unknown:'A verificar'};
export function R34MessagingAuditCard(){
 const [source,setSource]=useState<R34Source>('site');
 const [orderId,setOrderId]=useState('');
 const [eventType,setEventType]=useState<R34Event>('all');
 const [data,setData]=useState<R34AuditData|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const run=async()=>{
  if(busy)return;
  const normalized=source==='manual'&&/^dfl-[A-Za-z0-9-]{12,120}$/.test(orderId.trim())?`entregas:${orderId.trim()}`:orderId.trim();
  const query={source,orderId:normalized,eventType};
  if(!r34ValidQuery(query)){setError('Confira a origem e o ID interno. Para pedido manual, use dfl-* ou entregas:dfl-*.');return;}
  setBusy(true);setError('');setData(null);
  const controller=new AbortController(),timer=window.setTimeout(()=>controller.abort(),10000);
  try{
   const user=auth.currentUser;if(!user)throw new Error('Faça login novamente no Admin.');
   const jwt=await user.getIdToken();
   const qs=new URLSearchParams({source,orderId:normalized,eventType}).toString();
   const res=await fetch(`/api/admin/messaging-360-audit?${qs}`,{method:'GET',cache:'no-store',signal:controller.signal,headers:{Authorization:`Bearer ${jwt}`}});
   const body=await res.json().catch(()=>null) as R34AuditData|null;
   if(!res.ok||body?.ok!==true||!Array.isArray(body.records))throw new Error('Auditoria indisponível. Confira a autorização entre Site e Supabase.');
   setData(body);
  }catch(e){setError(e instanceof Error&&e.name==='AbortError'?'Consulta excedeu o tempo; nenhuma mensagem foi processada.':e instanceof Error?e.message:'Falha na auditoria.');}
  finally{window.clearTimeout(timer);setBusy(false);}
 };
 return <section className={styles.root} aria-label="R34 Auditoria da fila WhatsApp">
  <div className={styles.head}><div><span className={styles.eyebrow}><Activity size={13}/> DFL 360 · R34</span>
   <h4>Rastreio da fila WhatsApp</h4><p>Confere por pedido os estados registrados no Supabase, sem disparar ou recuperar mensagens.</p></div><ShieldCheck size={19}/></div>
  <form onSubmit={e=>{e.preventDefault();void run();}} className={styles.form}>
   <label>Origem<select value={source} onChange={e=>{setSource(e.target.value as R34Source);setData(null);}}>
    <option value="site">Site</option><option value="manual">Manual (Entregas)</option><option value="entregas">Entregas (logística)</option>
   </select></label>
   <label>Evento<select value={eventType} onChange={e=>{setEventType(e.target.value as R34Event);setData(null);}}>
    {types.map(([value,title])=><option key={value} value={value}>{title}</option>)}
   </select></label>
   <label className={styles.full}>ID do pedido<input value={orderId} onChange={e=>setOrderId(e.target.value)} placeholder={source==='manual'?'dfl-... ou entregas:dfl-...':'ID interno do pedido'} autoComplete="off" maxLength={140}/></label>
   <button type="submit" disabled={busy}><Search size={15}/>{busy?'Consultando…':'Investigar no Supabase'}</button>
  </form>
  {error&&<p role="alert" className={styles.error}><AlertCircle size={15}/>{error}</p>}
  {data&&<div className={styles.report} role="status">
   <p className={styles.summary}><b>{data.records.length}</b> registro(s) encontrado(s){data.sampleLimited?' (amostra limitada)':''} · {data.source==='manual'?'Pedido manual':data.source==='site'?'Pedido do Site':'Evento do Entregas'}</p>
   {data.records.length? <div className={styles.rows}>{data.records.map((m,i)=><div className={styles.entry} key={`${m.fingerprint}-${i}`}>
    <div><strong>{m.eventType}</strong><span className={styles.status} data-state={m.state}>{titles[m.state]||'A verificar'}</span></div>
    <small>Evento #{m.fingerprint} · {m.createdAt?new Date(m.createdAt).toLocaleString('pt-BR'):'Data indisponível'}</small>
    {m.failureCode&&<small>Motivo registrado: {m.failureCode}</small>}
    {m.providerAccepted&&<small>Provedor retornou identificador de aceite (não é confirmação de recebimento).</small>}
   </div>)}</div>:<p className={styles.empty}>Nenhuma entrada encontrada nesta fila para o filtro escolhido. Confira a criação do evento e as supressões no Firestore/Entregas.</p>}
   <p className={styles.foot}>Somente leitura · Nenhum telefone, conteúdo, token ou endereço exibido. “Enviado” significa API aceita; não comprova recebimento ou leitura.</p>
  </div>}
  <small className={styles.footer}>Esta auditoria nunca executa ingest, worker, replay ou WhatsApp.</small>
 </section>;
}
