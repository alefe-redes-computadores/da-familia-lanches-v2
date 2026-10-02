"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./AdminPwa.module.css";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type AdminAlert = {
  title: string;
  body: string;
  tag?: string;
  url?: string;
};

const DISMISSED_KEY = "dfl-admin-alert-setup-dismissed-v1";

export function AdminPwa() {
  const [online, setOnline] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    setOnline(navigator.onLine);
    setDismissed(localStorage.getItem(DISMISSED_KEY) === "1");
    setPermission("Notification" in window ? Notification.permission : "unsupported");

    const adminHost = window.location.hostname === "admin.dafamilialanches.com.br";
    const scope = adminHost ? "/" : "/admin/";
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/admin-sw.js?v=19", { scope })
        .then((registration) => {
          registrationRef.current = registration;
          void registration.update();
        })
        .catch((error) => console.warn("[admin-pwa] Service worker indisponível.", error));
    }

    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
      setDismissed(false);
    };
    const onAlert = (event: Event) => {
      const detail = (event as CustomEvent<AdminAlert>).detail;
      if (!detail || !("Notification" in window) || Notification.permission !== "granted") return;
      const message = { type: "DFL_ADMIN_NOTIFY", payload: detail };
      const registration = registrationRef.current;
      if (registration?.active) registration.active.postMessage(message);
      else void navigator.serviceWorker?.ready.then((ready) => ready.active?.postMessage(message));
    };
    const onBadge = (event: Event) => {
      const count = Number((event as CustomEvent<{ count?: number }>).detail?.count || 0);
      const badgeNavigator = navigator as Navigator & {
        setAppBadge?: (value?: number) => Promise<void>;
        clearAppBadge?: () => Promise<void>;
      };
      if (count > 0) void badgeNavigator.setAppBadge?.(count).catch(() => undefined);
      else void badgeNavigator.clearAppBadge?.().catch(() => undefined);
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("beforeinstallprompt", onInstall);
    window.addEventListener("dfl:admin-alert", onAlert);
    window.addEventListener("dfl:admin-badge", onBadge);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("beforeinstallprompt", onInstall);
      window.removeEventListener("dfl:admin-alert", onAlert);
      window.removeEventListener("dfl:admin-badge", onBadge);
    };
  }, []);

  const enableNotifications = async () => {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") {
      setDismissed(true);
      localStorage.removeItem(DISMISSED_KEY);
      registrationRef.current?.active?.postMessage({
        type: "DFL_ADMIN_NOTIFY",
        payload: {
          title: "Alertas ativados",
          body: "O DFL Admin avisará quando um pedido novo entrar.",
          tag: "admin-alerts-ready",
          url: "/admin",
        },
      });
    }
  };

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  const close = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  };

  const needsPermission = permission === "default";
  const showSetup = !dismissed && (needsPermission || Boolean(installPrompt));

  return <>
    {!online && <div className={styles.offline} role="status">Sem internet · ações ficam bloqueadas até reconectar</div>}
    {showSetup && <aside className={styles.setup} aria-label="Configuração do DFL Admin">
      <div><b>Deixe o Admin pronto para a operação</b><span>Ative os alertas e instale o aplicativo neste aparelho.</span></div>
      <div className={styles.actions}>
        {needsPermission && <button type="button" onClick={() => void enableNotifications()}>Ativar alertas</button>}
        {installPrompt && <button type="button" onClick={() => void install()}>Instalar app</button>}
        <button type="button" className={styles.close} aria-label="Agora não" onClick={close}>×</button>
      </div>
    </aside>}
  </>;
}
