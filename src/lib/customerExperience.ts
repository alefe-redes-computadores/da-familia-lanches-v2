"use client";
const KEY="dfl:cx:v56-1";
type CXState={lastAskedAt?:number;answeredOrderIds:string[]};
const read=():CXState=>{try{return JSON.parse(localStorage.getItem(KEY)||'{"answeredOrderIds":[]}')}catch{return{answeredOrderIds:[]}}};
export function shouldAskExperience(orderId:string){if(typeof window==="undefined"||!orderId)return false;const s=read();return !s.answeredOrderIds.includes(orderId)&&(!s.lastAskedAt||Date.now()-s.lastAskedAt>=86400000)}
export function markExperienceAnswered(orderId:string){if(typeof window==="undefined")return;const s=read();localStorage.setItem(KEY,JSON.stringify({lastAskedAt:Date.now(),answeredOrderIds:[...s.answeredOrderIds,orderId].slice(-30)}))}

export function markExperienceShown(){if(typeof window==="undefined")return;const s=read();localStorage.setItem(KEY,JSON.stringify({...s,lastAskedAt:Date.now()}))}
