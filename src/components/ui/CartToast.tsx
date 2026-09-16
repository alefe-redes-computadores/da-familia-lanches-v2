"use client";
import { useEffect } from "react";
import { useUIStore } from "@/store/ui";
import styles from "./CartToast.module.css";
export function CartToast() {
  const toast = useUIStore((s) => s.cartToast);
  const hide = useUIStore((s) => s.hideCartToast);
  useEffect(() => { if (!toast) return; const id = window.setTimeout(hide, 4200); return () => window.clearTimeout(id); }, [toast, hide]);
  if (!toast) return null;
  return <div className={styles.host} aria-live="polite"><div className={styles.toast} role="status"><div className={styles.icon}>{toast.kind === "remove" ? "−" : toast.kind === "restore" ? "↩" : "✓"}</div><div className={styles.copy}><strong>{toast.title}</strong>{toast.message && <span>{toast.message}</span>}</div>{toast.actionLabel && toast.onAction && <button type="button" className={styles.action} onClick={() => { const fn = toast.onAction; hide(); fn?.(); }}>{toast.actionLabel}</button>}<button type="button" className={styles.close} aria-label="Fechar aviso" onClick={hide}>×</button></div></div>;
}
