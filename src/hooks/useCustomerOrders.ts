"use client";
import { useCallback,useEffect,useMemo,useState } from "react";
import { collection,getDocs,limit,onSnapshot,orderBy,query,startAfter,where,type QueryDocumentSnapshot,type Unsubscribe } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "@/lib/firebase";
import { orderDateToMillis } from "@/lib/orderCompat";
export type CustomerOrder=Record<string,any>&{id:string};
type State={activeOrders:CustomerOrder[];pastOrders:CustomerOrder[];activeLoading:boolean;historyLoading:boolean;historyReady:boolean;hasMore:boolean;error:string};
type Entry={state:State;listeners:Set<(state:State)=>void>;stop?:Unsubscribe;refs:number;cleanupTimer?:ReturnType<typeof setTimeout>;cursor?:QueryDocumentSnapshot;historyRequest?:Promise<void>;activeInitialized:boolean};
const entries=new Map<string,Entry>(),LISTENER_GRACE_MS=90_000,HISTORY_PAGE_SIZE=12;
const ACTIVE_STATUSES=["Agendado","Pendente","Em Produção","Pronto","Saiu para Entrega"],TERMINAL_STATUSES=["Finalizado","Cancelado"];
const newestFirst=(a:CustomerOrder,b:CustomerOrder)=>orderDateToMillis(b.data??b.createdAt??b.statusUpdatedAt)-orderDateToMillis(a.data??a.createdAt??a.statusUpdatedAt);
const fresh=():Entry=>({state:{activeOrders:[],pastOrders:[],activeLoading:true,historyLoading:false,historyReady:false,hasMore:true,error:""},listeners:new Set(),refs:0,activeInitialized:false});
function entry(uid:string){const old=entries.get(uid);if(old)return old;const made=fresh();entries.set(uid,made);return made}
function emit(current:Entry){current.listeners.forEach(listener=>listener(current.state))}
async function loadHistory(uid:string,current:Entry,reset=false){
 if(current.historyRequest)return current.historyRequest;if(!reset&&current.state.historyReady&&!current.state.hasMore)return;
 current.state={...current.state,historyLoading:true,error:""};emit(current);
 current.historyRequest=(async()=>{try{
  const filters=[where("userId","==",uid),where("status","in",TERMINAL_STATUSES),orderBy("data","desc"),limit(HISTORY_PAGE_SIZE)] as const;
  const request=reset||!current.cursor?query(collection(db,"Pedidos"),...filters):query(collection(db,"Pedidos"),...filters,startAfter(current.cursor));
  const snapshot=await getDocs(request),page=snapshot.docs.map(document=>({id:document.id,...document.data()} as CustomerOrder));
  const merged=new Map((reset?[]:current.state.pastOrders).map(order=>[order.id,order]));page.forEach(order=>merged.set(order.id,order));
  current.cursor=snapshot.docs[snapshot.docs.length-1];current.state={...current.state,pastOrders:[...merged.values()].sort(newestFirst),historyLoading:false,historyReady:true,hasMore:snapshot.size===HISTORY_PAGE_SIZE};
 }catch(reason){console.error(reason);current.state={...current.state,historyLoading:false,historyReady:true,error:"Não foi possível carregar seu histórico agora."}}
 finally{current.historyRequest=undefined;emit(current)}})();return current.historyRequest;
}
function start(uid:string,current:Entry){
 if(current.stop)return;
 const activeQuery=query(collection(db,"Pedidos"),where("userId","==",uid),where("status","in",ACTIVE_STATUSES),orderBy("data","desc"),limit(20));
 current.stop=onSnapshot(activeQuery,snapshot=>{
  const refresh=current.activeInitialized&&snapshot.docChanges().some(change=>change.type==="removed");current.activeInitialized=true;
  current.state={...current.state,activeOrders:snapshot.docs.map(document=>({id:document.id,...document.data()} as CustomerOrder)).sort(newestFirst),activeLoading:false,error:""};emit(current);
  if(refresh)void loadHistory(uid,current,true);
 },reason=>{console.error(reason);current.state={...current.state,activeLoading:false,error:"Não foi possível acompanhar seus pedidos agora."};emit(current)});
}
function subscribe(uid:string,listener:(state:State)=>void){const current=entry(uid);if(current.cleanupTimer)clearTimeout(current.cleanupTimer);current.cleanupTimer=undefined;current.listeners.add(listener);current.refs++;start(uid,current);if(!current.state.historyReady)void loadHistory(uid,current);listener(current.state);return()=>{current.listeners.delete(listener);current.refs=Math.max(0,current.refs-1);if(current.refs)return;current.cleanupTimer=setTimeout(()=>{if(current.refs)return;current.stop?.();current.stop=undefined;current.cleanupTimer=undefined},LISTENER_GRACE_MS)}}
const EMPTY:State={activeOrders:[],pastOrders:[],activeLoading:false,historyLoading:false,historyReady:true,hasMore:false,error:""};
export function useCustomerOrders(user:User|null|undefined){
 const[state,setState]=useState<State>(()=>user?entry(user.uid).state:EMPTY);
 useEffect(()=>{if(!user){setState(EMPTY);return}const current=entry(user.uid);setState(current.state);return subscribe(user.uid,setState)},[user?.uid]);
 const loadMore=useCallback(async()=>{if(user)await loadHistory(user.uid,entry(user.uid))},[user?.uid]);
 const orders=useMemo(()=>[...state.activeOrders,...state.pastOrders].sort(newestFirst),[state.activeOrders,state.pastOrders]);
 return{...state,orders,loading:state.activeLoading||(!state.historyReady&&state.historyLoading),loadMore};
}
