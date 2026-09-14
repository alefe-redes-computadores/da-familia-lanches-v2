"use client";
import { ModalBase } from "./ModalBase";
import { useUIStore } from "@/store/ui";
import styles from "./OrderSuccessModal.module.css";

type SuccessData={orderId?:string;isScheduled?:boolean;deliveryMode?:"delivery"|"pickup";total?:number;whatsappUrl?:string};
const money=(value:number)=>value.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
export function OrderSuccessModal(){
 const {modalData,closeModal,openModal}=useUIStore(); const data=(modalData??{}) as SuccessData; const ref=data.orderId?`#${data.orderId.slice(-8).toUpperCase()}`:"Pedido";
 return <ModalBase title="Pedido registrado" onClose={closeModal}><div className={styles.body}><div className={styles.icon}>✓</div><span className={styles.eyebrow}>{data.isScheduled?"PEDIDO AGENDADO":"PEDIDO RECEBIDO"}</span><h2>Pronto. Agora dá para acompanhar por aqui.</h2><p>Seu pedido foi salvo com sucesso no sistema da Da Família. As mudanças de status aparecem em <b>Meus pedidos</b>.</p><div className={styles.receipt}><div><span>Referência</span><strong>{ref}</strong></div>{typeof data.total==="number"&&<div><span>Total</span><strong>{money(data.total)}</strong></div>}<div><span>Recebimento</span><strong>{data.deliveryMode==="pickup"?"Retirada":"Entrega"}</strong></div></div><button className={styles.primary} type="button" onClick={()=>openModal("orders")}>Acompanhar meu pedido</button>{data.whatsappUrl&&<button className={styles.whatsapp} type="button" onClick={()=>{window.location.href=data.whatsappUrl!}}>Avisar a loja pelo WhatsApp</button>}<button className={styles.link} type="button" onClick={closeModal}>Voltar ao cardápio</button><small>O acompanhamento do site é a referência do pedido. O WhatsApp fica como canal adicional de contato.</small></div></ModalBase>;
}
