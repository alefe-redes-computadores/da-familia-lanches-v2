"use client";

import styles from "./header.module.css";
import { useUIStore } from "@/store/ui";
import { useAuthStore } from "@/store/auth.store";

export function Header() {
  const openModal = useUIStore((s) => s.openModal);
  const currentUser = useAuthStore((s) => s.currentUser);

  const userName = currentUser?.displayName?.split(" ")[0] || currentUser?.email?.split("@")[0];

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <span className={styles.logo}>Da Família Lanches</span>
      </div>

      <div className={styles.right}>
        {/* Carrinho */}
        <button
          className={styles.iconBtn}
          aria-label="Abrir carrinho"
          onClick={() => (openModal as any)("cart")}
        >
          🛒
        </button>

        {/* Menu Hambúrguer Corrigido (Botão Nativo) */}
        <button
          className={styles.iconBtn}
          onClick={() => (openModal as any)("menu")}
          aria-label="Abrir menu"
          style={{ 
            fontSize: "26px", 
            background: "none", 
            border: "none", 
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          ☰
        </button>

        {/* Login ou Avatar */}
        {currentUser ? (
          <div 
            onClick={() => (openModal as any)("profile")}
            style={{ 
              background: "#f0f0f0", 
              padding: "8px 16px", 
              borderRadius: "20px", 
              fontWeight: "bold", 
              fontSize: "14px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            {currentUser.photoURL ? (
              <img src={currentUser.photoURL} alt="User" style={{width: 24, height: 24, borderRadius: "50%"}} />
            ) : (
              <span>👤</span>
            )}
            <span className={styles.userNameMobile}>{userName}</span>
          </div>
        ) : (
          <button
            className={styles.primaryBtn}
            onClick={() => (openModal as any)("login")}
          >
            Entrar
          </button>
        )}
      </div>
    </header>
  );
}
