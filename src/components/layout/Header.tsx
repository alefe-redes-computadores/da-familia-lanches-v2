"use client";

import styles from "./header.module.css";
import { useUIStore } from "@/store/ui";
import { useAuthStore } from "@/store/auth.store";
import { useCartStore } from "@/store/cart.store"; 

export function Header() {
  const openModal = useUIStore((s) => s.openModal);
  const currentUser = useAuthStore((s) => s.currentUser);
  const items = useCartStore((s) => s.items); 

  // Soma a quantidade total de itens (ex: 2 X-Tudo + 1 Coca = 3 na bolinha)
  const totalItens = Array.isArray(items) 
    ? items.reduce((acc, item) => acc + (item.quantity || 0), 0) 
    : 0;

  const userName = currentUser?.displayName?.split(" ")[0] || currentUser?.email?.split("@")[0];

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <span className={styles.logo}>Da Família Lanches</span>
      </div>

      <div className={styles.right}>
        {/* Carrinho com Bolinha Vermelha */}
        <button
          className={styles.iconBtn}
          aria-label="Abrir carrinho"
          onClick={() => (openModal as any)("cart")}
          style={{ position: "relative" }}
        >
          🛒
          {totalItens > 0 && (
            <span style={{
              position: "absolute",
              top: "-5px",
              right: "-5px",
              background: "#ff4d4f",
              color: "white",
              borderRadius: "50%",
              width: "18px",
              height: "18px",
              fontSize: "11px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "bold",
              boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
              border: "2px solid #fff",
              zIndex: 10
            }}>
              {totalItens}
            </span>
          )}
        </button>

        {/* Menu Hambúrguer (Conectado ao MobileDrawerMenu novo) */}
        <button
          className={styles.iconBtn}
          onClick={() => (openModal as any)("menu")}
          aria-label="Abrir menu"
          style={{ fontSize: "26px", background: "none", border: "none", cursor: "pointer" }}
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