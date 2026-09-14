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
          <h3>Entre agora e deixe o final do pedido mais rápido.</h3>
          <p>
            O login com Google leva poucos segundos, vincula seus pedidos à sua conta
            e deixa o histórico disponível nos próximos acessos.
          </p>
        </div>

        <div className={styles.benefits}>
          <span><b>01</b> Histórico vinculado à sua conta</span>
          <span><b>02</b> Acompanhamento em tempo real</span>
          <span><b>03</b> Recompra mais rápida depois</span>
        </div>

        <button className={styles.primary} type="button" onClick={() => openModal("login")}>
          Entrar com Google
        </button>
        <button className={styles.secondary} type="button" onClick={closeModal}>
          Agora não — continuar vendo o cardápio
        </button>
        <small>Você pode continuar navegando sem entrar agora.</small>
      </div>
    </ModalBase>
  );
}
