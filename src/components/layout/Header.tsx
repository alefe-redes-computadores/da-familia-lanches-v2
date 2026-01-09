"use client";

import styles from "./header.module.css";
import { HamburgerButton } from "@/components/ui/HamburgerButton";
import { useUIStore } from "@/store/ui";
import { useAuthStore } from "@/store/auth.store"; // <--- Importante

export function Header() {
  const openModal = useUIStore((s) => s.openModal);
  const currentUser = useAuthStore((s) => s.currentUser); // Pegando o usuário

  // Pegando o primeiro nome ou email
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
          onClick={() => openModal("cart")}
        >
          🛒
        </button>

        {/* Menu Hambúrguer */}
        <HamburgerButton
          onClick={() => openModal("menu")}
          ariaLabel="Abrir menu"
        />

        {/* Login ou Avatar */}
        {currentUser ? (
             <div 
                onClick={() => alert("Perfil em breve!")} // Futuro: abrir menu de perfil
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
                {/* Se tiver foto no Google, mostra. Senão mostra ícone */}
                {currentUser.photoURL ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={currentUser.photoURL} alt="User" style={{width: 24, height: 24, borderRadius: "50%"}} />
                ) : (
                    <span>👤</span>
                )}
                {userName}
             </div>
        ) : (
            <button
            className={styles.primaryBtn}
            onClick={() => openModal("login")}
            >
            Entrar
            </button>
        )}
      </div>
    </header>
  );
}