"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bot, X } from "lucide-react";
import { useUIStore } from "@/store/ui";
import styles from "./DFLAssistFloatingNudge.module.css";

const sessionKey = "dfl:assist-floating-intro-r251";
const dismissKey = "dfl:assist-floating-dismissed-r251";
const tourKey = "dfl:assist-tour-v1";
const message = "Precisa de ajuda?";
type Phase = "idle" | "typing" | "hold" | "compact";

/** Convite contextual: ocorre uma vez por sessão. Não consome catálogo, dados ou rede. */
export function DFLAssistFloatingNudge() {
  const pathname = usePathname();
  const activeModal = useUIStore((state) => state.activeModal);
  const [pastThreshold, setPastThreshold] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [inputActive, setInputActive] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [length, setLength] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    try { setDismissed(localStorage.getItem(dismissKey) === "1" || localStorage.getItem(tourKey) === "1"); }
    catch { setDismissed(true); }
    const onAssistOpened = () => {
      setDismissed(true);
      try { localStorage.setItem(dismissKey, "1"); } catch { /* storage opcional */ }
    };
    window.addEventListener("dfl:assist-open", onAssistOpened);
    const focusedInput = () => {
      const node = document.activeElement;
      setInputActive(node instanceof HTMLElement && Boolean(node.closest("input,textarea,select,[contenteditable=true]")));
    };
    const onBlur = () => window.setTimeout(focusedInput, 0);
    document.addEventListener("focusin", focusedInput);
    document.addEventListener("focusout", onBlur);
    return () => { window.removeEventListener("dfl:assist-open", onAssistOpened); document.removeEventListener("focusin", focusedInput); document.removeEventListener("focusout", onBlur); };
  }, []);

  useEffect(() => {
    if (pathname !== "/") { setPastThreshold(false); return; }
    let frame = 0;
    const measure = () => {
      frame = 0;
      setPastThreshold(window.scrollY >= 240);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [pathname]);

  useEffect(() => {
    if (!pastThreshold || pathname !== "/" || activeModal || dismissed || started.current) return;
    started.current = true;
    let seen = false;
    try { seen = sessionStorage.getItem(sessionKey) === "1"; } catch { /* opcional */ }
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    if (seen) { setPhase("compact"); return; }
    if (reduceMotion) { setLength(message.length); setPhase("hold"); return; }
    setPhase("typing");
  }, [pastThreshold, pathname, activeModal, dismissed]);

  useEffect(() => {
    if (phase !== "typing") return;
    if (length >= message.length) {
      setPhase("hold");
      return;
    }
    const timer = window.setTimeout(() => setLength((value) => Math.min(message.length, value + 1)), 90);
    return () => window.clearTimeout(timer);
  }, [phase, length]);

  useEffect(() => {
    if (phase !== "hold") return;
    try { sessionStorage.setItem(sessionKey, "1"); } catch { /* opcional */ }
    const timer = window.setTimeout(() => setPhase("compact"), 6000);
    return () => window.clearTimeout(timer);
  }, [phase]);

  if (pathname !== "/" || !pastThreshold || Boolean(activeModal) || dismissed || inputActive || phase === "idle") return null;

  const open = () => {
    try { sessionStorage.setItem(sessionKey, "1"); } catch { /* opcional */ }
    window.dispatchEvent(new Event("dfl:assist-open"));
  };
  return (
    <aside className={styles.floating} aria-label="Ajuda para comprar">
      <button type="button" className={styles.trigger} data-glow={phase === "typing" || phase === "hold"} onClick={open}
        aria-label="Abrir DFL Assist para escolher ou finalizar o pedido">
        <span className={styles.avatar}><Bot size={19} aria-hidden="true" /></span>
        <span className={styles.copy} aria-hidden="true">
          {phase === "compact" ? "Ajuda" : message.slice(0, length)}
          {phase === "typing" && <span className={styles.caret} aria-hidden="true" />}
        </span>
      </button>
      <button type="button" className={styles.dismiss} onClick={() => { setDismissed(true); try { localStorage.setItem(dismissKey, "1"); } catch { /* opcional */ } }} aria-label="Ocultar sugestão de ajuda"><X size={15} /></button>
    </aside>
  );
}
