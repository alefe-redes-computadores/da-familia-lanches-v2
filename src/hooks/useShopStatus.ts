"use client";
import{useEffect,useState}from"react";import{doc,onSnapshot}from"firebase/firestore";import{db}from"@/lib/firebase";
import{getScheduleShopStatus,type ShopStatus}from"@/lib/shopStatus";import{evaluateStoreStatus,normalizeStoreSettings,type StoreSettings}from"@/lib/storeSchedule";
export function useShopStatus():ShopStatus{const[status,setStatus]=useState<ShopStatus>(()=>getScheduleShopStatus());
 useEffect(()=>{let settings:StoreSettings|null=null;const refresh=()=>setStatus(settings?evaluateStoreStatus(settings):getScheduleShopStatus());const timer=window.setInterval(refresh,30000);
 const unsub=onSnapshot(doc(db,"settings","loja"),s=>{settings=s.exists()?normalizeStoreSettings(s.data()):null;refresh()},()=>{settings=null;refresh()});
 return()=>{clearInterval(timer);unsub()}},[]);return status}
