"use client";
import { useState } from "react";
import { ModalBase } from "./ModalBase";
import { useUIStore } from "@/store/ui";
import styles from "./OrderSuccessModal.module.css";

type SuccessData={orderId?:string;isScheduled?:boolean;deliveryMode?:"delivery"|"pickup";total?:number;whatsappUrl?:string;paymentMethod?:"pix"|"cartao"|"dinheiro";pixKey?:string};
const money=(value:number)=>value.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
export function OrderSuccessModal(){
 const {modalData,closeModal,openModal}=useUIStore(); const data=(modalData??{}) as SuccessData; const [copied,setCopied]=useState(false); const ref=data.orderId?`#${data.orderId.slice(-8).toUpperCase()}`:"Pedido"; const isPix=data.paymentMethod==="pix"&&Boolean(data.pixKey);
 const copyPix=async()=>{if(!data.pixKey)return;await navigator.clipboard.writeText(data.pixKey);setCopied(true);window.setTimeout(()=>setCopied(false),1800)};
 return <ModalBase title="Pedido registrado" onClose={closeModal}><div className={styles.body}><div className={styles.icon}>✓</div><span className={styles.eyebrow}>{data.isScheduled?"PEDIDO AGENDADO":"PEDIDO RECEBIDO"}</span><h2>{isPix?"Pedido salvo. Agora finalize o PIX.":"Pronto. Agora dá para acompanhar por aqui."}</h2><p>Seu pedido foi salvo com sucesso no sistema da Da Família. As mudanças de status aparecem em <b>Meus pedidos</b>.</p><div className={styles.receipt}><div><span>Referência</span><strong>{ref}</strong></div>{typeof data.total==="number"&&<div><span>Total</span><strong>{money(data.total)}</strong></div>}<div><span>Recebimento</span><strong>{data.deliveryMode==="pickup"?"Retirada":"Entrega"}</strong></div></div>
 {isPix&&<section className={styles.pixFlow}><span>ETAPA FINAL · PAGAMENTO</span><strong>Faça o PIX de {typeof data.total==="number"?money(data.total):"valor do pedido"}</strong><p>Copie a chave abaixo no aplicativo do seu banco. Depois envie o comprovante para a loja confirmar manualmente.</p><div><input readOnly value={data.pixKey}/><button type="button" onClick={()=>void copyPix()}>{copied?"Copiado":"Copiar chave"}</button></div>{data.whatsappUrl&&<button className={styles.proof} type="button" onClick={()=>{window.location.href=data.whatsappUrl!}}>Já paguei · enviar comprovante</button>}<small>O pagamento ainda não é confirmado automaticamente. Anexe o comprovante na conversa do WhatsApp.</small></section>}
 <button className={styles.primary} type="button" onClick={()=>openModal("orders")}>Acompanhar meu pedido</button>{!isPix&&data.whatsappUrl&&<button className={styles.whatsapp} type="button" onClick={()=>{window.location.href=data.whatsappUrl!}}>Avisar a loja pelo WhatsApp</button>}<button className={styles.link} type="button" onClick={closeModal}>Voltar ao cardápio</button><small>O acompanhamento do site é a referência do pedido. O WhatsApp fica como canal adicional de contato.</small></div></ModalBase>;
}
