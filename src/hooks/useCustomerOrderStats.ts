"use client";
import { useEffect,useMemo,useState } from "react";
import { collection,onSnapshot,query,where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuthStore } from "@/store/auth.store";
import { normalizarStatus } from "@/lib/orderUtils";

export function useCustomerOrderStats(){
 const currentUser=useAuthStore(s=>s.currentUser);
 const [statuses,setStatuses]=useState<string[]>([]);
 const [loading,setLoading]=useState(Boolean(currentUser));
 const [error,setError]=useState("");
 useEffect(()=>{
  if(!currentUser){setStatuses([]);setLoading(false);setError("");return;}
  setLoading(true);
  const q=query(collection(db,"Pedidos"),where("userId","==",currentUser.uid));
  return onSnapshot(q,snapshot=>{setStatuses(snapshot.docs.map(d=>normalizarStatus(d.data().status)));setLoading(false);setError("")},reason=>{console.error(reason);setStatuses([]);setLoading(false);setError("Nao foi possivel carregar seu historico agora.")});
 },[currentUser]);
 return useMemo(()=>{
  const completed=statuses.filter(s=>s==="Finalizado").length;
  const cancelled=statuses.filter(s=>s==="Cancelado").length;
  const active=statuses.filter(s=>!["Finalizado","Cancelado"].includes(s)).length;
  return {total:statuses.length,completed,cancelled,active,loading,error};
 },[statuses,loading,error]);
}
