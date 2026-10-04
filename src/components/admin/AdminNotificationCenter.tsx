"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BellRing, PackageCheck, Volume2, RefreshCw, Send, ShieldCheck, Smartphone, Radio, X } from "lucide-react";
import { haptic } from "@/lib/haptics";
import {
  DEFAULT_ADMIN_NOTIFICATION_PREFS,
  readAdminNotificationPrefs,
  writeAdminNotificationPrefs,
  type AdminNotificationPrefs,
} from "@/lib/adminNotificationPrefs";
import styles from "./AdminNotificationCenter.module.css";

type PermissionState = NotificationPermission | "unsupported";

export function AdminNotificationCenter({
  open,
  onClose,
  attentionCount,
}: {
  open: boolean;
  onClose: () => void;
  attentionCount: number;
}) {
  const [prefs, setPrefs] = useState<AdminNotificationPrefs>(DEFAULT_ADMIN_NOTIFICATION_PREFS);
  const [permission, setPermission] = useState<PermissionState>("unsupported");
  const [serviceWorkerReady, setServiceWorkerReady] = useState(false);
  const [lastSync, setLastSync] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const refreshStatus = useCallback(() => {
    setPrefs(readAdminNotificationPrefs());
    setPermission("Notification" in window ? Notification.permission : "unsupported");
    setLastSync(Number(localStorage.getItem("dfl-admin-push-sync-v20") || 0));
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.ready.then((r) => setServiceWorkerReady(Boolean(r.active))).catch(() => setServiceWorkerReady(false));
    } else {
      setServiceWorkerReady(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    refreshStatus();
    const timer = window.setInterval(refreshStatus, 1500);
    const onPrefs = () => refreshStatus();
    window.addEventListener("dfl:admin-notification-prefs-changed", onPrefs);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("dfl:admin-notification-prefs-changed", onPrefs);
    };
  }, [open, refreshStatus]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const environment = useMemo(() => {
    if (typeof document === "undefined") return "Web";
    return document.referrer.startsWith("android-app://") ||
      window.matchMedia("(display-mode: standalone)").matches
      ? "Aplicativo / TWA"
      : "Navegador / PWA";
  }, [open]);

  const savePrefs = (patch: Partial<AdminNotificationPrefs>) => {
    haptic("step");
    const next = { ...prefs, ...patch };
    setPrefs(next);
    writeAdminNotificationPrefs(next);
  };

  const toggleNewOrders = async (enabled: boolean) => {
    haptic("step");
    if (!enabled) {
      savePrefs({ newOrders: false });
      setBusy("disable");
      setMessage("Desativando push deste aparelho…");
      window.dispatchEvent(new Event("dfl:admin-push-disable"));
      window.setTimeout(() => {
        setBusy(null);
        setMessage("Novos pedidos desativados neste aparelho.");
        refreshStatus();
      }, 800);
      return;
    }

    if (!("Notification" in window)) {
      setMessage("Este ambiente não oferece notificações.");
      return;
    }

    setBusy("enable");
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") {
        savePrefs({ newOrders: false });
        haptic("error");
        setMessage(result === "denied"
          ? "Bloqueado pelo Android/navegador. Libere a permissão do DFL Admin nas configurações."
          : "Permissão ainda não concedida.");
        return;
      }
      savePrefs({ newOrders: true });
      setMessage("Sincronizando este aparelho…");
      window.dispatchEvent(new Event("dfl:admin-push-resync"));
      window.setTimeout(() => {
        refreshStatus();
        setMessage("Alertas de novos pedidos ativados.");
        haptic("success");
      }, 900);
    } finally {
      window.setTimeout(() => setBusy(null), 950);
    }
  };

  const resync = () => {
    haptic("step");
    setBusy("sync");
    setMessage("Revalidando token e Service Worker…");
    window.dispatchEvent(new Event("dfl:admin-push-resync"));
    window.setTimeout(() => {
      refreshStatus();
      setBusy(null);
      setMessage("Diagnóstico atualizado.");
      haptic("success");
    }, 1100);
  };

  const testNotification = () => {
    haptic("step");
    if (permission !== "granted") {
      setMessage("Primeiro permita as notificações.");
      haptic("error");
      return;
    }
    setBusy("test");
    window.dispatchEvent(new CustomEvent("dfl:admin-alert", {
      detail: {
        title: "DFL Admin · teste",
        body: "Se você recebeu este aviso, o canal local do Admin está respondendo.",
        tag: `admin-v31-test-${Date.now()}`,
        url: "/admin",
        forceVisible: true,
      },
    }));
    setMessage("Notificação de teste solicitada.");
    window.setTimeout(() => setBusy(null), 600);
  };

  if (!open) return null;

  const permissionLabel =
    permission === "granted" ? "Permitido" :
    permission === "denied" ? "Bloqueado" :
    permission === "default" ? "Não solicitado" : "Indisponível";

  const syncLabel = lastSync > 0
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(lastSync))
    : "Nunca sincronizado";

  return (
    <div className={styles.backdrop} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className={styles.sheet} role="dialog" aria-modal="true" aria-label="Central de notificações">
        <header className={styles.header}>
          <div><span>CENTRAL DO ADMIN</span><h2>Notificações</h2><p>Escolha os alertas deste aparelho e confira se o canal está saudável.</p></div>
          <button type="button" onClick={() => { haptic("step"); onClose(); }} aria-label="Fechar central"><X size={18} /></button>
        </header>

        {attentionCount > 0 && (
          <div className={styles.attention}><i/><div><strong>{attentionCount} {attentionCount === 1 ? "pedido pede" : "pedidos pedem"} atenção</strong><span>Contagem da operação atual, sem listener adicional.</span></div></div>
        )}

        <div className={styles.permission} data-state={permission}>
          <div><small>PERMISSÃO DO APARELHO</small><strong>{permissionLabel}</strong><span>{permission === "denied" ? "O DFL está configurado, mas o aparelho bloqueou os avisos." : permission === "granted" ? "O aparelho permite notificações do DFL Admin." : "Ao ativar novos pedidos, o sistema solicitará a permissão."}</span></div>
          <b>{permission === "granted" ? "OK" : permission === "denied" ? "!" : "…"}</b>
        </div>

        <div className={styles.preferences}>
          <Preference icon={<BellRing size={18} />} title="Novo pedido" description="Push e alerta operacional quando um pedido entra." checked={prefs.newOrders} disabled={busy !== null} onChange={(v) => void toggleNewOrders(v)} />
          <Preference icon={<PackageCheck size={18} />} title="Pedido pronto" description="Aviso local quando a cozinha libera para expedição." checked={prefs.readyOrders} disabled={busy !== null} onChange={(v) => savePrefs({ readyOrders: v })} />
          <Preference icon={<Volume2 size={18} />} title="Som e vibração" description="Alarme local para chamar atenção durante a operação." checked={prefs.soundAndVibration} disabled={busy !== null} onChange={(v) => savePrefs({ soundAndVibration: v })} />
        </div>

        <div className={styles.diagnostics}>
          <div className={styles.diagTitle}><div><span>DIAGNÓSTICO</span><strong>Canal deste aparelho</strong></div><button type="button" onClick={resync} disabled={busy !== null}><RefreshCw size={14} className={busy === "sync" ? styles.spin : undefined} />{busy === "sync" ? "Verificando…" : "Revalidar"}</button></div>
          <div className={styles.diagGrid}>
            <Diagnostic icon={<Smartphone size={15} />} label="Ambiente" value={environment} ok />
            <Diagnostic icon={<ShieldCheck size={15} />} label="Permissão" value={permissionLabel} ok={permission === "granted"} />
            <Diagnostic icon={<Radio size={15} />} label="Service Worker" value={serviceWorkerReady ? "Ativo" : "Não confirmado"} ok={serviceWorkerReady} />
            <Diagnostic icon={<RefreshCw size={15} />} label="Última sync" value={syncLabel} ok={lastSync > 0} />
          </div>
          <button type="button" className={styles.testButton} onClick={testNotification} disabled={busy !== null || permission !== "granted"}><Send size={15} />{busy === "test" ? "Enviando teste…" : "Enviar notificação de teste"}</button>
        </div>

        {message && <div className={styles.message} role="status">{message}</div>}
        <footer className={styles.footer}><span>Preferências ficam neste aparelho. Nenhum listener Firestore novo é criado.</span><button type="button" onClick={() => { haptic("step"); onClose(); }}>Concluir</button></footer>
      </section>
    </div>
  );
}

function Preference({ icon, title, description, checked, disabled, onChange }:{
  icon: React.ReactNode; title:string; description:string; checked:boolean; disabled:boolean; onChange:(value:boolean)=>void;
}) {
  return <label className={styles.preference}><span className={styles.prefIcon}>{icon}</span><span className={styles.prefCopy}><strong>{title}</strong><small>{description}</small></span><input type="checkbox" checked={checked} disabled={disabled} onChange={(e)=>onChange(e.target.checked)}/><i aria-hidden="true"/></label>;
}

function Diagnostic({ icon, label, value, ok }:{icon:React.ReactNode; label:string; value:string; ok:boolean}) {
  return <div className={styles.diagnostic} data-ok={ok}><span className={styles.diagIcon}>{icon}</span><i/><span><small>{label}</small><strong>{value}</strong></span></div>;
}
