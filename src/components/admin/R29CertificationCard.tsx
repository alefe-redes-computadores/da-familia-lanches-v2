'use client';
/** R29 — safe server-side preflight. Nothing on this card can dispatch WhatsApp. */
import {useState} from 'react';
import {Activity,CheckCircle2,LockKeyhole,RefreshCw,ShieldAlert} from 'lucide-react';
import {auth} from '@/lib/firebase';
import styles from './R29CertificationCard.module.css';
type Check={id:string;label:string;state:'configured'|'off'|'unknown'};
type ReleaseGate={status:'blocked'|'ready_for_isolated_canary'|'unsafe_remote_enabled';
  transportAuthenticated:boolean;providerConfigured:boolean;remoteSendDisabled:boolean;
  siteWorkerDisabled:boolean;customerDeliveryVerified:false;siteDispatchAuthorized:false;
  blockers:{code:string;label:string}[];nextAction:string};
type Snapshot={ok:true;checkedAt:string;checks:Check[];releaseGate:ReleaseGate;
  receiver:{state:'not_checked'|'reachable'|'authenticated'|'unauthorized'|'unavailable'|'invalid_reply';providerConfigured:boolean|null;deliveryEnabled:boolean|null};
  orderRead:false;tokenIssued:false;providerSend:false;dbWrite:false;customerDeliveryVerified:false;
  release:'requires_end_to_end_canary_homologation';note:string};
const receiverLabel:Record<Snapshot['receiver']['state'],string>={
  not_checked:'Não consultado',reachable:'Função acessível, autenticação ainda não testada',
  authenticated:'Autenticação do receptor validada',unauthorized:'Credenciais divergentes',
  unavailable:'Receptor indisponível ou bloqueado',invalid_reply:'Contrato inesperado',
};
export function R29CertificationCard(){
  const [data,setData]=useState<Snapshot|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const run=async()=>{
    if(busy)return;
    setBusy(true);setError('');
    const controller=new AbortController(),timer=window.setTimeout(()=>controller.abort(),11000);
    try{
      const user=auth.currentUser;
      if(!user)throw new Error('Faça login novamente no Admin.');
      const jwt=await user.getIdToken();
      const res=await fetch('/api/admin/dfl360-certification?probe=1',{
        method:'GET',cache:'no-store',signal:controller.signal,
        headers:{Authorization:`Bearer ${jwt}`},
      });
      const json=await res.json().catch(()=>null) as Snapshot|null;
      if(!res.ok||json?.ok!==true||!Array.isArray(json.checks)||!json.releaseGate)throw new Error('Pré-voo indisponível. Confira o acesso ao servidor.');
      setData(json);
    }catch(e){setError(e instanceof Error&&e.name==='AbortError'?'Consulta excedeu o prazo; nenhum envio foi iniciado.':e instanceof Error?e.message:'Falha na consulta.');}
    finally{window.clearTimeout(timer);setBusy(false);}
  };
  return <section className={styles.root} aria-label="Homologação P9 sem envio">
    <div className={styles.head}>
      <div><span className={styles.eyebrow}><Activity size={14}/> R29 · Pré-voo seguro</span>
        <h4>Certificação do acompanhamento</h4>
        <p>Conferência do Site e do receptor Supabase sem gerar link nem disparar mensagem.</p></div>
      <button type="button" onClick={()=>void run()} disabled={busy} aria-busy={busy}>
        <RefreshCw size={16} aria-hidden="true"/>{busy?'Verificando…':'Verificar integração'}
      </button>
    </div>
    {error&&<p role="alert" className={styles.error}><ShieldAlert size={15}/>{error}</p>}
    {data?<>
      <p className={styles.info} role="status"><LockKeyhole size={15}/>Receptor: {receiverLabel[data.receiver.state]}. {data.receiver.providerConfigured===true?'Evolution configurada no receptor.':data.receiver.providerConfigured===false?'Evolution incompleta no receptor.':''}</p>
      <section className={styles.release} aria-label="Situação para homologação" data-gate={data.releaseGate.status}>
        <strong>{data.releaseGate.status==='unsafe_remote_enabled'?'Atenção: receptor habilitado sem certificação':
          data.releaseGate.status==='ready_for_isolated_canary'?'Transporte preparado para canário isolado':'Automação bloqueada até completar a homologação'}</strong>
        <span>{data.releaseGate.nextAction}</span>
        <div className={styles.releaseSteps}>
          <span>Conexão S2S: {data.releaseGate.transportAuthenticated?'Autenticada':'Pendente'}</span>
          <span>API Evolution: {data.releaseGate.providerConfigured?'Configurada':'Não comprovada'}</span>
          <span>Disparos do Site: {data.releaseGate.siteWorkerDisabled?'OFF':'Revisar flags'}</span>
          <span>Envio do receptor: {data.releaseGate.remoteSendDisabled?'OFF confirmado':'Não comprovado / atenção'}</span>
        </div>
        <ul>{data.releaseGate.blockers.slice(0,6).map(x=><li key={x.code}>{x.label}</li>)}</ul>
        <small>Sem certificação de cliente, sem emissão de token e sem autorização para disparos.</small>
      </section>
      <div className={styles.checks}>
        {data.checks.map(x=><div className={styles.check} key={x.id}>
          <span>{x.label}</span><strong data-state={x.state}>{x.state==='configured'?'Configurado':x.state==='unknown'?'A homologar':'OFF / pendente'}</strong>
        </div>)}
      </div>
      <p className={styles.footer}><CheckCircle2 size={14}/>Nenhuma mensagem enviada ou token emitido por esta verificação. Provedor configurado ≠ mensagem entregue. Homologação real por canário ainda obrigatória.</p>
      <small className={styles.timestamp}>Consultado em {new Date(data.checkedAt).toLocaleString('pt-BR')}</small>
    </>:<p className={styles.hint}>Conferência manual e sem alteração das permissões. O botão não ativa a automação.</p>}
  </section>;
}
