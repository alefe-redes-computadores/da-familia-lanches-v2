"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./CustomerPwaInvite.module.css";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
const COUNT_KEY = "dfl:customer-pwa-count-v1";
const COOLDOWN_KEY = "dfl:customer-pwa-next-invite-v1";
const COOLDOWN_MS = 30 * 86400_000;

/** Convite PWA: nenhum pedido/WhatsApp, nenhum prompt automatico, sem telemetria pessoal. */
export function CustomerPwaInvite() {
  const deferred = useRef<InstallPrompt | null>(null);
  const [eligible, setEligible] = useState(false);
  const [howTo, setHowTo] = useState(false);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const inspect = () => {
      const standalone = window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      setInstalled(standalone);
      try {
        const count = Math.max(0, Number(localStorage.getItem(COUNT_KEY)) || 0);
        const next = Number(localStorage.getItem(COOLDOWN_KEY)) || 0;
        setEligible(!standalone && count >= 2 && Date.now() >= next);
      } catch { setEligible(false); }
    };
    const onPrompt = (event: Event) => {
      event.preventDefault();
      deferred.current = event as InstallPrompt;
      inspect();
    };
    const onInstalled = () => { setInstalled(true); setEligible(false); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("dfl:pwa-order-confirmed", inspect);
    inspect();
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("dfl:pwa-order-confirmed", inspect);
    };
  }, []);
  if (!eligible || installed) return null;
  const dismiss = () => {
    try { localStorage.setItem(COOLDOWN_KEY, String(Date.now() + COOLDOWN_MS)); } catch {}
    setEligible(false);
  };
  const install = async () => {
    if (!deferred.current) { setHowTo(true); return; }
    try {
      const prompt = deferred.current;
      deferred.current = null;
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") setEligible(false);
      else dismiss();
    } catch { setHowTo(true); }
  };
  return (
    <section className={styles.invite} aria-label="Adicionar Da Familia Lanches a tela inicial">
      <div className={styles.top}><div><strong>🍔 Peça mais rápido da próxima vez</strong><p>Adicione Da Família à tela inicial. Não precisa baixar APK.</p></div>
        <button type="button" className={styles.close} onClick={dismiss} aria-label="Nao mostrar convite agora">×</button>
      </div>
      <div className={styles.actions}><button type="button" onClick={() => void install()}>Adicionar ao celular</button><button type="button" onClick={dismiss}>Agora não</button></div>
      {howTo && <p className={styles.instructions} role="status">No Chrome, abra o menu ⋮ e procure <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>. Em outros navegadores, use a opção equivalente do menu de compartilhamento. Se estiver em guia anônima, tente uma janela normal.</p>}
    </section>
  );
}
