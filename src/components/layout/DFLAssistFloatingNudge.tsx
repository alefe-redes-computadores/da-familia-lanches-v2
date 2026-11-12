"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bot, X } from "lucide-react";
import { useUIStore } from "@/store/ui";
import styles from "./DFLAssistFloatingNudge.module.css";

const sessionKey = "dfl:assist-floating-intro-r251";
const dismissKey = "dfl:assist-floating-dismissed-r61";
const message = "Precisa de ajuda?";
type Phase = "idle" | "typing" | "hold" | "compact";

/** Convite contextual: ocorre uma vez por sessão. Não consome catálogo, dados ou rede. */
export function DFLAssistFloatingNudge() {
  const pathname = usePathname();
  const activeModal = useUIStore((state) => state.activeModal);
  const [pastThreshold, setPastThreshold] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [inputActive, setInputActive] = useState(false);
  const [footerNear, setFooterNear] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [length, setLength] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    // R61: usar o Assist ou concluir o guia nunca desabilita o atalho flutuante.
    // A chave R251 confundia abertura automatica com dispensar pelo X.
    // R61 FIX1: ler storage em callback do frame, sem render em cascata no efeito.
    const storageFrame = window.requestAnimationFrame(() => {
      try { setDismissed(localStorage.getItem(dismissKey) === "1"); }
      catch { setDismissed(false); }
    });
    const focusedInput = () => {
      const node = document.activeElement;
      setInputActive(node instanceof HTMLElement && Boolean(node.closest("input,textarea,select,[contenteditable=true]")));
    };
    const onBlur = () => window.setTimeout(focusedInput, 0);
    document.addEventListener("focusin", focusedInput);
    document.addEventListener("focusout", onBlur);
    return () => { window.cancelAnimationFrame(storageFrame); document.removeEventListener("focusin", focusedInput); document.removeEventListener("focusout", onBlur); };
  }, []);

  useEffect(() => {
    if (pathname !== "/") return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      setPastThreshold(window.scrollY >= 240);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    frame = window.requestAnimationFrame(measure);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [pathname]);

  // R290: ao aproximar o rodape, libera os links e evita dois CTAs sobrepostos.
  useEffect(() => {
    if (pathname !== "/") return;
    const footer = document.querySelector<HTMLElement>('footer[data-dfl-campaign-footer="true"]');
    if (!footer || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      const near = Boolean(entry?.isIntersecting);
      setFooterNear(near);
      document.documentElement.dataset.dflFooterNear = near ? "true" : "false";
    }, { rootMargin: "0px 0px 130px 0px", threshold: 0 });
    observer.observe(footer);
    return () => { observer.disconnect(); document.documentElement.removeAttribute("data-dfl-footer-near"); };
  }, [pathname]);

  useEffect(() => {
    if (!pastThreshold || pathname !== "/" || activeModal || dismissed || started.current) return;
    const introFrame = window.requestAnimationFrame(() => {
      if (started.current) return;
      started.current = true;
      let seen = false;
      try { seen = sessionStorage.getItem(sessionKey) === "1"; } catch { /* opcional */ }
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
      if (seen) { setPhase("compact"); return; }
      if (reduceMotion) { setLength(message.length); setPhase("hold"); return; }
      setPhase("typing");
    });
    return () => window.cancelAnimationFrame(introFrame);
  }, [pastThreshold, pathname, activeModal, dismissed]);

  useEffect(() => {
    if (phase !== "typing") return;
    const timer = window.setTimeout(() => {
      if (length >= message.length) setPhase("hold");
      else setLength((value) => Math.min(message.length, value + 1));
    }, length >= message.length ? 0 : 90);
    return () => window.clearTimeout(timer);
  }, [phase, length]);

  useEffect(() => {
    if (phase !== "hold") return;
    try { sessionStorage.setItem(sessionKey, "1"); } catch { /* opcional */ }
    const timer = window.setTimeout(() => setPhase("compact"), 6000);
    return () => window.clearTimeout(timer);
  }, [phase]);

  if (pathname !== "/" || !pastThreshold || Boolean(activeModal) || dismissed || inputActive || footerNear || phase === "idle") return null;

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
