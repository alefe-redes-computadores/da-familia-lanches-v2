"use client";

import { useUIStore } from "@/store/ui";
import { ModalBase } from "@/components/ui/ModalBase";
import styles from "./LoginIntentModal.module.css";

export function LoginIntentModal() {
  const closeModal = useUIStore((s) => s.closeModal);
  const openModal = useUIStore((s) => s.openModal);

  return (
    <ModalBase title="Seu pedido já começou" onClose={closeModal}>
      <div className={styles.wrap}>
        <div className={styles.icon} aria-hidden="true">✓</div>
        <div className={styles.copy}>
          <span className={styles.eyebrow}>ITEM ADICIONADO</span>
          <h3>Quer salvar seu pedido e histórico?</h3>
          <p>Entrar é opcional. Com Google, seus pedidos ficam vinculados à sua conta.</p>
        </div>

        <button className={styles.primary} type="button" onClick={() => openModal("login")}>
          Entrar com Google
        </button>
        <button className={styles.secondary} type="button" onClick={closeModal}>
          Continuar sem entrar
        </button>
      </div>
    </ModalBase>
  );
}
