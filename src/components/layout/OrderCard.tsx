"use client";

import { useState } from "react";
import { getOrderItems, paymentLabel } from "@/lib/orderCompat";
import { normalizarStatus, getColorByStatus, formatarData } from "@/lib/orderUtils";
import { canTransitionOrderStatus, statusTitle } from "@/lib/orderStatus";
import { ageLabel, operationalAttention } from "@/lib/adminOrders";
import styles from "./OrderCard.module.css";

export function OrderCard({ pedido, updateStatus, imprimirPedido }: any) {
  const [expanded, setExpanded] = useState(false);
  const statusAtual = normalizarStatus(pedido.status);
  const itens = getOrderItems(pedido);
  const telefone = String(pedido.userPhone || pedido.phone || "").trim();
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

  const openWhatsApp = () => {
    let d = telefone.replace(/\D/g, "");
    if (!d) return;
    if (!d.startsWith("55")) d = `55${d}`;
    window.open(`https://api.whatsapp.com/send?phone=${d}`, "_blank", "noopener,noreferrer");
  };

  const next =
    statusAtual === "Pendente" || statusAtual === "Agendado" ? ["Em Produção", "ACEITAR", "warm"] :
    statusAtual === "Em Produção" ? ["Pronto", "MARCAR PRONTO", "green"] :
    statusAtual === "Pronto" && !pickup ? ["Saiu para Entrega", "DESPACHAR", "blue"] :
    (statusAtual === "Saiu para Entrega" || (statusAtual === "Pronto" && pickup)) ? ["Finalizado", "CONCLUIR", ""] :
    null;

  const canCancel = !["Finalizado", "Cancelado"].includes(statusAtual)
    && canTransitionOrderStatus(statusAtual, "Cancelado", pickup);

  return (
    <article
      className={styles.card}
      data-attention={attention?.level || "none"}
      style={{ "--status-color": getColorByStatus(pedido.status) } as React.CSSProperties}
    >
      <div className={styles.top}>
        <div>
          <div className={styles.status}>{statusTitle(pedido.status, pickup)}</div>
          <div className={styles.orderId}>#{String(pedido.id).slice(-8).toUpperCase()}</div>
        </div>
        <div className={styles.time}>
          <span>{formatarData(pedido.data)}</span>
          <b>{ageLabel(pedido)}</b>
        </div>
      </div>

      {commercialCompletionPending && (
        <div className={styles.logisticsDoneNotice}>
          <strong>Entrega concluída no DFL Entregas</strong>
          <span>As etapas comerciais ainda estão pendentes. Avance o pedido normalmente até Finalizado.</span>
        </div>
      )}

      {attention && <div className={styles.attention} data-level={attention.level}>{attention.label}</div>}

      <div className={styles.person}>
        <div>
          <h3>{pedido.userName || "Cliente"}</h3>
          <div className={styles.phone}>{telefone || "Telefone não informado"}</div>
        </div>
        <div className={styles.metaActions}>
          {telefone && <button className={styles.iconBtn} onClick={openWhatsApp} title="Abrir WhatsApp">WhatsApp</button>}
          <button className={styles.iconBtn} onClick={() => imprimirPedido(pedido)} title="Imprimir pedido">Imprimir</button>
        </div>
      </div>

      <div className={styles.delivery}>
        <b>{pickup ? "RETIRADA NO BALCÃO" : "ENTREGA"}</b>
        <span>{pedido.endereco || (pickup ? "Retirada no local" : "Endereço não informado")}</span>
      </div>

      <button className={styles.itemsToggle} type="button" onClick={() => setExpanded((value) => !value)}>
        <span><b>{itens.reduce((sum, item) => sum + item.quantity, 0)}</b> item(ns) no pedido</span>
        <strong>{expanded ? "Ocultar" : "Ver itens"}</strong>
      </button>

      {expanded && (
        <div className={styles.items}>
          {itens.length ? itens.map((item, i) => (
            <div className={styles.item} key={`${item.name}-${i}`}>
              <b>{item.quantity}x {item.name}</b>
              {item.selectedAddons.map((a) => <div className={styles.addon} key={`${a.id}-${a.name}`}>+ {a.name}</div>)}
              {item.observation && <div className={styles.obs}>Obs.: {item.observation}</div>}
            </div>
          )) : <span>Pedido antigo sem itens reconhecíveis.</span>}
        </div>
      )}

      <div className={styles.money}>
        <div>
          <small>Pagamento</small>
          <b>{paymentLabel(pedido.metodoPagamento)}</b>
          {paymentLabel(pedido.metodoPagamento) === "DINHEIRO" && Number.isFinite(troco) && troco > 0 &&
            <span className={styles.cash}>Troco para R$ {troco.toFixed(2)}</span>}
        </div>
        <div className={styles.total}><small>Total</small><strong>R$ {Number.isFinite(total) ? total.toFixed(2) : "0.00"}</strong></div>
      </div>

      {(next || canCancel) && (
        <div className={styles.actions}>
          {next && <button className={styles.primary} data-tone={next[2]} onClick={() => updateStatus(pedido.id, next[0], pedido)}>{next[1]}</button>}
          {canCancel && <button className={styles.cancel} onClick={() => {
            if (window.confirm(`Cancelar o pedido #${String(pedido.id).slice(-8).toUpperCase()}?`)) {
              updateStatus(pedido.id, "Cancelado", pedido);
            }
          }}>Cancelar</button>}
        </div>
      )}
    </article>
  );
}
