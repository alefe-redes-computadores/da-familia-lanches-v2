"use client";

import { AlertTriangle, CircleCheck, Info, LoaderCircle, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { haptic } from "@/lib/haptics";

export type AdminFeedbackTone = "progress" | "success" | "error" | "info";
export type AdminFeedbackInput = {
  tone: AdminFeedbackTone;
  title: string;
  message: string;
  key?: string;
  actionLabel?: string;
  onAction?: () => void;
};
type FeedbackItem = AdminFeedbackInput & { id: string; createdAt: number };
type ConfirmTone = "default" | "danger" | "warning";
export type AdminConfirmInput = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
};
type ConfirmState = AdminConfirmInput & { resolve: (value: boolean) => void };
type AdminExperienceValue = {
  show: (input: AdminFeedbackInput) => string;
  dismiss: (idOrKey: string) => void;
  confirm: (input: AdminConfirmInput) => Promise<boolean>;
};

const Context = createContext<AdminExperienceValue | null>(null);
const makeId = () => `admin-feedback-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;

export function AdminExperienceProvider({children}:{children:ReactNode}) {
  const [items,setItems]=useState<FeedbackItem[]>([]);
  const [confirmState,setConfirmState]=useState<ConfirmState|null>(null);
  const timers=useRef(new Map<string,number>());

  const clearTimer=useCallback((id:string)=>{
    const timer=timers.current.get(id);
    if(timer){window.clearTimeout(timer);timers.current.delete(id)}
  },[]);

  const dismiss=useCallback((idOrKey:string)=>{
    setItems(current=>{
      for(const item of current)if(item.id===idOrKey||item.key===idOrKey)clearTimer(item.id);
      return current.filter(item=>item.id!==idOrKey&&item.key!==idOrKey);
    });
  },[clearTimer]);

  const show=useCallback((input:AdminFeedbackInput)=>{
    const id=makeId();
    setItems(current=>{
      let next=current;
      if(input.key){
        for(const item of current)if(item.key===input.key)clearTimer(item.id);
        next=next.filter(item=>item.key!==input.key);
      }
      if(input.tone!=="progress"){
        for(const item of next)if(item.tone==="progress")clearTimer(item.id);
        next=next.filter(item=>item.tone!=="progress");
      }
      const duplicate=next.find(item=>item.tone===input.tone&&item.title===input.title&&item.message===input.message);
      if(duplicate){clearTimer(duplicate.id);next=next.filter(item=>item.id!==duplicate.id)}
      return [...next,{...input,id,createdAt:Date.now()}].slice(-3);
    });
    if(input.tone!=="progress"){
      haptic(input.tone==="error"?"error":input.tone==="success"?"success":"step");
      const timer=window.setTimeout(()=>dismiss(id),input.tone==="error"?5600:4200);
      timers.current.set(id,timer);
    }
    return id;
  },[clearTimer,dismiss]);

  const confirm=useCallback((input:AdminConfirmInput)=>new Promise<boolean>(resolve=>{
    setConfirmState(current=>{current?.resolve(false);return{...input,resolve}});
    haptic("step");
  }),[]);

  const finishConfirm=useCallback((result:boolean)=>{
    setConfirmState(current=>{if(current)current.resolve(result);return null});
    if(result)haptic("step");
  },[]);

  useEffect(()=>()=>{for(const timer of timers.current.values())window.clearTimeout(timer);timers.current.clear()},[]);
  useEffect(()=>{
    if(!confirmState)return;
    const previous=document.body.style.overflow;
    document.body.style.overflow="hidden";
    const key=(event:KeyboardEvent)=>{if(event.key==="Escape")finishConfirm(false)};
    window.addEventListener("keydown",key);
    return()=>{document.body.style.overflow=previous;window.removeEventListener("keydown",key)};
  },[confirmState,finishConfirm]);

  const value=useMemo(()=>({show,dismiss,confirm}),[show,dismiss,confirm]);

  return <Context.Provider value={value}>
    {children}
    <div className="adminGlobalToasts" aria-live="polite">
      {items.map(item=><div key={item.id} className="adminGlobalToast" data-tone={item.tone} role={item.tone==="error"?"alert":"status"}>
        <span className="adminGlobalToastIcon">{item.tone==="progress"?<LoaderCircle size={18} className="adminGlobalSpinner"/>:item.tone==="success"?<CircleCheck size={18}/>:item.tone==="error"?<AlertTriangle size={18}/>:<Info size={18}/>}</span>
        <span className="adminGlobalToastCopy"><strong>{item.title}</strong><small>{item.message}</small></span>
        {item.actionLabel&&item.onAction?<button type="button" className="adminGlobalToastAction" onClick={()=>{item.onAction?.();dismiss(item.id)}}>{item.actionLabel}</button>:null}
        {item.tone!=="progress"?<button type="button" className="adminGlobalToastClose" onClick={()=>dismiss(item.id)} aria-label="Fechar aviso"><X size={16}/></button>:null}
      </div>)}
    </div>
    {confirmState?<div className="adminConfirmBackdrop" onMouseDown={event=>{if(event.target===event.currentTarget)finishConfirm(false)}}>
      <section className="adminConfirmDialog" data-tone={confirmState.tone||"default"} role="alertdialog" aria-modal="true" aria-labelledby="admin-confirm-title" aria-describedby="admin-confirm-message">
        <div className="adminConfirmIcon"><AlertTriangle size={20}/></div>
        <div className="adminConfirmCopy"><strong id="admin-confirm-title">{confirmState.title}</strong><p id="admin-confirm-message">{confirmState.message}</p></div>
        <div className="adminConfirmActions">
          <button type="button" data-admin-action="secondary" onClick={()=>finishConfirm(false)}>{confirmState.cancelLabel||"Cancelar"}</button>
          <button type="button" data-admin-action={confirmState.tone==="danger"?"danger":"primary"} autoFocus onClick={()=>finishConfirm(true)}>{confirmState.confirmLabel||"Confirmar"}</button>
        </div>
      </section>
    </div>:null}
  </Context.Provider>
}

export function useAdminFeedback(){
  const context=useContext(Context);
  if(!context)throw new Error("useAdminFeedback precisa estar dentro de AdminExperienceProvider.");
  return{show:context.show,dismiss:context.dismiss};
}
export function useAdminConfirm(){
  const context=useContext(Context);
  if(!context)throw new Error("useAdminConfirm precisa estar dentro de AdminExperienceProvider.");
  return context.confirm;
}
