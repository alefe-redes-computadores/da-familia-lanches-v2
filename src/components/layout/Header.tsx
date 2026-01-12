"use client";

import { useEffect, useState } from "react";
import styles from "./header.module.css";
import { useUIStore } from "@/store/ui";
import { useAuthStore } from "@/store/auth.store";
import { useCartStore } from "@/store/cart.store"; 
import { getShopStatus } from "@/lib/openingHours"; // Importante para checar o horário

export function Header() {
  const openModal = useUIStore((s) => s.openModal);
  const currentUser = useAuthStore((s) => s.currentUser);
  const items = useCartStore((s) => s.items); 
  
  // Estado para controlar se a loja está aberta
  const [shopStatus, setShopStatus] = useState({ isOpen: true, message: "" });

  // Atualiza o status da loja ao carregar e a cada minuto
  useEffect(() => {
    setShopStatus(getShopStatus());
    const interval = setInterval(() => setShopStatus(getShopStatus()), 60000);
    return () => clearInterval(interval);
  }, []);

  const totalItens = Array.isArray(items) 
    ? items.reduce((acc, item) => acc + (item.quantity || 0), 0) 
    : 0;

  const userName = currentUser?.displayName?.split(" ")[0] || currentUser?.email?.split("@")[0];

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <div style={{ display: "flex", flexDirection: "column" }}>
            <span className={styles.logo}>Da Família Lanches</span>
            {/* --- BOLINHA DE STATUS --- */}
            <div style={{ display: "flex", alignItems: "center", gap: "5px", marginTop: "-2px" }}>
                <span style={{ 
                    width: "8px", 
                    height: "8px", 
                    borderRadius: "50%", 
                    background: shopStatus.isOpen ? "#4caf50" : "#d32f2f" 
                }} />
                <span style={{ fontSize: "10px", fontWeight: "bold", color: "#666" }}>
                    {shopStatus.isOpen ? "Aberto Agora" : "Fechado"}
                </span>
            </div>
        </div>
      </div>

      <div className={styles.right}>
        {/* Carrinho com Badge */}
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

        {/* Menu Hambúrguer */}
        <button
          className={styles.iconBtn}
          onClick={() => (openModal as any)("menu")}
          aria-label="Abrir menu"
          style={{ fontSize: "26px", background: "none", border: "none", cursor: "pointer" }}
        >
          ☰
        </button>

        {/* Perfil */}
        {currentUser ? (
          <div 
            onClick={() => (openModal as any)("profile")}
            style={{ 
              background: "#f0f0f0", 
              padding: "8px 12px", 
              borderRadius: "20px", 
              fontWeight: "bold", 
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            {currentUser.photoURL ? (
              <img src={currentUser.photoURL} alt="User" style={{width: 22, height: 22, borderRadius: "50%"}} />
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
