"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getMessaging, getToken, isSupported as isMessagingSupported, onMessage } from "firebase/messaging";
import { app, auth } from "@/lib/firebase";
import styles from "./AdminPwa.module.css";

type InstallPromptEvent = Event & { prompt:()=>Promise<void>; userChoice:Promise<{outcome:"accepted"|"dismissed"}> };
type AdminAlert = { title:string; body:string; tag?:string; url?:string; forceVisible?:boolean };

const DISMISSED_KEY="dfl-admin-alert-setup-dismissed-v1";
const PUSH_SYNC_KEY="dfl-admin-push-sync-v20";
const PUSH_SYNC_MS=24*60*60*1000;

async function adminBearer(){
  await auth.authStateReady(); const user=auth.currentUser;
  if(!user) throw new Error("ADMIN_AUTH_REQUIRED");
  return user.getIdToken();
}
async function loadVapidPublicKey(){
  const token=await adminBearer();
  const response=await fetch("/api/admin/push",{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
  const payload=await response.json().catch(()=>null) as {ok?:boolean;vapidPublicKey?:string;error?:string}|null;
  if(!response.ok||!payload?.ok||!payload.vapidPublicKey) throw new Error(payload?.error||`PUSH_CONFIG_HTTP_${response.status}`);
  return payload.vapidPublicKey;
}
async function persistPushToken(pushToken:string){
  const token=await adminBearer();
  const response=await fetch("/api/admin/push",{method:"POST",headers:{Authorization:`Bearer ${token}`,"content-type":"application/json"},body:JSON.stringify({token:pushToken,userAgent:navigator.userAgent}),cache:"no-store"});
  if(!response.ok) throw new Error(`PUSH_SUBSCRIBE_HTTP_${response.status}`);
}
async function syncRemotePush(registration:ServiceWorkerRegistration){
  if(!("Notification" in window)||Notification.permission!=="granted") return false;
  if(!(await isMessagingSupported())) return false;
  const vapidKey=await loadVapidPublicKey();
  const pushToken=await getToken(getMessaging(app),{vapidKey,serviceWorkerRegistration:registration});
  if(!pushToken) throw new Error("PUSH_TOKEN_EMPTY");
  await persistPushToken(pushToken);
  localStorage.setItem(PUSH_SYNC_KEY,String(Date.now()));
  return true;
}

export function AdminPwa(){
  const [online,setOnline]=useState(true);
  const [permission,setPermission]=useState<NotificationPermission|"unsupported">("unsupported");
  const [installPrompt,setInstallPrompt]=useState<InstallPromptEvent|null>(null);
  const [dismissed,setDismissed]=useState(true);
  const registrationRef=useRef<ServiceWorkerRegistration|null>(null);

  const syncPush=useCallback(async()=>{
    const registration=registrationRef.current||await navigator.serviceWorker?.ready;
    if(!registration)return false;
    return syncRemotePush(registration);
  },[]);

  useEffect(()=>{
    setOnline(navigator.onLine);
    setDismissed(localStorage.getItem(DISMISSED_KEY)==="1");
    setPermission("Notification" in window?Notification.permission:"unsupported");

    const adminHost=window.location.hostname==="admin.dafamilialanches.com.br";
    const scope=adminHost?"/":"/admin/";
    if("serviceWorker" in navigator){
      navigator.serviceWorker.register("/admin-sw.js?v=21.3",{scope}).then(async(registration)=>{
        registrationRef.current=registration; await registration.update();
        if("Notification" in window&&Notification.permission==="granted"){
          const lastSync=Number(localStorage.getItem(PUSH_SYNC_KEY)||0);
          if(!Number.isFinite(lastSync)||Date.now()-lastSync>PUSH_SYNC_MS)
            void syncRemotePush(registration).catch((error)=>console.warn("[admin-pwa] push remoto ainda não sincronizado",error));
        }
      }).catch((error)=>console.warn("[admin-pwa] Service worker indisponível.",error));
    }

    const onOnline=()=>setOnline(true); const onOffline=()=>setOnline(false);
    const onInstall=(event:Event)=>{event.preventDefault();setInstallPrompt(event as InstallPromptEvent);setDismissed(false);};
    const onAlert=(event:Event)=>{
      const detail=(event as CustomEvent<AdminAlert>).detail;
      if(!detail||!("Notification" in window)||Notification.permission!=="granted")return;
      const message={type:"DFL_ADMIN_NOTIFY",payload:detail}; const registration=registrationRef.current;
      if(registration?.active)registration.active.postMessage(message);
      else void navigator.serviceWorker?.ready.then((ready)=>ready.active?.postMessage(message));
    };
    const onBadge=(event:Event)=>{
      const count=Number((event as CustomEvent<{count?:number}>).detail?.count||0);
      const badgeNavigator=navigator as Navigator&{setAppBadge?:(value?:number)=>Promise<void>;clearAppBadge?:()=>Promise<void>};
      if(count>0)void badgeNavigator.setAppBadge?.(count).catch(()=>undefined); else void badgeNavigator.clearAppBadge?.().catch(()=>undefined);
    };

    window.addEventListener("online",onOnline);window.addEventListener("offline",onOffline);window.addEventListener("beforeinstallprompt",onInstall);window.addEventListener("dfl:admin-alert",onAlert);window.addEventListener("dfl:admin-badge",onBadge);
    return()=>{window.removeEventListener("online",onOnline);window.removeEventListener("offline",onOffline);window.removeEventListener("beforeinstallprompt",onInstall);window.removeEventListener("dfl:admin-alert",onAlert);window.removeEventListener("dfl:admin-badge",onBadge);};
  },[]);

  useEffect(() => {
    let active = true;
    let stop: (() => void) | undefined;

    void isMessagingSupported()
      .then((supported) => {
        if (!active || !supported) return;
        stop = onMessage(getMessaging(app), (payload) => {
          const data = payload.data ?? {};
          if (data.type !== "admin.new_order" || !data.orderId) return;
          window.dispatchEvent(new CustomEvent("dfl:admin-push-foreground", { detail: data }));
        });
      })
      .catch((error) => console.warn("[admin-pwa] foreground push indisponível", error));

    return () => {
      active = false;
      stop?.();
    };
  }, []);

  const enableNotifications=async()=>{
    if(!("Notification" in window))return;
    const result=await Notification.requestPermission(); setPermission(result); if(result!=="granted")return;
    setDismissed(true);localStorage.removeItem(DISMISSED_KEY);
    try{await syncPush();}catch(error){console.warn("[admin-pwa] alerta local ativo; push remoto pendente",error);}
    registrationRef.current?.active?.postMessage({type:"DFL_ADMIN_NOTIFY",payload:{title:"Alertas ativados",body:"O DFL Admin avisará quando um pedido novo entrar.",tag:"admin-alerts-ready",url:"/admin"}});
  };
  const install=async()=>{if(!installPrompt)return;await installPrompt.prompt();await installPrompt.userChoice;setInstallPrompt(null);};
  const close=()=>{localStorage.setItem(DISMISSED_KEY,"1");setDismissed(true);};
  const needsPermission=permission==="default"; const showSetup=!dismissed&&(needsPermission||Boolean(installPrompt));

  return <>
    {!online&&<div className={styles.offline} role="status">Sem internet · ações ficam bloqueadas até reconectar</div>}
    {showSetup&&<aside className={styles.setup} aria-label="Configuração do DFL Admin"><div><b>Deixe o Admin pronto para a operação</b><span>Ative os alertas e instale o aplicativo neste aparelho.</span></div><div className={styles.actions}>{needsPermission&&<button type="button" onClick={()=>void enableNotifications()}>Ativar alertas</button>}{installPrompt&&<button type="button" onClick={()=>void install()}>Instalar app</button>}<button type="button" className={styles.close} aria-label="Agora não" onClick={close}>×</button></div></aside>}
  </>;
}
