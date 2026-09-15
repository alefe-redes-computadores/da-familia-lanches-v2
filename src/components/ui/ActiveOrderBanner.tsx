"use client";
import { useAuthStore } from "@/store/auth.store";
import { useUIStore } from "@/store/ui";
import { useCustomerOrders } from "@/hooks/useCustomerOrders";
import { normalizarStatus } from "@/lib/orderUtils";
import { statusDescription, statusProgress, statusTitle } from "@/lib/orderStatus";
import { deliveryTrackingPresentation } from "@/lib/deliveryTracking";
import styles from "./ActiveOrderBanner.module.css";
export function ActiveOrderBanner(){
 const currentUser=useAuthStore(s=>s.currentUser),openModal=useUIStore(s=>s.openModal); const {activeOrders,loading}=useCustomerOrders(currentUser);
 if(!currentUser||loading||!activeOrders.length)return null; const order=activeOrders[0],pickup=order.tipoEntrega==="pickup",status=normalizarStatus(order.status),extra=activeOrders.length-1,tracking=deliveryTrackingPresentation(order);
 return <section className={`${styles.banner} ${tracking.visible?styles.tracking:""}`} data-tone={tracking.visible?tracking.tone:"commercial"} aria-label="Pedido em andamento">
  <div className={styles.top}><div><span className={styles.eyebrow}>{tracking.visible?tracking.eyebrow:(status==="Agendado"?"PEDIDO AGENDADO":"PEDIDO EM ANDAMENTO")}</span><strong>{tracking.visible?tracking.title:statusTitle(status,pickup)}</strong></div><span className={styles.id}>#{String(order.id).slice(-8).toUpperCase()}</span></div>
  <p>{tracking.visible?tracking.description:statusDescription(status,pickup)}</p>{tracking.detail&&<div className={styles.deliveryDetail}>{tracking.detail}</div>}
  {!tracking.visible&&status!=="Agendado"&&<div className={styles.progress} aria-hidden="true"><i style={{width:`${statusProgress(status,pickup)}%`}}/></div>}
  <div className={styles.bottom}><span>{extra>0?`+ ${extra} outro${extra>1?"s":""} em andamento`:"Atualiza automaticamente"}</span><button type="button" onClick={()=>openModal("orders")}>Acompanhar</button></div>
 </section>;
}
