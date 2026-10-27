"use client";
import { useEffect, useState } from "react";
import { useUIStore } from "@/store/ui";
import styles from "./CartToast.module.css";
export function CartToast() {
  const toast = useUIStore((s) => s.cartToast);
  const hide = useUIStore((s) => s.hideCartToast);
  const [interacting, setInteracting] = useState(false);
  useEffect(() => { if (!toast || interacting) return; const id = window.setTimeout(hide, toast.onAction ? 9000 : 3000); return () => window.clearTimeout(id); }, [toast, hide, interacting]);
  if (!toast) return null;
  return <div className={styles.host} aria-live="polite"><div className={styles.toast} role="status"
    onMouseEnter={() => setInteracting(true)} onMouseLeave={() => setInteracting(false)}
    onFocusCapture={() => setInteracting(true)}
    onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setInteracting(false); }}><div className={styles.icon}>{toast.kind === "remove" ? "−" : toast.kind === "restore" ? "↩" : "✓"}</div><div className={styles.copy}><strong>{toast.title}</strong>{toast.message && <span>{toast.message}</span>}</div>{toast.actionLabel && toast.onAction && <button type="button" className={styles.action} onClick={() => { const fn = toast.onAction; hide(); fn?.(); }}>{toast.actionLabel}</button>}<button type="button" className={styles.close} aria-label="Fechar aviso" onClick={hide}>×</button></div></div>;
}
// DFL-R32-TOAST-TIMER
