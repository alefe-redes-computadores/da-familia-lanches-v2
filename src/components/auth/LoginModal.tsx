"use client";

import { useState } from "react";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { ModalBase } from "@/components/ui/ModalBase";
import { useUIStore, type ModalType } from "@/store/ui";
import styles from "./LoginModal.module.css";

type LoginData = { returnTo?: ModalType } | null;

export function LoginModal() {
  const closeModal = useUIStore((s) => s.closeModal);
  const openModal = useUIStore((s) => s.openModal);
  const modalData = useUIStore((s) => s.modalData) as LoginData;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);

      const returnTo = modalData?.returnTo;
      if (returnTo && returnTo !== "login") {
        openModal(returnTo);
      } else {
        closeModal();
      }
    } catch (err) {
      console.error("Erro no login Google:", err);
      setError("Não foi possível entrar agora. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalBase title="Entrar na Da Família" onClose={closeModal}>
      <div className={styles.wrap}>
        <div className={styles.brand}>DFL</div>
        <div className={styles.copy}>
          <span>RÁPIDO E SEGURO</span>
          <h3>Seus pedidos e seu histórico em um só lugar.</h3>
          <p>Use sua conta Google. Você volta para o fluxo de onde parou depois do login.</p>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <button className={styles.google} type="button" onClick={handleGoogleLogin} disabled={loading}>
          <svg width="21" height="21" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {loading ? "Conectando..." : "Continuar com Google"}
        </button>

        <small>O cardápio continua livre para navegar sem login.</small>
      </div>
    </ModalBase>
  );
}
