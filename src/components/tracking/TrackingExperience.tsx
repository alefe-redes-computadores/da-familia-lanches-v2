'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { CheckCircle2, Clock3, LockKeyhole, PackageCheck, RefreshCw, ShieldAlert, Truck, WifiOff, ChefHat, Bike, House, CalendarClock, ClipboardCheck, CircleAlert, XCircle, Route, ShoppingBag } from 'lucide-react';
import styles from './TrackingExperience.module.css';

type State = {contract:'dfl.tracking.public';version:1;order:{label:string;origin_label:string;fulfillment:'delivery'|'pickup'};status:string;as_of:string;freshness:string;timeline:{id:string;kind:string;title:string;at:string}[];progress:null|{status:'verified';current_stop_number:number|null;planned_customer_stop_number:number|null;total_physical_stops:number;stops_ahead:number|null;is_next_stop:boolean};courier:{first_name:string}|null;terminal:boolean};
const titles:Record<string,string>={received:'Pedido recebido',scheduled:'Pedido agendado',confirmed:'Pedido confirmado',preparing:'Em preparação',ready:'Pedido pronto',assigned:'Organizado para entrega',out_for_delivery:'Seu pedido saiu para entrega',next_stop:'Você é a próxima parada',delivered:'Pedido entregue',delivery_issue:'Precisamos verificar sua entrega',cancelled:'Pedido cancelado'};
const humanTime=(v:string)=>{const d=new Date(v);return Number.isNaN(d.getTime())?'':d.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})};
// Never invent a commercial order number, leak a long technical ID, or truncate one.
// Short verified labels pass through unchanged; otherwise show a neutral label.
const friendlyOrderLabel=(label:string)=>/^#[A-Za-z0-9-]{1,12}$/.test(label)?`Pedido ${label}`:'Seu pedido';

/** R48: visual-only projection: never change a ledger event or infer a commercial status. */
const R48_STEPS=[
  {label:'Recebido',kinds:['received']},
  {label:'Aceito',kinds:['confirmed']},
  {label:'Em preparo',kinds:['preparing']},
  {label:'Pronto',kinds:['ready']},
  {label:'Saiu para entrega',kinds:['out_for_delivery','next_stop']},
  {label:'Entregue',kinds:['delivered']},
] as const;
const r48CurrentStep=(status:string):number=>{
  if(status==='delivered')return 5;
  if(status==='out_for_delivery'||status==='next_stop')return 4;
  if(status==='ready')return 3;
  if(status==='preparing')return 2;
  if(status==='confirmed')return 1;
  if(status==='received'||status==='scheduled')return 0;
  return -1; // assigned/cancelled/incident must not fabricate a kitchen step
};
const r48RouteStatus=(status:string)=>['out_for_delivery','next_stop','delivery_issue','assigned'].includes(status);
/** Two near-identical creation receipts: collapse in presentation only. */
const r48VisibleTimeline=(events:State['timeline']):State['timeline']=>{
  const received:number[]=[];
  return events.filter(e=>{
    if(e.kind!=='received')return true;
    const at=Date.parse(e.at);
    if(!Number.isFinite(at))return true;
    if(received.some(v=>Math.abs(v-at)<=120000))return false;
    received.push(at);
    return true;
  });
};

const eventIcons:Record<string,typeof CheckCircle2>={
  received:ShoppingBag,scheduled:CalendarClock,confirmed:ClipboardCheck,
  preparing:ChefHat,ready:PackageCheck,assigned:Route,
  out_for_delivery:Bike,reorganized:Route,next_stop:Bike,
  delivered:House,delivery_issue:CircleAlert,cancelled:XCircle,
};
export function TrackingExperience(){
  const [state,setState]=useState<State|null>(null);
  const [phase,setPhase]=useState<'loading'|'ready'|'denied'|'no-link'|'offline'|'logout-error'>('loading');
  const [busy,setBusy]=useState(false);
  const initializing = useRef(true);
  // A URL publica, sem token, nao e um erro de pedido nem uma sessao revogada.
  const noTokenAtEntry = useRef(false);
  const hasOpenedSession = useRef(false);
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
      if(!response.ok){setState(null);setPhase(response.status===401||response.status===404?(noTokenAtEntry.current&&!hasOpenedSession.current?'no-link':'denied'):'offline');return;}
      const data: State = await response.json();
      if(currentEpoch !== epoch.current) return;
      if(data.contract!=='dfl.tracking.public'||data.version!==1){setState(null);setPhase('offline');return;}
      hasOpenedSession.current=true;
      setState(data);setPhase('ready');
    }catch{if(currentEpoch===epoch.current){setState(null);setPhase('offline')}}
  },[]);
  useEffect(()=>{
    let cancelled=false;
    // Classify the entry URL before the async launch. R263 runs launch isolated.
    noTokenAtEntry.current = window.location.hash === '';
    const launch=async()=>{
      const token=window.location.hash.startsWith('#t=')?window.location.hash.slice(3):'';
      if(window.location.hash) window.history.replaceState(null,'',window.location.pathname+window.location.search);
      if(token){
        // A new link must never reuse a previous order's cookie.
        try {
          const revoked = await fetch('/acompanhar/api/session/revoke',{method:'POST',headers:{'content-type':'application/json'},body:'{}',credentials:'same-origin',cache:'no-store'});
          if(!revoked.ok){if(!cancelled){setState(null);setPhase('denied')}return;}
        }catch{if(!cancelled){setState(null);setPhase('offline')}return;}
        // A superseded effect must not exchange the token after an asynchronous revoke.
        if(cancelled)return;
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
  const r48Timeline=state?r48VisibleTimeline(state.timeline):[];
  const r48Active=state?r48CurrentStep(state.status):-1;
  const r48Observed=new Set((state?.timeline||[]).map(e=>e.kind));
  return <div className={styles.page}><main className={styles.wrap}>
    <header className={styles.header}><span className={styles.brand}>DFL <span>DA FAMÍLIA LANCHES</span></span><span className={styles.private}><LockKeyhole size={14}/> Acesso protegido</span></header>
    <div className={styles.title}><p>ACOMPANHAMENTO</p><h1>Seu pedido, passo a passo</h1><span>Acompanhe cada etapa do seu pedido, diretamente da Da Família Lanches.</span></div>
    {phase==='ready'&&state?<>
      <section className={styles.hero} aria-live="polite"><span className={styles.label}>{friendlyOrderLabel(state.order.label)} · {state.order.origin_label}</span><div className={styles.heroTitle}><span className={styles.circle}>{(()=>{const Icon=eventIcons[state.status]||PackageCheck;return <Icon size={26}/>})()}</span><h2>{titles[state.status]||'Acompanhamento do pedido'}</h2></div><p>{stale?(r48RouteStatus(state.status)?'Estamos confirmando as informações da rota.':'Aguardando uma nova atualização da loja. Confira as etapas confirmadas.'):state.status==='out_for_delivery'?'Sua entrega foi despachada e está seguindo o percurso confirmado.':state.status==='assigned'?'Seu pedido está organizado para uma rota. Isso ainda não significa que saiu da loja.':'Acompanhe os próximos acontecimentos confirmados.'}</p>{state.courier&&!state.terminal&&<p className={styles.courier}>Entregador: {state.courier.first_name}</p>}</section>
      <section className={styles.journey} aria-label="Etapas do pedido">
        <div className={styles.journeyHeading}><h2>Etapas do pedido</h2><span>Atualizado conforme eventos confirmados</span></div>
        <ol className={styles.journeyGrid}>
          {R48_STEPS.map((step,i)=>{
            const observed=step.kinds.some(k=>r48Observed.has(k));
            const current=i===r48Active&&state.status!=='delivered';
            const mode=current?'current':observed?'done':'waiting';
            return <li key={step.label} data-step-state={mode} aria-current={current?'step':undefined}>
              <span className={styles.stageSymbol}>{mode==='done'?<CheckCircle2 size={17}/>:<span>{i+1}</span>}</span>
              <strong>{step.label}</strong>
              <small>{current?'Etapa atual':mode==='done'?'Confirmado':'Aguardando'}</small>
            </li>;
          })}
        </ol>
      </section>
      {state.progress&&state.status==='out_for_delivery'&&!stale&&<section className={styles.progress}><div><span className={styles.label}>PARADAS ANTES DA SUA</span><strong>{state.progress.stops_ahead}</strong><small>{state.progress.is_next_stop?'Sua parada é a próxima pendente.':'Posição verificada pela operação, sujeita a alterações.'}</small></div><span className={styles.circle}><Truck size={22}/></span></section>}
      {stale&&<div className={styles.warning}><Clock3 size={18}/>{r48RouteStatus(state.status)?'Informações da rota em atualização. A posição pode mudar.':'Última informação da loja ainda sem atualização recente.'}</div>}
      <section className={styles.timeline}><h2>Histórico confirmado</h2><ol>{r48Timeline.map((item,i)=><li key={item.id} data-kind={item.kind} data-current={item.kind===state.status?'true':'false'}><span className={styles.dot}>{(()=>{const Icon=eventIcons[item.kind]||CheckCircle2;return <Icon size={16}/>})()}</span><div><strong>{item.title}</strong><time dateTime={item.at}>{humanTime(item.at)}</time></div></li>)}</ol>{!state.timeline.length&&<p>Aguardando o primeiro acontecimento confirmado.</p>}</section>
      <div className={styles.footline}><Clock3 size={15}/> Última atualização confirmada: {humanTime(state.as_of)}</div>
      <div className={styles.actions}><button onClick={()=>void refresh()} disabled={busy}><RefreshCw size={17}/>{busy?'Atualizando…':'Atualizar'}</button><button onClick={()=>void close()} className={styles.secondary}>Encerrar acesso</button></div>
    </>:<section className={styles.empty} aria-live="polite"><span className={styles.circle}>{phase==='offline'?<WifiOff size={25}/>:phase==='denied'?<ShieldAlert size={25}/>:phase==='no-link'?<LockKeyhole size={25}/>:<Clock3 size={25}/>}</span><h2>{phase==='loading'?'Conectando com segurança…':phase==='denied'?'Link inválido ou acesso encerrado':phase==='no-link'?'Como acompanhar seu pedido':phase==='logout-error'?'Encerramento não confirmado':'Acompanhamento indisponível'}</h2><p>{phase==='loading'?'Conferindo sua sessão.':phase==='denied'?'O acesso pode ter expirado ou sido encerrado. Solicite um novo link à equipe.':phase==='no-link'?'Para acompanhar, abra o link completo recebido pelo WhatsApp. Se ainda não recebeu, consulte Meus pedidos pelo cardápio.':phase==='logout-error'?'Não foi possível confirmar o encerramento. Seus dados estão ocultos; tente novamente quando a conexão voltar.':'Não foi possível atualizar agora. Sua compra não foi alterada.'}</p>{phase==='no-link'&&<button onClick={()=>window.location.assign('/')}><ShoppingBag size={17}/>Ver cardápio e pedidos</button>}{phase!=='loading'&&phase!=='no-link'&&<button onClick={()=>void (phase==='logout-error'?close():refresh())} disabled={busy||closingRequest.current}><RefreshCw size={17}/>{busy?'Tentando…':phase==='logout-error'?'Tentar encerrar novamente':'Tentar novamente'}</button>}</section>}
    <footer className={styles.footer}>Seu acompanhamento é privado. Não compartilhe o link de acesso. <a href="/">Voltar ao cardápio</a></footer>
  </main></div>;
}
