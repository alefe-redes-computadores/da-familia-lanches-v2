"use client";

import { useEffect, useState } from "react";
import { useUIStore } from "@/store/ui";
import styles from "./PrivacyBanner.module.css";

const STORAGE_KEY = "dfl-privacy-accepted";

export function PrivacyBanner() {
  const [visible, setVisible] = useState(false);
  const openModal = useUIStore((state) => state.openModal);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return;
    const timer = window.setTimeout(() => setVisible(true), 700);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <aside className={styles.banner} aria-label="Aviso de privacidade">
      <div><strong>Cookies e privacidade</strong><p>Usamos apenas o necessário para manter carrinho, login e preferências.</p></div>
      <div className={styles.actions}><button className={styles.terms} type="button" onClick={() => openModal("terms")}>Ver política</button><button className={styles.accept} type="button" onClick={() => { localStorage.setItem(STORAGE_KEY, "true"); setVisible(false); }}>Entendi</button></div>
    </aside>
  );
}
