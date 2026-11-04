"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import { useUIStore } from "@/store/ui";
import styles from "./DFLAssistInvitation.module.css";

const inviteKey = "dfl:assist-invite-dismissed-v1";
const tourKey = "dfl:assist-tour-v1";

/** Convite de primeira visita, opcional e sem abrir um modal espontaneamente. */
export function DFLAssistInvitation() {
  const [eligible, setEligible] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const pathname = usePathname();
  const activeModal = useUIStore(state => state.activeModal);

  useEffect(() => {
    try { setEligible(!localStorage.getItem(inviteKey) && !localStorage.getItem(tourKey)); }
    catch { setEligible(false); }
    const update = () => setAtTop(window.scrollY < 100);
    update();
    window.addEventListener("scroll", update, { passive: true });
    const onOpened = () => { setEligible(false); try { localStorage.setItem(inviteKey, "1"); } catch {} };
    window.addEventListener("dfl:assist-open", onOpened);
    return () => { window.removeEventListener("scroll", update); window.removeEventListener("dfl:assist-open", onOpened); };
  }, []);

  if (!eligible || !atTop || pathname !== "/" || activeModal) return null;
  const dismiss = () => { setEligible(false); try { localStorage.setItem(inviteKey, "1"); } catch {} };
  const launch = () => { dismiss(); window.dispatchEvent(new CustomEvent("dfl:assist-open", { detail: { mode: "guide" } })); };

  return (
    <aside className={styles.invite} aria-label="Ajuda para fazer seu pedido">
      <button type="button" className={styles.close} onClick={dismiss} aria-label="Dispensar dica de ajuda"><X size={15}/></button>
      <div className={styles.title}><Sparkles size={17} aria-hidden="true"/><strong>Primeira vez por aqui?</strong></div>
      <p>Quer ajuda para escolher e finalizar seu pedido?</p>
      <button type="button" className={styles.launch} onClick={launch}>Ver guia de compra</button>
    </aside>
  );
}
