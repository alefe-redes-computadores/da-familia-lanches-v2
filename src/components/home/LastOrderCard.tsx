"use client";
import { useMemo } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useUIStore } from "@/store/ui";
import { useCustomerOrders } from "@/hooks/useCustomerOrders";
import styles from "./LastOrderCard.module.css";
const money=(v:number)=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
export function LastOrderCard(){
 const user=useAuthStore((s)=>s.currentUser); const openModal=useUIStore((s)=>s.openModal);
 const {orders,loading}=useCustomerOrders(user); const order=orders[0];
 const view=()=>openModal("orders");
 const data=useMemo(()=>{if(!order)return null; const raw=Array.isArray(order.items)?order.items:Array.isArray(order.itens)?order.itens:[]; const names=raw.slice(0,3).map((x:any)=>String(x?.name??x?.nome??"Item")).filter(Boolean); const total=Number(order.total??order.valorTotal??order.totalPrice??0); const address=String(order.endereco??order.address??order.customerSnapshot?.address??order.customerSnapshot?.street??""); return{names,total,address};},[order]);
 if(!user||loading||!order||!data)return null;
 return <section className={styles.card}><div><span>SEU ÚLTIMO PEDIDO</span><strong>{data.names.join(" · ")||"Pedido Da Família"}</strong>{data.address&&<p>{data.address}</p>}</div><div className={styles.side}><b>{money(data.total)}</b><button type="button" onClick={view}>Ver detalhes · pedir novamente</button></div></section>
}
