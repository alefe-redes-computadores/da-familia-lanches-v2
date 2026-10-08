"use client";

import { useState } from "react";
import { UserRound, MapPin, CreditCard, ShoppingBag, ReceiptText, MessageCircle, Printer, Info, PackageCheck, Copy, Check, Clock3, Route, MessageSquareText, ExternalLink, X, TriangleAlert, Store, PackageX, Bike, Gauge, Wrench, PhoneOff, UserRoundX, PauseCircle, AlertTriangle } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { getOrderItems, paymentLabel } from "@/lib/orderCompat";
import { normalizarStatus, getColorByStatus, formatarData } from "@/lib/orderUtils";
import { canTransitionOrderStatus, statusTitle } from "@/lib/orderStatus";
import { ageLabel, operationalAttention } from "@/lib/adminOrders";
import { openDflEntregas } from "@/lib/adminDeliveryBridge";
import { ORDER_CANCELLATION_REASONS, type OrderCancellationReasonCode } from "@/lib/orderCancellation";
import styles from "./OrderCard.module.css";

export function OrderCard({ pedido, updateStatus, imprimirPedido, selected = false, onSelect, forceExpanded = false, inspector = false, updating = false, density = "comfortable" }: any) {
  const [expanded, setExpanded] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<"resumo" | "itens" | "cliente" | "entrega" | "pagamento">("resumo");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelReasonCode, setCancelReasonCode] = useState<OrderCancellationReasonCode | null>(null);
  const [cancelNote, setCancelNote] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);
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
  const queuePreviewItems = itens.slice(0, density === "rush" ? 1 : 2);
  const queueObservation =
    itens
      .map((item) => String(item.observation || "").trim())
      .find(Boolean) || "";
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
  const rawOrigin = String(
    pedido.origem ||
    pedido.origin ||
    pedido.source ||
    pedido.canal ||
    pedido.channel ||
    ""
  ).trim();
  const originLabel = rawOrigin || "Origem não informada";
  const customerMode = String(pedido.customerMode || "").toLowerCase();
  const checkoutChannel = String(pedido.checkoutChannel || "").toLowerCase();
  const handoffChannel = String(pedido.handoffChannel || "").toLowerCase();
  const orderBadges = [
    { key: "origin", label: checkoutChannel === "site" || pedido.sourceSystem === "dfl_site" ? "SITE" : originLabel.toUpperCase(), tone: "site" },
    { key: "customer", label: customerMode === "google" ? "GOOGLE" : customerMode === "guest" ? "CONVIDADO" : "", tone: customerMode === "google" ? "google" : "guest" },
    { key: "handoff", label: handoffChannel === "whatsapp" ? "WHATSAPP" : "", tone: "whatsapp" },
    { key: "recovered", label: pedido.recoveredCheckout === true ? "RECUPERADO" : "", tone: "recovered" },
  ].filter((badge) => badge.label);

  const rawMessageStatus = String(
    pedido.messagingStatus ||
    pedido.orderMessagingStatus ||
    pedido.whatsappStatus ||
    pedido.messageStatus ||
    ""
  ).trim();
  const messageStatusLabel = rawMessageStatus || "Sem status de mensagem no pedido";

  const shortOrderId = String(pedido.id || "").slice(-8).toUpperCase();
  const addressLabel = String(
    pedido.endereco ||
    pedido.address ||
    (pickup ? "Retirada no local" : "")
  ).trim();

  const copyValue = async (key: string, value: string) => {
    const text = String(value || "").trim();
    if (!text) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const area = document.createElement("textarea");
        area.value = text;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.focus();
        area.select();
        document.execCommand("copy");
        area.remove();
      }
      setCopiedKey(key);
      haptic("success");
      window.setTimeout(() => setCopiedKey((current) => current === key ? null : current), 1400);
    } catch (error) {
      console.error("[admin/order-copy]", error);
      haptic("error");
    }
  };

  const timeline = stages.map((stage, index) => ({
    stage,
    state: index < currentStageIndex ? "done" : index === currentStageIndex ? "current" : "pending",
  }));


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

  const confirmCancellation = async () => {
    if (!cancelReasonCode || cancelBusy) return;
    const reason = ORDER_CANCELLATION_REASONS.find((item) => item.code === cancelReasonCode);
    if (!reason) return;
    if (cancelReasonCode === "other" && !cancelNote.trim()) return;
    setCancelBusy(true);
    try {
      await updateStatus(pedido.id, "Cancelado", pedido, {
        reasonCode: reason.code,
        reasonLabel: reason.label,
        note: cancelNote.trim() || undefined,
        itemProductIds: cancelReasonCode === "item_unavailable"
          ? itens.map((item: any) => String(item.id || "")).filter(Boolean)
          : [],
      });
      setCancelConfirm(false);
      setCancelReasonCode(null);
      setCancelNote("");
    } finally {
      setCancelBusy(false);
    }
  };

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
      data-density={inspector ? "inspector" : density}
      onClick={terminal && onSelect ? onSelect : undefined}
      style={{ "--status-color": getColorByStatus(pedido.status) } as React.CSSProperties}
    >
      <div className={styles.top}>
        <div>
          <div className={styles.status}><span className={styles.statusDot} aria-hidden="true" />{statusAtual === "Finalizado" ? "Pedido entregue" : statusAtual === "Cancelado" ? "Pedido cancelado" : statusTitle(pedido.status, pickup)}</div>
          <div className={styles.orderIdRow}>
            <div className={styles.orderId}>#{shortOrderId}</div>
            {inspector && <button
              type="button"
              className={styles.copyMini}
              onClick={(event) => { event.stopPropagation(); void copyValue("order", String(pedido.id)); }}
              aria-label="Copiar ID do pedido"
              title="Copiar ID do pedido"
            >
              {copiedKey === "order" ? <Check size={13}/> : <Copy size={13}/>}
            </button>}
          </div>
        </div>
        <div className={styles.time}>
          <span>{formatarData(pedido.data)}</span>
          <b>{ageLabel(pedido)}</b>
        </div>
      </div>

      {orderBadges.length > 0 && (
        <div className={styles.orderBadges} aria-label="Origem e contexto do pedido">
          {orderBadges.map((badge) => <span key={badge.key} data-tone={badge.tone}>{badge.label}</span>)}
        </div>
      )}

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
          {!inspector && !terminal && queuePreviewItems.length > 0 && (
            <div className={styles.queuePreview}>
              {queuePreviewItems.map((item, index) => (
                <b key={`${item.name}-${index}`}>
                  {item.quantity}× {item.name}
                </b>
              ))}
              {itens.length > queuePreviewItems.length && (
                <small>+{itens.length - queuePreviewItems.length} item(ns)</small>
              )}
            </div>
          )}
          {!inspector && !terminal && queueObservation && (
            <div className={styles.queueObservation}>
              <TriangleAlert size={13} />
              <span>{queueObservation}</span>
            </div>
          )}
          <span className={styles.queueAddress}>
            {pedido.endereco || (pickup ? "Retirada no local" : "Endereço não informado")}
          </span>
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

          {inspector && (
            <nav className={styles.inspectorTabs} aria-label="Detalhes do pedido">
              {[
                ["resumo", "Resumo", <Info size={15} key="i" />],
                ["itens", "Itens", <ReceiptText size={15} key="it" />],
                ["cliente", "Cliente", <UserRound size={15} key="c" />],
                ["entrega", pickup ? "Retirada" : "Entrega", <MapPin size={15} key="e" />],
                ["pagamento", "Pagamento", <CreditCard size={15} key="p" />],
              ].map(([key, label, icon]) => (
                <button
                  key={String(key)}
                  type="button"
                  data-active={inspectorTab === key}
                  onClick={(event) => {
                    event.stopPropagation();
                    haptic("step");
                    setInspectorTab(key as typeof inspectorTab);
                  }}
                >
                  {icon}
                  <span>{label}</span>
                </button>
              ))}
            </nav>
          )}

          {inspector && inspectorTab === "resumo" && (
            <section className={styles.operationalCockpit}>
              <div className={styles.cockpitHead}>
                <div>
                  <span>VISÃO OPERACIONAL</span>
                  <strong>Pedido #{shortOrderId}</strong>
                </div>
                <span className={styles.originBadge}>{checkoutChannel === "site" || pedido.sourceSystem === "dfl_site" ? "PEDIDO DO SITE" : originLabel}</span>
              </div>

              <div className={styles.timeline}>
                {timeline.map(({ stage, state }) => (
                  <div key={stage} data-state={state}>
                    <span className={styles.timelineDot}>{state === "done" ? <Check size={11}/> : state === "current" ? <Clock3 size={11}/> : null}</span>
                    <div>
                      <strong>{stage}</strong>
                      <small>{state === "done" ? "Concluído" : state === "current" ? "Etapa atual" : "Pendente"}</small>
                    </div>
                  </div>
                ))}
              </div>

              <div className={styles.cockpitGrid}>
                <div>
                  <span className={styles.cockpitIcon}><MessageSquareText size={15}/></span>
                  <div><small>Mensagens</small><strong>{messageStatusLabel}</strong></div>
                </div>
                <div>
                  <span className={styles.cockpitIcon}><Route size={15}/></span>
                  <div><small>Logística</small><strong>{pickup ? "Retirada no balcão" : logisticsSummary}</strong></div>
                </div>
              </div>
            </section>
          )}

          {(!inspector || inspectorTab === "resumo") && (
            <div className={styles.inspectorSummaryGrid}>
              <div className={styles.inspectorMini}>
                <span className={styles.inspectorMiniIcon}><UserRound size={16} /></span>
                <div><small>Cliente</small><strong>{customerName}</strong><span>{telefone || "Telefone não informado"}</span></div>
              </div>
              <div className={styles.inspectorMini}>
                <span className={styles.inspectorMiniIcon}><PackageCheck size={16} /></span>
                <div><small>Etapa atual</small><strong>{statusTitle(pedido.status, pickup)}</strong><span>{ageLabel(pedido)}</span></div>
              </div>
              <div className={styles.inspectorMini}>
                <span className={styles.inspectorMiniIcon}><ShoppingBag size={16} /></span>
                <div><small>Pedido</small><strong>{itemCount} {itemCount === 1 ? "item" : "itens"}</strong><span>{fulfillmentLabel}</span></div>
              </div>
              <div className={styles.inspectorMini}>
                <span className={styles.inspectorMiniIcon}><CreditCard size={16} /></span>
                <div><small>Total</small><strong>R$ {Number.isFinite(total) ? total.toFixed(2) : "0.00"}</strong><span>{paymentLabel(pedido.metodoPagamento)}</span></div>
              </div>
            </div>
          )}

          {(!inspector || inspectorTab === "cliente" || inspectorTab === "resumo") && (
            <div className={styles.person}>
              <div className={styles.personIdentity}>
                <span className={styles.detailIcon}><UserRound size={16} /></span>
                <div><small>Cliente</small><strong>{customerName}</strong><div className={styles.phone}>{telefone || "Telefone não informado"}</div></div>
              </div>
              <div className={styles.metaActions}>
                {telefone && <button className={styles.iconBtn} onClick={(event) => { event.stopPropagation(); void copyValue("phone", telefone); }} title="Copiar telefone">{copiedKey === "phone" ? <Check size={14}/> : <Copy size={14}/>}Copiar</button>}
                {telefone && <button className={styles.iconBtn} onClick={(event) => { event.stopPropagation(); haptic("step"); openWhatsApp(); }} title="Abrir WhatsApp"><MessageCircle size={14} />WhatsApp</button>}
                <button className={styles.iconBtn} onClick={(event) => { event.stopPropagation(); haptic("step"); imprimirPedido(pedido); }} title="Imprimir pedido"><Printer size={14} />Imprimir</button>
              </div>
            </div>
          )}

          {(!inspector || inspectorTab === "entrega" || inspectorTab === "resumo") && (
            <div className={styles.delivery}>
              <span className={styles.detailIcon}><MapPin size={16} /></span>
              <div className={styles.deliveryCopy}>
                <b>{pickup ? "RETIRADA NO BALCÃO" : "ENTREGA"}</b>
                <span>{addressLabel || "Endereço não informado"}</span>
                {inspector && (
                  <div className={styles.deliveryActions}>
                    {!pickup && addressLabel && <button type="button" onClick={(event) => { event.stopPropagation(); void copyValue("address", addressLabel); }}>{copiedKey === "address" ? <Check size={13}/> : <Copy size={13}/>}Copiar endereço</button>}
                    {pedido.deliveryId && <button type="button" onClick={(event) => { event.stopPropagation(); void copyValue("delivery", String(pedido.deliveryId)); }}>{copiedKey === "delivery" ? <Check size={13}/> : <Copy size={13}/>}ID entrega</button>}
                    {hasLogisticsLink && <button type="button" onClick={(event) => { event.stopPropagation(); haptic("step"); handleOpenDflEntregas(); }}><ExternalLink size={13}/>Abrir DFL Entregas</button>}
                  </div>
                )}
              </div>
            </div>
          )}

          {(!inspector || inspectorTab === "itens") && (
            <div className={styles.items}>
              <div className={styles.detailSectionTitle}><ReceiptText size={15} /><span>Itens do pedido</span><b>{itemCount}</b></div>
              {itens.length ? itens.map((item, i) => (
                <div className={styles.item} key={`${item.name}-${i}`}>
                  <b>{item.quantity}x {item.name}</b>
                  {item.selectedAddons.map((a) => <div className={styles.addon} key={`${a.id}-${a.name}`}>+ {a.name}</div>)}
                  {item.observation && <div className={styles.obs}>Obs.: {item.observation}</div>}
                </div>
              )) : <span>Pedido antigo sem itens reconhecíveis.</span>}
            </div>
          )}

          {(!inspector || inspectorTab === "pagamento" || inspectorTab === "resumo") && (
            <div className={styles.money}>
              <span className={styles.detailIcon}><CreditCard size={16} /></span>
              <div>
                <small>Pagamento</small>
                <b>{paymentLabel(pedido.metodoPagamento)}</b>
                <strong>R$ {Number.isFinite(total) ? total.toFixed(2) : "0.00"}</strong>
                {paymentLabel(pedido.metodoPagamento) === "DINHEIRO" && Number.isFinite(troco) && troco > 0 &&
                  <span className={styles.cash}>Troco para R$ {troco.toFixed(2)}</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {(next || canCancel || !inspector) && (
        <div className={styles.actions}>
          {next && <button type="button" disabled={updating} className={styles.primary} data-tone={next[2]} onClick={(event) => { event.stopPropagation(); updateStatus(pedido.id, next[0], pedido); }}>{updating ? "Atualizando…" : next[1]}</button>}
          {!inspector && !terminal && <button className={styles.detailsAction} type="button" disabled={updating} onClick={(event) => { event.stopPropagation(); toggleDetails(); }}>Detalhes</button>}
          {canCancel && !cancelConfirm && <button type="button" disabled={updating} className={styles.cancel} data-danger="true" onClick={(event) => {
            event.stopPropagation();
            haptic("step");
            setCancelConfirm(true);
          }}>Cancelar</button>}
        </div>
      )}

      {cancelConfirm && canCancel && (
        <div className={styles.cancelConfirmPanel} role="alertdialog" aria-label="Confirmar cancelamento do pedido">
          <span className={styles.cancelConfirmIcon}><TriangleAlert size={17}/></span>
          <div>
            <strong>Cancelar pedido #{shortOrderId}?</strong>
            <small>Essa ação muda o estado comercial para Cancelado.</small>
          </div>
          <div className={styles.cancelConfirmActions}>
            <button type="button" disabled={updating} onClick={(event) => { event.stopPropagation(); haptic("step"); setCancelConfirm(false); }}><X size={13}/>Voltar</button>
            <button type="button" disabled={updating} data-danger="true" onClick={(event) => {
              event.stopPropagation();
              haptic("step");
              setCancelConfirm(false);
              updateStatus(pedido.id, "Cancelado", pedido);
            }}><TriangleAlert size={13}/>{updating ? "Cancelando…" : "Confirmar"}</button>
          </div>
        </div>
      )}

      {cancelConfirm && (
        <div className={styles.cancelIntelligence} onClick={(event) => { event.stopPropagation(); setCancelConfirm(false); }}>
          <section className={styles.cancelSheet} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Cancelar pedido">
            <header>
              <div><TriangleAlert size={20}/><div><strong>Cancelar pedido</strong><small>Informe o motivo para manter o histórico da operação.</small></div></div>
              <button type="button" onClick={() => setCancelConfirm(false)} aria-label="Fechar"><X size={18}/></button>
            </header>
            <div className={styles.cancelReasons}>
              {ORDER_CANCELLATION_REASONS.map((reason) => {
                const Icon = reason.code === "store_closed" ? Store
                  : reason.code === "item_unavailable" ? PackageX
                  : reason.code === "courier_unavailable" ? Bike
                  : reason.code === "high_demand" ? Gauge
                  : reason.code === "operational_issue" ? Wrench
                  : reason.code === "customer_unreachable" ? PhoneOff
                  : reason.code === "customer_request" ? UserRoundX
                  : MessageSquareText;
                return <button key={reason.code} type="button" data-selected={cancelReasonCode === reason.code} onClick={() => setCancelReasonCode(reason.code)}>
                  <Icon size={18}/><span>{reason.label}</span>
                </button>;
              })}
            </div>
            {cancelReasonCode === "item_unavailable" && (
              <div className={styles.cancelNotice}><AlertTriangle size={16}/><span>Os itens do pedido serão registrados no cancelamento. Pausar produto no cardápio continua sendo uma ação separada para evitar alterações acidentais em combos.</span></div>
            )}
            {cancelReasonCode === "other" && (
              <textarea value={cancelNote} onChange={(event) => setCancelNote(event.target.value)} placeholder="Descreva o motivo interno…" maxLength={240}/>
            )}
            <footer>
              <button type="button" onClick={() => setCancelConfirm(false)}>Voltar</button>
              <button type="button" disabled={!cancelReasonCode || cancelBusy || (cancelReasonCode === "other" && !cancelNote.trim())} onClick={() => void confirmCancellation()}>
                {cancelBusy ? "Cancelando…" : "Confirmar cancelamento"}
              </button>
            </footer>
          </section>
        </div>
      )}
</article>
  );
}
