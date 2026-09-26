"use client";
import { useEffect, useMemo, useState } from "react";
import { ModalBase } from "./ModalBase";
import { useUIStore } from "@/store/ui";
import { useAuthStore } from "@/store/auth.store";
import { useCartStore } from "@/store/cart.store";
import { useCatalog } from "@/hooks/useCatalog";
import { useCustomerOrders, type CustomerOrder } from "@/hooks/useCustomerOrders";
import { availableAddonsForProduct } from "@/lib/catalog";
import { getOrderItems, normalizeText, orderDateToDate } from "@/lib/orderCompat";
import { formatarData, normalizarStatus } from "@/lib/orderUtils";
import { nextCustomerMessage, statusDescription, statusProgress, statusReached, statusTitle, timelineSteps } from "@/lib/orderStatus";
import { deliveryTrackingPresentation } from "@/lib/deliveryTracking";
import { cancelCustomerScheduledOrder, rescheduleCustomerOrder } from "@/lib/orderRepository";
import { getOrderScheduleSlots, scheduleHumanLabel, type OrderScheduleSlot } from "@/lib/orderScheduling";
import styles from "./OrdersModal.module.css";

const money=(v:unknown)=>(Number.isFinite(Number(v))?Number(v):0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const TERMINAL=new Set(["Finalizado","Cancelado"]);

function lastStatusTime(order: CustomerOrder) {
  const direct=orderDateToDate(order.statusUpdatedAt);
  if(direct)return direct;
  const history=Array.isArray(order.statusHistory)?order.statusHistory:[];
  for(let i=history.length-1;i>=0;i--){const date=orderDateToDate(history[i]?.at);if(date)return date;}
  return null;
}

export function OrdersModal(){
 const {closeModal,openModal}=useUIStore(); const {currentUser}=useAuthStore(); const {addItem,clearCart}=useCartStore(); const {products,addons}=useCatalog();
 const {orders,activeOrders,pastOrders,loading,error,historyLoading,historyReady,hasMore,loadMore}=useCustomerOrders(currentUser); const [notice,setNotice]=useState(""); const [repeatTarget,setRepeatTarget]=useState<string|null>(null); const [tab,setTab]=useState<"active"|"history">("active"); const [scheduleTarget,setScheduleTarget]=useState<string|null>(null); const [scheduleSlots,setScheduleSlots]=useState<OrderScheduleSlot[]>([]); const [scheduleBusy,setScheduleBusy]=useState(false);
 const visible=useMemo(()=>tab==="active"?activeOrders:pastOrders,[activeOrders,pastOrders,tab]);
 useEffect(()=>{if(!historyReady)void loadMore()},[historyReady,loadMore]);
 const repeat=(order:CustomerOrder)=>{const old=getOrderItems(order); if(!old.length){setNotice("Esse pedido antigo não possui itens reconhecíveis para repetir.");return;} const resolved=old.flatMap(item=>{const p=products.find(x=>x.id===item.id)??products.find(x=>normalizeText(x.name)===normalizeText(item.name)); if(!p||!p.disponivel)return[]; const allowedAddons=availableAddonsForProduct(p,addons); const resolvedAddons=item.selectedAddons.flatMap(a=>{const n=allowedAddons.find(x=>x.id===a.id)??allowedAddons.find(x=>normalizeText(x.name)===normalizeText(a.name));return n?[n]:[]});return[{item,product:p,addons:resolvedAddons}]}); if(!resolved.length){setNotice("Os produtos desse pedido não estão disponíveis no cardápio atual.");setRepeatTarget(null);return;} const skipped=old.length-resolved.length;clearCart();resolved.forEach(({item,product,addons})=>addItem(product,item.quantity,addons,item.observation));setNotice(skipped?`${skipped} item(ns) indisponível(is) foram ignorados. O restante usa preços atuais.`:"");setRepeatTarget(null);closeModal();openModal("cart")};
 return <ModalBase title="Meus pedidos" onClose={closeModal}><div className={styles.body}>
   {error&&<div className={styles.error}>{error}</div>}{notice&&<div className={styles.notice}>{notice}</div>}
   {loading&&<div className={styles.loading}>Conectando aos seus pedidos…</div>}
   {!loading&&!error&&!orders.length&&<div className={styles.empty}><div className={styles.emptyIcon}>□</div><strong>Seu histórico começa no primeiro pedido.</strong><p>Quando você pedir, o acompanhamento aparece aqui em tempo real.</p><button className={styles.primaryGhost} onClick={closeModal}>Ver cardápio</button></div>}
   {orders.length>0&&<><div className={styles.live}>● Atualizações em tempo real · sem estimativas inventadas</div><div className={styles.tabs}><button data-active={tab==="active"} onClick={()=>setTab("active")}>Em andamento <b>{activeOrders.length}</b></button><button data-active={tab==="history"} onClick={()=>setTab("history")}>Histórico <b>{pastOrders.length}</b></button></div></>}
   {!loading&&orders.length>0&&!visible.length&&<div className={styles.tabEmpty}>{tab==="active"?"Nenhum pedido em andamento agora.":"Seu histórico ainda está vazio."}</div>}
   <div className={styles.list}>{visible.map(order=>{const items=getOrderItems(order),pickup=order.tipoEntrega==="pickup",status=normalizarStatus(order.status),steps=timelineSteps(pickup),active=!TERMINAL.has(status),updated=lastStatusTime(order),tracking=deliveryTrackingPresentation(order);return <article className={`${styles.card} ${active?styles.activeCard:""}`} key={order.id}>
    <div className={styles.head}><div><span className={styles.date}>{formatarData(order.data)}</span><div className={styles.orderId}>#{String(order.id).slice(-8).toUpperCase()}</div></div><span className={styles.total}>{money(order.total)}</span></div>
    {tracking.visible&&<div className={styles.deliveryTracking} data-tone={tracking.tone}><div className={styles.deliveryEyebrow}>{tracking.eyebrow}</div><strong>{tracking.title}</strong><p>{tracking.description}</p>{tracking.detail&&<div className={styles.deliveryPayment}>{tracking.detail}</div>}{tracking.totalStops!==null&&<small>Rota com {tracking.totalStops} {tracking.totalStops===1?"parada":"paradas"} físicas.</small>}</div>}
    <div className={styles.statusBox}><div className={styles.statusTop}><div><span>{active?"AGORA":"STATUS FINAL"}</span><div className={styles.statusTitle}>{statusTitle(status,pickup)}</div></div>{active&&<b>{statusProgress(status,pickup)}%</b>}</div><div className={styles.statusDesc}>{statusDescription(status,pickup)}</div>{active&&<div className={styles.next}>{nextCustomerMessage(status,pickup)}</div>}{updated&&<small className={styles.updated}>Última atualização: {updated.toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</small>}{status!=="Cancelado"&&active&&<div className={styles.progress}><i style={{width:`${statusProgress(status,pickup)}%`}}/></div>}</div>
    {active&&status!=="Agendado"&&<div className={styles.timeline}>{steps.map(step=><div className={styles.step} data-current={normalizarStatus(step)===status} data-reached={statusReached(status,step,pickup)} key={step}><i/><span>{statusTitle(step,pickup).replace("Pedido ","")}</span></div>)}</div>}
    {status==="Agendado"&&<div className={styles.scheduled}><strong>{order.scheduledFor?`Agendado para ${scheduleHumanLabel(order.scheduledFor)}`:"Pedido agendado"}</strong><span>Você pode reagendar ou cancelar enquanto a produção ainda não começou.</span><div className={styles.scheduleActions}><button type="button" onClick={()=>{setScheduleTarget(order.id);void getOrderScheduleSlots().then(setScheduleSlots)}}>Reagendar</button><button type="button" disabled={scheduleBusy} onClick={()=>{if(currentUser&&window.confirm("Cancelar este agendamento? A vaga será liberada imediatamente.")){setScheduleBusy(true);void cancelCustomerScheduledOrder({orderId:order.id,userId:currentUser.uid}).then(()=>setNotice("Agendamento cancelado. A vaga foi liberada.")).catch(()=>setNotice("Não foi possível cancelar agora.")).finally(()=>setScheduleBusy(false))}}}>Cancelar agendamento</button></div>{scheduleTarget===order.id&&<div className={styles.reschedule}><select defaultValue="" disabled={scheduleBusy} onChange={event=>{const value=event.target.value;if(!value||!currentUser)return;setScheduleBusy(true);void rescheduleCustomerOrder({orderId:order.id,userId:currentUser.uid,scheduledFor:value,scheduledLabel:scheduleHumanLabel(value)}).then(()=>{setNotice("Agendamento alterado.");setScheduleTarget(null)}).catch(error=>setNotice(String(error?.message||"").includes("FULL")?"Esse horário acabou de lotar. Escolha outro.":"Não foi possível reagendar.")).finally(()=>setScheduleBusy(false))}}><option value="">Escolha o novo horário</option>{scheduleSlots.map(slot=><option key={slot.value} value={slot.value} disabled={slot.disabled}>{slot.label}</option>)}</select><button type="button" onClick={()=>setScheduleTarget(null)}>Fechar</button></div>}</div>}
    <details className={styles.details} open={!active}><summary>{items.length} {items.length===1?"item":"itens"} · Ver detalhes</summary><div className={styles.items}>{items.length?items.map((item,i)=><div key={`${item.name}-${i}`}><div>{item.quantity}x {item.name}</div>{item.selectedAddons.map(a=><div className={styles.addon} key={`${a.id}-${a.name}`}>+ {a.name}</div>)}{item.observation&&<div className={styles.observation}>Obs.: {item.observation}</div>}</div>):<div>Itens não disponíveis neste registro antigo.</div>}</div></details>
    {!active&&(repeatTarget===order.id?<div className={styles.repeatConfirm}><strong>Substituir o carrinho por este pedido?</strong><span>Usaremos preços, adicionais e disponibilidade atuais.</span><div><button type="button" onClick={()=>setRepeatTarget(null)}>Cancelar</button><button type="button" onClick={()=>repeat(order)}>Sim, montar carrinho</button></div></div>:<button className={styles.repeat} disabled={!items.length} onClick={()=>setRepeatTarget(order.id)}>Pedir novamente</button>)}
    {!active&&<div className={styles.warning}>A recompra sempre confere o cardápio atual.</div>}
   </article>})}</div>
   {tab==="history"&&hasMore&&<button className={styles.loadMore} type="button" disabled={historyLoading} onClick={()=>void loadMore()}>{historyLoading?"Carregando…":"Carregar pedidos anteriores"}</button>}
 </div></ModalBase>}
