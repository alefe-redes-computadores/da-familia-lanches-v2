"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { auth } from "@/lib/firebase";
import { normalizarStatus } from "@/lib/orderUtils";
import { operationalAttention, type AdminOrder } from "@/lib/adminOrders";
import { inspectPreopenChecklist } from "@/lib/operationPreopenChecklist";
import { formatShiftReport, inspectShiftReadiness } from "@/lib/operationShiftReadiness";
import { haptic } from "@/lib/haptics";
import styles from "./OperationHealthAdmin.module.css";

type RemoteHealth = {
  checkedAt: string;
  integration: {
    state: "healthy" | "attention" | "quarantine";
    backlog: number;
    quarantine: number;
    outbox: { pending:number; processing:number; failed:number; deadLetter:number };
    messaging: { pending:number; processing:number; rawPending:number; rawProcessing:number; legacyOrIneligible:number; quarantined:number };
  };
};

export function OperationHealthAdmin({ pedidos, historyHasMore }:{pedidos:AdminOrder[];historyHasMore:boolean}) {
  const [remote,setRemote]=useState<RemoteHealth|null>(null);
  const [checking,setChecking]=useState(false);
  const [remoteError,setRemoteError]=useState("");
  // R41: apenas relogio local. Nenhuma consulta automatica ao Firebase/API.
  const [clockMs,setClockMs]=useState(()=>Date.now());
  const [manualChecks,setManualChecks]=useState({storefront:false,catalog:false,hours:false,inbox:false});
  const [copyStatus,setCopyStatus]=useState("");
  useEffect(()=>{
    const timer=window.setInterval(()=>setClockMs(Date.now()),60_000);
    return ()=>window.clearInterval(timer);
  },[]);


  // R36: contagem por etapa a partir de pedidos ja recebidos, sem consultar o banco.
  const stageSummary=useMemo(()=>{
    const stages=["Pendente","Em Produção","Agendado","Pronto","Saiu para Entrega"] as const;
    const counts=new Map<string,number>(stages.map(stage=>[stage,0]));
    for(const order of pedidos){const stage=normalizarStatus(order.status);if(counts.has(stage))counts.set(stage,(counts.get(stage)??0)+1);}
    return stages.map(stage=>({stage,count:counts.get(stage)??0}));
  },[pedidos]);
  const now=Date.now();
  const active=pedidos.filter(order=>["Pendente","Em Produção","Agendado","Pronto","Saiu para Entrega"].includes(normalizarStatus(order.status)));
  const attention=active.filter(order=>Boolean(operationalAttention(order,now)));
  const tracking=active.filter(order=>Boolean(order.deliveryTrackingEvent||order.deliveryTrackingLastEventAt));
  const deferred=active.filter(order=>order.deliveryCommercialProjectionPending===true);

  const checkIntegration=async()=>{
    if(checking)return;
    setChecking(true);setRemoteError("");setClockMs(Date.now());setCopyStatus("");haptic("step");
    try{
      const user=auth.currentUser;
      if(!user)throw new Error("Sessão administrativa indisponível.");
      const token=await user.getIdToken();
      const controller=new AbortController();
      const timeout=window.setTimeout(()=>controller.abort(),10000);
      let response: Response;
      try {
        response=await fetch("/api/admin/operation-health",{cache:"no-store",headers:{Authorization:`Bearer ${token}`},signal:controller.signal});
      } finally { window.clearTimeout(timeout); }
      const data=await response.json().catch(()=>null);
      if(!response.ok||!data?.ok)throw new Error(data?.error||"Falha ao consultar integração.");
      setRemote(data);
      setClockMs(Date.now());
      haptic(data.integration.backlog||data.integration.quarantine?"error":"success");
    }catch(error){
      setRemoteError(error instanceof Error && error.name==="AbortError"
        ? "A consulta demorou demais. Tente novamente com conexão estável."
        : error instanceof Error?error.message:"Falha ao consultar integração.");
      haptic("error");
    }finally{setChecking(false)}
  };

  // DFL-R39-PREOPEN: somente o snapshot já carregado, sem polling ou escrita.
  const preopen=useMemo(()=>inspectPreopenChecklist({
    activeOrders:active.length, attentionOrders:attention.length,
    outboxBacklog:remote?.integration.backlog??null,
    quarantined:remote?.integration.quarantine??null,
    remoteError:Boolean(remoteError),remoteState:remote?.integration.state??null,
  }),[active.length,attention.length,remote,remoteError]);
  const preopenNeedsReview=preopen.filter(item=>item.level!=="ok").length;
  const remoteLabel=!remote?"não consultada":remote.integration.state==="healthy"?"transporte sem pendências detectadas":remote.integration.backlog>0?`${remote.integration.backlog} pendência${remote.integration.backlog===1?"":"s"}`:`${remote.integration.quarantine} em quarentena`;
  // R41: só a verificação humana da Caixa de Entrada confirma o destino.
  const shiftInput = useMemo(()=>({
    activeOrders:active.length,attentionOrders:attention.length,historyHasMore,
    remoteState:remote?.integration.state??null,
    checkedAt:remote?.checkedAt??null,nowMs:clockMs,remoteError:Boolean(remoteError),
    outboxPending:remote?.integration.outbox.pending??null,
    outboxProcessing:remote?.integration.outbox.processing??null,
    outboxFailed:remote?.integration.outbox.failed??null,
    outboxDead:remote?.integration.outbox.deadLetter??null,
    messagingPending:remote?.integration.messaging.pending??null,
    messagingProcessing:remote?.integration.messaging.processing??null,
    messagingQuarantined:remote?.integration.messaging.quarantined??null,
    humanInboxChecked:manualChecks.inbox,
    humanStorefrontChecked:manualChecks.storefront,
    humanCatalogChecked:manualChecks.catalog,
    humanHoursChecked:manualChecks.hours,
  }),[active.length,attention.length,historyHasMore,remote,remoteError,clockMs,manualChecks]);
  const shiftReadiness=useMemo(()=>inspectShiftReadiness(shiftInput),[shiftInput]);
  const copyShiftReport=async()=>{
    setCopyStatus("");
    try {
      if(!navigator.clipboard?.writeText) throw new Error("Clipboard indisponivel");
      await navigator.clipboard.writeText(formatShiftReport(shiftInput,shiftReadiness));
      setCopyStatus("Relatório sem dados pessoais copiado.");haptic("success");
    } catch {
      setCopyStatus("Não foi possível copiar. Confira a permissão de área de transferência.");haptic("error");
    }
  };

  return <section className={styles.root} data-attention={attention.length>0}>
    <header>
      <div className={styles.healthIcon}>{attention.length?<TriangleAlert size={19}/>:<Activity size={19}/>}</div>
      <div className={styles.headCopy}>
        <span>SAÚDE DA OPERAÇÃO</span>
        <strong>{attention.length?`${attention.length} pedido${attention.length===1?"":"s"} precisa${attention.length===1?"":"m"} de atenção`:"Fila operacional sem alertas locais"}</strong>
        <small>A fila usa dados já carregados. A integração só é consultada quando você pedir.</small>
      </div>
      <b className={styles.activeCount}>{active.length}</b>
    </header>

    <div className={styles.metrics}>
      {[
        [attention.length,"atenção"],
        [tracking.length,"com tracking"],
        [deferred.length,"projeções aguardando etapa"],
        [historyHasMore?"…":"OK",historyHasMore?"histórico paginado":"histórico carregado"],
      ].map(([value,label])=><div key={String(label)}><b>{value}</b><small>{label}</small></div>)}
    </div>

    <div className={styles.r36StagePulse} aria-label="Distribuicao por etapa dos pedidos carregados">
      <strong>Fila por etapa <small>apenas pedidos ja carregados</small></strong>
      <div>{stageSummary.map(item=><span key={item.stage}><b>{item.count}</b>{item.stage}</span>)}</div>
    </div>
    <section className={styles.r39Preopen} aria-label="Conferência operacional pré-abertura">
      <header><div><strong>Checklist pré-abertura</strong><small>Conferência de fila e integração. Dados de clientes não são exibidos.</small></div><b>{preopenNeedsReview===0?"Sem alertas consultados":`${preopenNeedsReview} ponto(s) para conferir`}</b></header>
      <div className={styles.r39PreopenChecks}>{preopen.map(item=><article key={item.id} data-level={item.level}>
        <strong>{item.level==="ok"?"✓":item.level==="review"?"!":"?"} {item.title}</strong><small>{item.detail}</small>
      </article>)}</div>
      <small>Esse resumo não substitui a conferência do catálogo, do caixa, dos horários e do recebimento de um pedido de teste.</small>
    </section>
    <section className={styles.r41Shift} aria-label="Conferência de abertura e transporte" data-level={shiftReadiness.level}>
      <div className={styles.r41ShiftHead}>
        <div><span>R41 · ABERTURA DA LOJA</span><strong>{shiftReadiness.headline}</strong><small>Leitura dos pedidos carregados, consulta sob demanda e confirmação humana do Entregas.</small></div>
        <b>{shiftReadiness.snapshotFresh?"Consulta recente":"Consulta pendente"}</b>
      </div>
      <div className={styles.r41ShiftChecks}>{shiftReadiness.signals.map(signal=><article key={signal.id} data-level={signal.level}>
        <strong>{signal.level==="ok"?"✓":signal.level==="review"?"!":"?"} {signal.label}</strong><small>{signal.detail}</small>
      </article>)}</div>
      <div className={styles.r41ManualTasks} aria-label="Verificações manuais de abertura">
        {([
          {id:"storefront" as const,title:"Site acessível",detail:"Abri o site em um celular e conferi catálogo e carrinho."},
          {id:"catalog" as const,title:"Produtos, preços e adicionais",detail:"Conferi os itens principais, os preços e a disponibilidade no Admin."},
          {id:"hours" as const,title:"Funcionamento e agenda",detail:"Conferi o estado efetivo da loja, horários e exceções."},
          {id:"inbox" as const,title:"Pedido confirmado no Entregas",detail:"Conferi no aplicativo Entregas que um pedido de teste autorizado apareceu uma única vez na Caixa de Entrada."},
        ]).map(task=><label className={styles.r41InboxConfirm} key={task.id}>
          <input type="checkbox" checked={manualChecks[task.id]} onChange={e=>{setManualChecks(previous=>({...previous,[task.id]:e.target.checked}));setCopyStatus("");haptic("step");}} />
          <span><strong>{task.title}</strong><small>{task.detail} Marque somente após conferir; vale apenas nesta sessão.</small></span>
        </label>)}
      </div>
      <div className={styles.r41ShiftActions}><button type="button" onClick={()=>void checkIntegration()} disabled={checking}>{checking?"Consultando…":"Atualizar transporte"}</button><button type="button" onClick={()=>void copyShiftReport()}>Copiar diagnóstico</button></div>
      {copyStatus&&<small className={styles.r41CopyFeedback} role="status">{copyStatus}</small>}
      <small className={styles.r41ShiftFootnote}>Sem leitura contínua e sem criar pedidos. Fila sem pendências não significa entrega confirmada.</small>
    </section>
    <div className={styles.integration}>
      <span className={styles.integrationIcon}><ShieldCheck size={16}/></span>
      <div>
        <strong>Site ↔ integração</strong>
        <small data-error={Boolean(remoteError)}>{remoteError||remoteLabel}</small>
        {remote&&<em>Outbox: {remote.integration.outbox.pending} pend. · Mensagens enviáveis: {remote.integration.messaging.pending} · Legado/inelegível: {remote.integration.messaging.legacyOrIneligible} · Quarentena: {remote.integration.quarantine}</em>}
        {remote&&<small className={styles.r35SnapshotAge} data-stale={Boolean(remoteError)}>Última resposta confirmada: {Number.isFinite(new Date(remote.checkedAt).getTime()) ? new Date(remote.checkedAt).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}) : "horário não informado"}.{remoteError ? " Nova consulta falhou; dados acima são anteriores." : " Atualize manualmente para consultar outra vez."}</small>}
      </div>
      <button type="button" disabled={checking} onClick={()=>void checkIntegration()}>
        <RefreshCw size={14} className={checking?styles.spin:undefined}/>
        {checking?"Consultando…":remote?"Atualizar":"Verificar"}
      </button>
    </div>
  </section>
}
// DFL-R35-HEALTH-RECENCY
// DFL-R36-ADMIN-STAGES
