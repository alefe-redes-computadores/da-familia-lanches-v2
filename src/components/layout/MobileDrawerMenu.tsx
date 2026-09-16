"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useUIStore } from "@/store/ui";
import styles from "./MobileDrawerMenu.module.css";



export function MobileDrawerMenu() {
  const activeModal = useUIStore((state) => state.activeModal);
  const closeModal = useUIStore((state) => state.closeModal);
  const openModal = useUIStore((state) => state.openModal);
  const currentUser = useAuthStore((state) => state.currentUser);
  const isOpen = activeModal === "menu";

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") closeModal(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeModal, isOpen]);



  if (!isOpen) return null;

  return (
    <div className={styles.root} role="dialog" aria-modal="true" aria-label="Menu">
      <button className={styles.backdrop} type="button" onClick={closeModal} aria-label="Fechar menu" />
      <aside className={styles.drawer}>
        <div className={styles.drawerHeader}>
          <div><span className={styles.eyebrow}>DA FAMÍLIA</span><strong className={styles.drawerTitle}>Sua conta e pedidos</strong></div>
          <button className={styles.closeBtn} type="button" onClick={closeModal} aria-label="Fechar">×</button>
        </div>
        <p className={styles.menuIntro}>As categorias ficam no cardápio principal. Aqui estão seus atalhos pessoais.</p>

        <div className={styles.quick}>
          <button type="button" onClick={() => { closeModal(); openModal(currentUser ? "orders" : "login"); }}><span>▤</span><div><b>Meus pedidos</b><small>Acompanhe e peça novamente</small></div></button>
          <button type="button" onClick={() => { closeModal(); openModal(currentUser ? "rewards" : "login"); }}><span>★</span><div><b>Meu progresso</b><small>Veja seu histórico na casa</small></div></button>
        </div>
      </aside>
    </div>
  );
}
