"use client";
import { useEffect,useMemo,useState } from "react";
import { doc,onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuthStore } from "@/store/auth.store";
import { useCustomerOrders } from "@/hooks/useCustomerOrders";
type Summary={total:number;completed:number;cancelled:number;initialized:boolean;loading:boolean;error:string};
const empty:Summary={total:0,completed:0,cancelled:0,initialized:false,loading:false,error:""};
export function useCustomerOrderStats(){
 const currentUser=useAuthStore(state=>state.currentUser),{activeOrders}=useCustomerOrders(currentUser);
 const[summary,setSummary]=useState<Summary>(()=>({...empty,loading:Boolean(currentUser)}));
 useEffect(()=>{if(!currentUser){setSummary(empty);return}let alive=true,stop=()=>{};
  void(async()=>{try{const token=await currentUser.getIdToken(),response=await fetch("/api/customer/order-summary",{headers:{authorization:`Bearer ${token}`},cache:"no-store"});if(!response.ok)throw new Error("SUMMARY_FAILED");if(!alive)return;
   stop=onSnapshot(doc(db,"Usuarios",currentUser.uid,"Loyalty","state"),snapshot=>{const data=snapshot.data()??{};setSummary({total:Math.max(0,Number(data.totalOrders)||0),completed:Math.max(0,Number(data.completedOrders)||0),cancelled:Math.max(0,Number(data.cancelledOrders)||0),initialized:data.initialized===true,loading:false,error:""})},()=>setSummary(current=>({...current,loading:false,error:"Não foi possível atualizar seu resumo agora."})));
  }catch(reason){console.error(reason);if(alive)setSummary(current=>({...current,loading:false,error:"Não foi possível carregar seu resumo agora."}))}})();
  return()=>{alive=false;stop()}},[currentUser?.uid]);
 return useMemo(()=>({total:summary.total,completed:summary.completed,cancelled:summary.cancelled,active:activeOrders.length,loading:summary.loading,error:summary.error,initialized:summary.initialized}),[summary,activeOrders.length]);
}
