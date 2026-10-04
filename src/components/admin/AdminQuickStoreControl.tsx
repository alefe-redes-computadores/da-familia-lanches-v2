"use client";

import { useEffect, useState } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { Bot, DoorOpen, DoorClosed, FlaskConical, X, Store, CheckCircle2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { haptic } from "@/lib/haptics";
import type { StoreMode, StoreSettings } from "@/lib/storeSchedule";
import styles from "./AdminQuickStoreControl.module.css";
import { useAdminConfirm } from "@/components/admin/ui/AdminExperienceProvider";

const MODES: Array<{ mode: StoreMode; title: string; description: string; icon: typeof Bot }> = [
  { mode: "auto", title: "Automático", description: "Segue agenda e exceções", icon: Bot },
  { mode: "force_open", title: "Abrir agora", description: "Ignora a agenda até voltar ao automático", icon: DoorOpen },
  { mode: "force_closed", title: "Fechar agora", description: "Fecha temporariamente a loja", icon: DoorClosed },
  { mode: "test_open", title: "Manutenção", description: "Somente contas de teste liberadas", icon: FlaskConical },
];

export function AdminQuickStoreControl({ open, settings, stateLabel, stateDetail, onClose, onOpenFull }:{
  open:boolean; settings:StoreSettings; stateLabel:string; stateDetail:string; onClose:()=>void; onOpenFull:()=>void;
}) {
  const confirm = useAdminConfirm();
  const [busy,setBusy]=useState<StoreMode|null>(null);
  const [message,setMessage]=useState("");

  useEffect(()=>{
    if(!open)return;
    const previous=document.body.style.overflow;
    document.body.style.overflow="hidden";
    const key=(event:KeyboardEvent)=>{if(event.key==="Escape"&&!busy)onClose()};
    window.addEventListener("keydown",key);
    return()=>{document.body.style.overflow=previous;window.removeEventListener("keydown",key)};
  },[open,busy,onClose]);

  if(!open)return null;

  const choose=async(mode:StoreMode)=>{
    if(busy||settings.mode===mode)return;
    if(mode==="force_open"||mode==="force_closed"){
      const approved=await confirm({
        title:mode==="force_open"?"Abrir a loja agora?":"Fechar a loja agora?",
        message:mode==="force_open"
          ?"A agenda será ignorada até você voltar ao modo Automático."
          :"A loja ficará fechada manualmente até você voltar ao modo Automático.",
        confirmLabel:mode==="force_open"?"Abrir loja":"Fechar loja",
        tone:mode==="force_closed"?"danger":"warning",
      });
      if(!approved)return;
    }

    setBusy(mode);setMessage("");haptic("step");
    try{
      await setDoc(doc(db,"settings","loja"),{mode,updatedAt:serverTimestamp()},{merge:true});
      setMessage("Modo atualizado.");haptic("success");
      window.setTimeout(()=>onClose(),650);
    }catch(error){
      console.error("[admin/quick-store]",error);
      setMessage("Não foi possível alterar o funcionamento.");
      haptic("error");
    }finally{setBusy(null)}
  };

  return <div className={styles.backdrop} onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onClose()}}>
    <section className={styles.sheet} role="dialog" aria-modal="true" aria-label="Controle rápido da loja">
      <header>
        <div className={styles.storeIcon}><Store size={19}/></div>
        <div className={styles.headCopy}><span>CONTROLE RÁPIDO</span><strong>Loja {stateLabel}</strong><small>{stateDetail}</small></div>
        <button type="button" className={styles.close} onClick={()=>{haptic("step");onClose()}} aria-label="Fechar"><X size={18}/></button>
      </header>

      <div className={styles.modes}>
        {MODES.map(({mode,title,description,icon:Icon})=>{
          const active=settings.mode===mode;
          return <button type="button" key={mode} data-active={active} disabled={Boolean(busy)} onClick={()=>void choose(mode)}>
            <span className={styles.modeIcon}><Icon size={18}/></span>
            <span className={styles.modeCopy}><strong>{title}</strong><small>{description}</small></span>
            {active&&<CheckCircle2 size={17} className={styles.check}/>}
          </button>
        })}
      </div>

      {message&&<div className={styles.message}>{message}</div>}

      <button type="button" className={styles.full} onClick={()=>{haptic("step");onClose();onOpenFull()}}>
        Configurar horários, exceções e testes
      </button>
    </section>
  </div>
}
