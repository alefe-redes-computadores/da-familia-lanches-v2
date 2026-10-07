"use client";
export type GuestIdentity={name:string;phone:string;cep?:string;street?:string;number?:string;district?:string;complement?:string;reference?:string;lastDeliveryMode?:"delivery"|"pickup";paymentPreference?:"pix"|"cartao"|"dinheiro";updatedAt:number};
export type GuestOrderMemory={id:string;status:string;total:number;deliveryMode:"delivery"|"pickup";scheduledFor?:string|null;scheduledLabel?:string|null;createdAt:number;customerName:string;items:Array<{name:string;quantity:number}>};
const PROFILE="dfl:guest-profile:v1", ORDERS="dfl:guest-orders:v1", PROMPT="dfl:guest-google-prompt:v1", MAX=20;
export type GuestPromptState={lastShownAt?:number;dismissals:number;stage:number;lastContext?:string};
const safeParse=<T,>(raw:string|null,fallback:T):T=>{try{return raw?JSON.parse(raw) as T:fallback}catch{return fallback}};
export function readGuestIdentity():GuestIdentity|null{if(typeof window==="undefined")return null;const v=safeParse<GuestIdentity|null>(localStorage.getItem(PROFILE),null);return v&&v.name? v:null}
export function saveGuestIdentity(input:Omit<GuestIdentity,"updatedAt">){if(typeof window==="undefined")return;try{localStorage.setItem(PROFILE,JSON.stringify({...input,updatedAt:Date.now()}));window.dispatchEvent(new Event("dfl:guest-continuity"))}catch{}}
export function readGuestOrders():GuestOrderMemory[]{if(typeof window==="undefined")return[];return safeParse<GuestOrderMemory[]>(localStorage.getItem(ORDERS),[]).filter(x=>x&&x.id).slice(0,MAX)}
export function rememberGuestOrder(order:GuestOrderMemory){if(typeof window==="undefined")return;try{const next=[order,...readGuestOrders().filter(x=>x.id!==order.id)].slice(0,MAX);localStorage.setItem(ORDERS,JSON.stringify(next));window.dispatchEvent(new Event("dfl:guest-continuity"))}catch{}}
export function readGuestPrompt():GuestPromptState{if(typeof window==="undefined")return{dismissals:0,stage:0};return safeParse<GuestPromptState>(localStorage.getItem(PROMPT),{dismissals:0,stage:0})}
export function shouldSuggestGoogle(context="profile"){const count=readGuestOrders().length;if(count<2)return false;const p=readGuestPrompt(),now=Date.now(),cooldown=p.dismissals>=2?7*86400000:p.dismissals===1?3*86400000:86400000;return context==="menu"||!p.lastShownAt||now-p.lastShownAt>=cooldown}
export function markGooglePromptShown(context:string){if(typeof window==="undefined")return;const p=readGuestPrompt();localStorage.setItem(PROMPT,JSON.stringify({...p,lastShownAt:Date.now(),stage:Math.max(p.stage,readGuestOrders().length),lastContext:context}))}
export function dismissGooglePrompt(){if(typeof window==="undefined")return;const p=readGuestPrompt();localStorage.setItem(PROMPT,JSON.stringify({...p,lastShownAt:Date.now(),dismissals:p.dismissals+1}))}
export function clearGuestContinuity(){if(typeof window==="undefined")return;localStorage.removeItem(PROFILE);localStorage.removeItem(ORDERS);localStorage.removeItem(PROMPT);window.dispatchEvent(new Event("dfl:guest-continuity"))}

export function guestContinuitySummary(){const profile=readGuestIdentity(),orders=readGuestOrders();return{profile,orders,count:orders.length,firstName:profile?.name?.trim().split(/\s+/)[0]||"",latest:orders[0]||null}}
