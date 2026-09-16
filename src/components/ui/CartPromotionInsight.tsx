"use client";
import { useEffect,useMemo,useState } from "react";
import { useCartStore } from "@/store/cart.store";
import { getPublicPromotions,selectPromotionOpportunity,type PublicPromotion } from "@/lib/publicPromotions";
import styles from "./CartPromotionInsight.module.css";
const money=(v:number)=>v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
export function CartPromotionInsight(){const total=useCartStore((s)=>s.getCartTotal());const[promotions,setPromotions]=useState<PublicPromotion[]>([]);useEffect(()=>{let active=true;void getPublicPromotions().then((items)=>{if(active)setPromotions(items);}).catch(()=>{});return()=>{active=false;};},[]);const opportunity=useMemo(()=>selectPromotionOpportunity(promotions,total),[promotions,total]);if(!opportunity)return null;return <div className={styles.card}><span>OPORTUNIDADE NO CARRINHO</span><strong>{opportunity.kind==="near"?`Faltam ${money(opportunity.missing)} para ${opportunity.coupon.code}`:`${opportunity.coupon.code} disponível`}</strong><p>{opportunity.kind==="near"?(opportunity.coupon.description||"Complete o pedido mínimo e valide o código no checkout."):`${opportunity.coupon.description||"Cupom promocional disponível."} Valide no checkout antes de finalizar.`}</p></div>;}
