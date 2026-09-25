"use client";
import { useEffect,useMemo,useState } from "react";
import { mergeCategories,normalizeRemoteCategoryRecord,type CatalogCategory } from "@/lib/catalogCategories";
type ApiRecord={id?:unknown;data?:unknown}; type Payload={categories?:ApiRecord[]};
let cache:{remote:CatalogCategory[];ready:boolean}={remote:[],ready:false}; let inflight:Promise<void>|null=null; const listeners=new Set<(v:typeof cache)=>void>();
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:{};
function emit(){listeners.forEach(fn=>fn(cache))}
async function load(){if(cache.ready)return;if(inflight)return inflight;inflight=fetch("/api/public/catalog",{headers:{Accept:"application/json"}}).then(async r=>{if(!r.ok)throw new Error(`catalog_http_${r.status}`);return r.json() as Promise<Payload>}).then(p=>{const remote=(Array.isArray(p.categories)?p.categories:[]).map(x=>normalizeRemoteCategoryRecord(String(x?.id??""),obj(x?.data))).filter((x):x is CatalogCategory=>Boolean(x));cache={remote,ready:true};emit()}).catch(e=>{console.warn("[catalog] Categorias remotas indisponíveis; fallback local.",e);cache={remote:[],ready:true};emit()}).finally(()=>{inflight=null});return inflight}
function subscribe(fn:(v:typeof cache)=>void){listeners.add(fn);fn(cache);void load();return()=>{listeners.delete(fn);}}
export function useCatalogCategories(){const[state,setState]=useState(cache);useEffect(()=>subscribe(setState),[]);const categories=useMemo(()=>mergeCategories(state.remote),[state.remote]);const activeCategories=useMemo(()=>categories.filter(c=>c.active),[categories]);return{categories,activeCategories,loading:!state.ready,source:state.remote.length?"remote" as const:"fallback" as const,remoteCategories:state.remote.length}}
