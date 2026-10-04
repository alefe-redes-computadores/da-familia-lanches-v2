"use client";

import { useState } from "react";
import { getOrderItems, paymentLabel } from "@/lib/orderCompat";
import { normalizarStatus, getColorByStatus, formatarData } from "@/lib/orderUtils";
import { canTransitionOrderStatus, statusTitle } from "@/lib/orderStatus";
import { ageLabel, operationalAttention } from "@/lib/adminOrders";
import { openDflEntregas } from "@/lib/adminDeliveryBridge";
import styles from "./OrderCard.module.css";

export function OrderCard({ pedido, updateStatus, imprimirPedido, selected = false, onSelect, forceExpanded = false, inspector = false, updating = false }: any) {
  const [expanded, setExpanded] = useState(false);
  const isExpanded = forceExpanded || expanded;
  const statusAtual = normalizarStatus(pedido.status);
  const terminal = statusAtual === "Finalizado" || statusAtual === "Cancelado";
  const terminalTone = statusAtual === "Finalizado" ? "success" : statusAtual === "Cancelado" ? "danger" : "active";
  const itens = getOrderItems(pedido);
  const customer = pedido.customerSnapshot && typeof pedido.customerSnapshot === "object" ? pedido.customerSnapshot : {};
  const customerName = String(pedido.userName || customer.name || pedido.nomeCliente || pedido.customerName || pedido.nome || "Cliente").trim();
  const telefone = String(pedido.userPhone || pedido.phone || customer.phone || customer.phoneE164 || "").trim();
  const pickup = pedido.tipoEntrega === "pickup";
  const total = Number(pedido.total || 0);
  const troco = Number(String(pedido.trocoPara ?? pedido.troco ?? "").replace(",", "."));
  const attention = operationalAttention(pedido);
  const logisticsCompleted =
    !pickup &&
    (pedido.deliveryTrackingEvent === "delivery.completed" ||
      Boolean(pedido.deliveryTrackingCompletedAt));
  const commercialCompletionPending =
    logisticsCompleted &&
    statusAtual !== "Finalizado" &&
    statusAtual !== "Cancelado";
  const scheduledAt = typeof pedido.scheduledFor === "string" ? Date.parse(pedido.scheduledFor) : Number.NaN;
  const scheduledLabel = Number.isFinite(scheduledAt)
    ? new Intl.DateTimeFormat("pt-BR", {
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      }).format(new Date(scheduledAt)).replace(".", "")
    : String(pedido.scheduledLabel || "").trim();
  const hasLogisticsLink = Boolean(pedido.deliveryId);
  const fulfillmentLabel = pickup ? "RETIRADA" : "ENTREGA";
  const itemCount = itens.reduce((sum, item) => sum + item.quantity, 0);
  const logisticsSummary = pedido.deliveryOperationalCompleted
    ? "Entrega concluída"
    : pedido.deliveryIsNextStop
      ? "Próxima parada"
      : Number.isFinite(Number(pedido.deliveryStopsAhead))
        ? `${Number(pedido.deliveryStopsAhead)} parada(s) antes`
        : pedido.deliveryRouteName || pedido.deliveryMotoboyName || "Vinculado ao DFL Entregas";
  const stageTone =
    statusAtual === "Pendente" || statusAtual === "Agendado" ? "new" :
    statusAtual === "Em Produção" ? "production" :
    statusAtual === "Pronto" ? "ready" :
    statusAtual === "Saiu para Entrega" ? "route" :
    statusAtual === "Finalizado" ? "completed" : "canceled";
  const stages = pickup
    ? ["Pendente", "Em Produção", "Pronto", "Finalizado"]
    : ["Pendente", "Em Produção", "Pronto", "Saiu para Entrega", "Finalizado"];
  const currentStageIndex = Math.max(0, stages.indexOf(statusAtual));

  const handleOpenDflEntregas = () => {
    openDflEntregas(
      pedido.deliveryId,
      pedido.id,
    );
  };

  const openWhatsApp = () => {
    let d = telefone.replace(/\D/g, "");
    if (!d) return;
    if (!d.startsWith("55")) d = `55${d}`;
    window.open(`https://api.whatsapp.com/send?phone=${d}`, "_blank", "noopener,noreferrer");
  };

  const next =
    statusAtual === "Pendente" || statusAtual === "Agendado" ? ["Em Produção", "Aceitar", "warm"] :
    statusAtual === "Em Produção" ? ["Pronto", "Marcar pronto", "green"] :
    statusAtual === "Pronto" && !pickup ? ["Saiu para Entrega", "Despachar", "blue"] :
    (statusAtual === "Saiu para Entrega" || (statusAtual === "Pronto" && pickup)) ? ["Finalizado", "Concluir entrega", "green"] :
    null;

  const canCancel = !["Finalizado", "Cancelado"].includes(statusAtual)
    && canTransitionOrderStatus(statusAtual, "Cancelado", pickup);

  const toggleDetails = () => {
    if (onSelect) {
      onSelect();
      return;
    }
    if (!forceExpanded) setExpanded((value) => !value);
  };

  return (
    <article
      className={styles.card}
      data-attention={attention?.level || "none"}
      data-selected={selected}
      data-inspector={inspector}
      data-terminal={terminal ? terminalTone : "active"}
      data-stage={stageTone}
      data-updating={updating}
      onClick={terminal && onSelect ? onSelect : undefined}
      style={{ "--status-color": getColorByStatus(pedido.status) } as React.CSSProperties}
    >
      <div className={styles.top}>
        <div>
          <div className={styles.status}><span className={styles.statusDot} aria-hidden="true" />{statusAtual === "Finalizado" ? "Pedido entregue" : statusAtual === "Cancelado" ? "Pedido cancelado" : statusTitle(pedido.status, pickup)}</div>
          <div className={styles.orderId}>#{String(pedido.id).slice(-8).toUpperCase()}</div>
        </div>
        <div className={styles.time}>
          <span>{formatarData(pedido.data)}</span>
          <b>{ageLabel(pedido)}</b>
        </div>
      </div>

      {statusAtual === "Agendado" && scheduledLabel && (
        <div className={styles.scheduledNotice}>
          <span>AGENDADO</span>
          <strong>{scheduledLabel}</strong>
          <small>{pickup ? "Retirada programada" : "Entrega programada"}</small>
        </div>
      )}

      {hasLogisticsLink && !terminal && (
        <div className={styles.logisticsMini} data-next={pedido.deliveryIsNextStop === true}>
          <div className={styles.logisticsMiniCopy}>
            <span>DFL ENTREGAS</span>
            <strong>{logisticsSummary}</strong>
            {pedido.deliveryMotoboyName && <small>{String(pedido.deliveryMotoboyName)}</small>}
          </div>
          <button type="button" className={styles.bridgeAction} onClick={(event) => { event.stopPropagation(); handleOpenDflEntregas(); }}>Abrir no Entregas</button>
        </div>
      )}

      {commercialCompletionPending && (
        <div className={styles.logisticsDoneNotice}>
          <strong>Entrega concluída no DFL Entregas</strong>
          <span>As etapas comerciais ainda estão pendentes. Avance o pedido normalmente até Finalizado.</span>
        </div>
      )}

      {attention && <div className={styles.attention} data-level={attention.level}>{attention.label}</div>}

      <button
        className={styles.summary}
        type="button"
        aria-expanded={isExpanded}
        onClick={(event) => { event.stopPropagation(); toggleDetails(); }}
      >
        <div className={styles.summaryMain}>
          <div className={styles.summaryMeta}>
            <span>{fulfillmentLabel}</span>
            <i aria-hidden="true" />
            <b>{itemCount} {itemCount === 1 ? "item" : "itens"}</b>
          </div>
          <h3>{customerName}</h3>
          <span>{pedido.endereco || (pickup ? "Retirada no local" : "Endereço não informado")}</span>
        </div>
        <div className={styles.summaryTotal}>
          <strong>R$ {Number.isFinite(total) ? total.toFixed(2) : "0.00"}</strong>
          <span>{isExpanded ? (inspector ? "Em foco" : "Fechar") : "Detalhes"}</span>
        </div>
      </button>

      {isExpanded && (
        <div className={styles.details}>
          {inspector && !terminal && (
            <div className={styles.stageTrack} aria-label={`Etapa atual: ${statusTitle(pedido.status, pickup)}`}>
              {stages.map((stage, index) => (
                <span key={stage} data-done={index <= currentStageIndex} data-current={index === currentStageIndex} title={stage} />
              ))}
            </div>
          )}
          <div className={styles.person}>
            <div className={styles.phone}>{telefone || "Telefone não informado"}</div>
            <div className={styles.metaActions}>
              {telefone && <button className={styles.iconBtn} onClick={openWhatsApp} title="Abrir WhatsApp">WhatsApp</button>}
              <button className={styles.iconBtn} onClick={() => imprimirPedido(pedido)} title="Imprimir pedido">Imprimir</button>
            </div>
          </div>

          <div className={styles.delivery}>
            <b>{pickup ? "RETIRADA NO BALCÃO" : "ENTREGA"}</b>
            <span>{pedido.endereco || (pickup ? "Retirada no local" : "Endereço não informado")}</span>
          </div>

          <div className={styles.items}>
            {itens.length ? itens.map((item, i) => (
              <div className={styles.item} key={`${item.name}-${i}`}>
                <b>{item.quantity}x {item.name}</b>
                {item.selectedAddons.map((a) => <div className={styles.addon} key={`${a.id}-${a.name}`}>+ {a.name}</div>)}
                {item.observation && <div className={styles.obs}>Obs.: {item.observation}</div>}
              </div>
            )) : <span>Pedido antigo sem itens reconhecíveis.</span>}
          </div>

          <div className={styles.money}>
            <div>
              <small>Pagamento</small>
              <b>{paymentLabel(pedido.metodoPagamento)}</b>
              {paymentLabel(pedido.metodoPagamento) === "DINHEIRO" && Number.isFinite(troco) && troco > 0 &&
                <span className={styles.cash}>Troco para R$ {troco.toFixed(2)}</span>}
            </div>
          </div>
        </div>
      )}

      {(next || canCancel || !inspector) && (
        <div className={styles.actions}>
          {next && <button type="button" disabled={updating} className={styles.primary} data-tone={next[2]} onClick={(event) => { event.stopPropagation(); updateStatus(pedido.id, next[0], pedido); }}>{updating ? "Atualizando…" : next[1]}</button>}
          {!inspector && !terminal && <button className={styles.detailsAction} type="button" disabled={updating} onClick={(event) => { event.stopPropagation(); toggleDetails(); }}>Detalhes</button>}
          {canCancel && <button type="button" disabled={updating} className={styles.cancel} data-danger="true" onClick={(event) => {
            event.stopPropagation();
            if (window.confirm(`Cancelar o pedido #${String(pedido.id).slice(-8).toUpperCase()}?`)) {
              updateStatus(pedido.id, "Cancelado", pedido);
            }
          }}>Cancelar</button>}
        </div>
      )}
    </article>
  );
}
