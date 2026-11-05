'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { CheckCircle2, Clock3, LockKeyhole, PackageCheck, RefreshCw, ShieldAlert, Truck, WifiOff } from 'lucide-react';
import styles from './TrackingExperience.module.css';

type State = {contract:'dfl.tracking.public';version:1;order:{label:string;origin_label:string;fulfillment:'delivery'|'pickup'};status:string;as_of:string;freshness:string;timeline:{id:string;kind:string;title:string;at:string}[];progress:null|{status:'verified';current_stop_number:number|null;planned_customer_stop_number:number|null;total_physical_stops:number;stops_ahead:number|null;is_next_stop:boolean};courier:{first_name:string}|null;terminal:boolean};
const titles:Record<string,string>={received:'Pedido recebido',scheduled:'Pedido agendado',confirmed:'Pedido confirmado',preparing:'Em preparação',ready:'Pedido pronto',assigned:'Organizado para entrega',out_for_delivery:'Seu pedido saiu para entrega',next_stop:'Você é a próxima parada',delivered:'Pedido entregue',delivery_issue:'Precisamos verificar sua entrega',cancelled:'Pedido cancelado'};
const humanTime=(v:string)=>{const d=new Date(v);return Number.isNaN(d.getTime())?'':d.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})};
export function TrackingExperience(){
  const [state,setState]=useState<State|null>(null);
  const [phase,setPhase]=useState<'loading'|'ready'|'denied'|'offline'|'logout-error'>('loading');
  const [busy,setBusy]=useState(false);
  const initializing = useRef(true);
  const epoch = useRef(0);
  const closing = useRef(false);
  const closingRequest = useRef(false);
  const check=useCallback(async()=>{
    if(initializing.current || closing.current) return;
    const currentEpoch = ++epoch.current;
    if(document.visibilityState!=='visible'||!navigator.onLine){setState(null);setPhase('offline');return;}
    try{
      const response=await fetch('/acompanhar/api/status',{cache:'no-store',credentials:'same-origin'});
      if(currentEpoch !== epoch.current) return;
      if(!response.ok){setState(null);setPhase(response.status===401||response.status===404?'denied':'offline');return;}
      const data: State = await response.json();
      if(currentEpoch !== epoch.current) return;
      if(data.contract!=='dfl.tracking.public'||data.version!==1){setState(null);setPhase('offline');return;}
      setState(data);setPhase('ready');
    }catch{if(currentEpoch===epoch.current){setState(null);setPhase('offline')}}
  },[]);
  useEffect(()=>{
    let cancelled=false;
    const launch=async()=>{
      const token=window.location.hash.startsWith('#t=')?window.location.hash.slice(3):'';
      if(window.location.hash) window.history.replaceState(null,'',window.location.pathname+window.location.search);
      if(token){
        // A new link must never reuse a previous order's cookie.
        try { await fetch('/acompanhar/api/session/revoke',{method:'POST',headers:{'content-type':'application/json'},body:'{}',credentials:'same-origin',cache:'no-store'}); } catch {}
        if(!/^[A-Za-z0-9_-]{43}$/.test(token)){setPhase('denied');return;}
        try{
          const result=await fetch('/acompanhar/api/session',{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',cache:'no-store',body:JSON.stringify({token})});
          if(!result.ok){if(!cancelled){setState(null);setPhase('denied')}return;}
        }catch{if(!cancelled){setState(null);setPhase('offline')}return;}
      }
      initializing.current=false;
      if(!cancelled)await check();
    };
    void launch();
    return()=>{cancelled=true};
  },[check]);
  useEffect(()=>{
    const visible=()=>{if(closing.current)return;if(document.visibilityState==='visible')void check();else{epoch.current++;setState(null);setPhase('loading')}};
    const online=()=>{void check()};
    const timer=window.setInterval(()=>{if(document.visibilityState==='visible'&&navigator.onLine)void check()},30000);
    document.addEventListener('visibilitychange',visible);window.addEventListener('online',online);window.addEventListener('offline',online);
    const pageshow=()=>{if(closing.current)return;epoch.current++;setState(null);setPhase('loading');void check()};
    window.addEventListener('pageshow',pageshow);
    return()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',visible);window.removeEventListener('online',online);window.removeEventListener('offline',online);window.removeEventListener('pageshow',pageshow)};
  },[check]);
  const refresh=async()=>{if(busy)return;setBusy(true);await check();setBusy(false)};
  const close=async()=>{
    if(closingRequest.current)return;
    closingRequest.current=true;
    closing.current=true;
    epoch.current++;
    setState(null);setPhase('loading');
    try{
      const response=await fetch('/acompanhar/api/session/revoke',{
        method:'POST',headers:{'content-type':'application/json'},body:'{}',
        credentials:'same-origin',cache:'no-store',
      });
      if(!response.ok)throw new Error('TRACKING_REVOKE_UNCONFIRMED');
      setPhase('denied');
    }catch{
      // Never assert a successful logout on network/HTTP failure.
      // Do not restore tracking data while the session may still be active.
      setPhase('logout-error');
    }finally{
      closingRequest.current=false;
    }
  };
  const stale=state?.freshness!=='fresh';
  return <div className={styles.page}><main className={styles.wrap}>
    <header className={styles.header}><span className={styles.brand}>DFL <span>DA FAMÍLIA LANCHES</span></span><span className={styles.private}><LockKeyhole size={14}/> Acesso protegido</span></header>
    <div className={styles.title}><p>ACOMPANHAMENTO</p><h1>Acompanhe seu pedido</h1><span>Informações verificadas pela nossa equipe de entregas.</span></div>
    {phase==='ready'&&state?<>
      <section className={styles.hero} aria-live="polite"><span className={styles.label}>{state.order.label} · {state.order.origin_label}</span><div className={styles.heroTitle}><span className={styles.circle}><Truck size={26}/></span><h2>{titles[state.status]||'Acompanhamento do pedido'}</h2></div><p>{stale?'Estamos atualizando o andamento da rota.':state.status==='out_for_delivery'?'Sua entrega foi despachada e está seguindo o percurso confirmado.':state.status==='assigned'?'Seu pedido está organizado para uma rota. Isso ainda não significa que saiu da loja.':'Acompanhe os próximos acontecimentos confirmados.'}</p>{state.courier&&!state.terminal&&<p className={styles.courier}>Entregador: {state.courier.first_name}</p>}</section>
      {state.progress&&state.status==='out_for_delivery'&&!stale&&<section className={styles.progress}><div><span className={styles.label}>PARADAS ANTES DA SUA</span><strong>{state.progress.stops_ahead}</strong><small>{state.progress.is_next_stop?'Sua parada é a próxima pendente.':'Posição verificada pela operação, sujeita a alterações.'}</small></div><span className={styles.circle}><Truck size={22}/></span></section>}
      {stale&&<div className={styles.warning}><Clock3 size={18}/> Estamos atualizando o andamento da rota.</div>}
      <section className={styles.timeline}><h2>Histórico confirmado</h2><ol>{state.timeline.map((item,i)=><li key={item.id}><span className={styles.dot}>{i===state.timeline.length-1?<PackageCheck size={16}/>:<CheckCircle2 size={16}/>}</span><div><strong>{item.title}</strong><time dateTime={item.at}>{humanTime(item.at)}</time></div></li>)}</ol>{!state.timeline.length&&<p>Aguardando o primeiro acontecimento confirmado.</p>}</section>
      <div className={styles.footline}><Clock3 size={15}/> Última atualização confirmada: {humanTime(state.as_of)}</div>
      <div className={styles.actions}><button onClick={()=>void refresh()} disabled={busy}><RefreshCw size={17}/>{busy?'Atualizando…':'Atualizar'}</button><button onClick={()=>void close()} className={styles.secondary}>Encerrar acesso</button></div>
    </>:<section className={styles.empty} aria-live="polite"><span className={styles.circle}>{phase==='offline'?<WifiOff size={25}/>:phase==='denied'?<ShieldAlert size={25}/>:<Clock3 size={25}/>}</span><h2>{phase==='loading'?'Conectando com segurança…':phase==='denied'?'Link inválido ou acesso encerrado':phase==='logout-error'?'Encerramento não confirmado':'Acompanhamento indisponível'}</h2><p>{phase==='loading'?'Conferindo sua sessão.':phase==='denied'?'Confira seu link ou solicite um novo acesso à equipe.':phase==='logout-error'?'Não foi possível confirmar o encerramento. Seus dados estão ocultos; tente novamente quando a conexão voltar.':'Não foi possível atualizar agora. Sua compra não foi alterada.'}</p>{phase!=='loading'&&<button onClick={()=>void (phase==='logout-error'?close():refresh())} disabled={busy||closingRequest.current}><RefreshCw size={17}/>{busy?'Tentando…':phase==='logout-error'?'Tentar encerrar novamente':'Tentar novamente'}</button>}</section>}
    <footer className={styles.footer}>Seu acompanhamento é privado. Não compartilhe o link de acesso. <a href="/">Voltar ao cardápio</a></footer>
  </main></div>;
}
