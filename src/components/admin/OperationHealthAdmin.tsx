"use client";

import { useState } from "react";
import { Activity, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { auth } from "@/lib/firebase";
import { normalizarStatus } from "@/lib/orderUtils";
import { operationalAttention, type AdminOrder } from "@/lib/adminOrders";
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

  const now=Date.now();
  const active=pedidos.filter(order=>["Pendente","Em Produção","Agendado","Pronto","Saiu para Entrega"].includes(normalizarStatus(order.status)));
  const attention=active.filter(order=>Boolean(operationalAttention(order,now)));
  const tracking=active.filter(order=>Boolean(order.deliveryTrackingEvent||order.deliveryTrackingLastEventAt));
  const deferred=active.filter(order=>order.deliveryCommercialProjectionPending===true);

  const checkIntegration=async()=>{
    if(checking)return;
    setChecking(true);setRemoteError("");haptic("step");
    try{
      const user=auth.currentUser;
      if(!user)throw new Error("Sessão administrativa indisponível.");
      const token=await user.getIdToken();
      const response=await fetch("/api/admin/operation-health",{cache:"no-store",headers:{Authorization:`Bearer ${token}`}});
      const data=await response.json().catch(()=>null);
      if(!response.ok||!data?.ok)throw new Error(data?.error||"Falha ao consultar integração.");
      setRemote(data);
      haptic(data.integration.backlog||data.integration.quarantine?"error":"success");
    }catch(error){
      setRemoteError(error instanceof Error?error.message:"Falha ao consultar integração.");
      haptic("error");
    }finally{setChecking(false)}
  };

  const remoteLabel=!remote?"não consultada":remote.integration.state==="healthy"?"integração limpa":remote.integration.backlog>0?`${remote.integration.backlog} pendência${remote.integration.backlog===1?"":"s"}`:`${remote.integration.quarantine} em quarentena`;

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

    <div className={styles.integration}>
      <span className={styles.integrationIcon}><ShieldCheck size={16}/></span>
      <div>
        <strong>Site ↔ integração</strong>
        <small data-error={Boolean(remoteError)}>{remoteError||remoteLabel}</small>
        {remote&&<em>Outbox: {remote.integration.outbox.pending} pend. · Mensagens enviáveis: {remote.integration.messaging.pending} · Legado/inelegível: {remote.integration.messaging.legacyOrIneligible} · Quarentena: {remote.integration.quarantine}</em>}
      </div>
      <button type="button" disabled={checking} onClick={()=>void checkIntegration()}>
        <RefreshCw size={14} className={checking?styles.spin:undefined}/>
        {checking?"Consultando…":remote?"Atualizar":"Verificar"}
      </button>
    </div>
  </section>
}
