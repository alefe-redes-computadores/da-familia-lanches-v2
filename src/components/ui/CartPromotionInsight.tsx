"use client";
import { useEffect,useMemo,useState } from "react";
import { useCartStore } from "@/store/cart.store";
import { useAuthStore } from "@/store/auth.store";
import { useCustomerOrders } from "@/hooks/useCustomerOrders";
import { getPublicPromotions,selectPromotionOpportunity,type PublicPromotion } from "@/lib/publicPromotions";
import styles from "./CartPromotionInsight.module.css";
const money=(v:number)=>v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
export function CartPromotionInsight(){
  const total=useCartStore((s)=>s.getCartTotal());
  const user=useAuthStore((s)=>s.currentUser);
  const {orders,loading:ordersLoading}=useCustomerOrders(user);
  const[promotions,setPromotions]=useState<PublicPromotion[]>([]);
  useEffect(()=>{let active=true;void getPublicPromotions().then((items)=>{if(active)setPromotions(items);}).catch(()=>{});return()=>{active=false;};},[]);
  const eligiblePromotions=useMemo(()=>promotions.filter((promotion)=>{
    if(promotion.code.toUpperCase()!=="BEMVINDO10")return true;
    return Boolean(user)&&!ordersLoading&&orders.length===0;
  }),[orders.length,ordersLoading,promotions,user]);
  const opportunity=useMemo(()=>selectPromotionOpportunity(eligiblePromotions,total),[eligiblePromotions,total]);
  if(!opportunity)return null;
  return <div className={styles.card}><span>OPORTUNIDADE NO CARRINHO</span><strong>{opportunity.kind==="near"?`Faltam ${money(opportunity.missing)} para ${opportunity.coupon.code}`:`${opportunity.coupon.code} disponível`}</strong><p>{opportunity.kind==="near"?(opportunity.coupon.description||"Complete o pedido mínimo e valide o código no checkout."):`${opportunity.coupon.description||"Cupom promocional disponível."} Valide no checkout antes de finalizar.`}</p></div>;
}
