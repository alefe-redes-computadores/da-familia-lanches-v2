"use client";
import { useEffect,useState } from "react";
import { collection,getDocs,orderBy,query } from "firebase/firestore";
import { db } from "@/lib/firebase";
export type AnalyticsDayV2={dateKey:string;sales:number;revenue:number;subtotal:number;deliveryFees:number;discounts:number;delivery:number;pickup:number;scheduled:number;immediate:number;logisticsCompleted:number;payments:Record<string,number>;products:Record<string,number>;projectorVersion:number;updatedAt:string};
export function useAnalyticsReportsV2(enabled=true){const[days,setDays]=useState<AnalyticsDayV2[]>([]),[loading,setLoading]=useState(enabled),[error,setError]=useState(""),[reloadKey,setReloadKey]=useState(0);useEffect(()=>{if(!enabled){setLoading(false);return}let live=true;setLoading(true);setError("");getDocs(query(collection(db,"analytics_daily_v2"),orderBy("dateKey","desc"))).then(s=>{if(live){setDays(s.docs.map(d=>({dateKey:d.id,...d.data()} as AnalyticsDayV2)));setLoading(false)}}).catch(e=>{if(live){setError(e instanceof Error?e.message:"Falha ao carregar relatórios.");setLoading(false)}});return()=>{live=false}},[enabled,reloadKey]);return{days,loading,error,reload:()=>setReloadKey(v=>v+1)}}
