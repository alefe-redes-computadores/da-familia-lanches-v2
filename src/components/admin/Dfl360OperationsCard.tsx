'use client';
import {useState} from 'react';
import {AlertTriangle,CheckCircle2,ClipboardList,RefreshCw,ShieldCheck,Truck} from 'lucide-react';
import {auth} from '@/lib/firebase';
import styles from './Dfl360OperationsCard.module.css';

type Counts={pending:number;processing:number;acknowledged:number;review:number;suppressed:number;queued:number;other:number};
type Lane={available:boolean;sample:number;truncated:boolean;counts:Counts};
type Snapshot={ok:true;checkedAt:string;sampleLimit:number;degraded:boolean;
  lanes:{messages:Lane;acceptances:Lane;tracking_links:Lane};
  flags:{publicTracking:boolean;siteAcceptance:boolean;initialIssue:boolean;providerCertified:boolean;manualMessaging:boolean;messageWorkerConfigured:boolean};
  certification:'requires_end_to_end_homologation';providerDeliveryVerified:false;note:string};
const fmt=(n:number)=>new Intl.NumberFormat('pt-BR').format(n);
const lanes=[
  {key:'messages',label:'Avisos',subtitle:'Fila de comunicação',icon:ClipboardList},
  {key:'acceptances',label:'Aceites',subtitle:'Site → Entregas',icon:Truck},
  {key:'tracking_links',label:'Acompanhamento',subtitle:'Links iniciais P9',icon:ShieldCheck},
] as const;
export function Dfl360OperationsCard(){
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const inspect=async()=>{
    if(loading)return;
    setLoading(true);setError('');
    const controller=new AbortController();
    const timeout=window.setTimeout(()=>controller.abort(),10000);
    try{
      const user=auth.currentUser;
      if(!user)throw new Error('Entre novamente na conta administrativa.');
      const token=await user.getIdToken();
      const response=await fetch('/api/admin/dfl360-operations',{
        method:'GET',cache:'no-store',signal:controller.signal,
        headers:{Authorization:`Bearer ${token}`},
      });
      const data=await response.json().catch(()=>null) as Snapshot|null;
      if(!response.ok||data?.ok!==true||!data.lanes||!data.flags)throw new Error('Diagnóstico indisponível. Tente novamente.');
      setSnapshot(data);
    }catch(e){setError(e instanceof Error&&e.name==='AbortError'
      ?'A consulta excedeu o prazo. Os últimos dados foram preservados.'
      : e instanceof Error?e.message:'Não foi possível carregar.');}
    finally{window.clearTimeout(timeout);setLoading(false);}
  };
  return <section className={styles.root} aria-label="Monitoramento DFL 360">
    <div className={styles.head}>
      <div><span className={styles.eyebrow}>DFL 360 · Operação integrada</span>
        <h4>Aceites, mensagens e acompanhamento</h4>
        <p>Consulte as três filas sem enviar WhatsApp, gerar links ou alterar pedidos.</p></div>
      <button type="button" onClick={()=>void inspect()} disabled={loading} aria-busy={loading}>
        <RefreshCw size={15} aria-hidden="true" /> {loading?'Consultando…':snapshot?'Atualizar diagnóstico':'Conferir filas'}
      </button>
    </div>
    {error&&<p role="alert" className={styles.alert}><AlertTriangle size={15} aria-hidden="true" />{error}</p>}
    {!snapshot&&<p className={styles.hint}>Sem consultas automáticas. Toque em “Conferir filas” quando quiser verificar o estado operacional.</p>}
    {snapshot&&<>
      <div className={styles.grid}>
        {lanes.map(({key,label,subtitle,icon:Icon})=>{
          const lane=snapshot.lanes[key];const c=lane.counts;
          return <div className={styles.lane} key={key}>
            <div className={styles.laneTitle}><Icon size={17} aria-hidden="true"/><div><strong>{label}</strong><span>{subtitle}</span></div></div>
            {!lane.available?<p className={styles.bad}>Leitura indisponível</p>:<>
              <div className={styles.stats}>
                <span><b>{fmt(c.pending+c.processing)}</b> Aguardando</span>
                <span><b>{fmt(c.review)}</b> Revisar</span>
                <span><b>{fmt(c.acknowledged+c.queued)}</b> Aceitos na etapa</span>
              </div>
              <small>Amostra: {lane.sample}/{snapshot.sampleLimit}{lane.truncated?' · há mais registros':''}
                {c.suppressed>0?` · ${c.suppressed} bloqueados`:''}</small>
            </>}
          </div>;
        })}
      </div>
      <div className={styles.footer}>
        <div className={styles.signal}><CheckCircle2 size={16} aria-hidden="true"/>
          <span>Consulta somente leitura · {new Date(snapshot.checkedAt).toLocaleString('pt-BR')}</span></div>
        <p><strong>WhatsApp automático:</strong> {snapshot.flags.publicTracking&&snapshot.flags.siteAcceptance&&snapshot.flags.initialIssue&&snapshot.flags.providerCertified?'Flags do Site configuradas — homologação real ainda necessária':'Etapas automáticas desabilitadas ou incompletas no Site'}.
          {' '}Recibo do provedor não prova entrega ao cliente.</p>
        {snapshot.degraded&&<p className={styles.bad}>Uma ou mais filas não puderam ser consultadas. Os números disponíveis são parciais.</p>}
      </div>
    </>}
  </section>;
}
