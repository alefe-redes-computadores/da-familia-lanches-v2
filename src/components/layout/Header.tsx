"use client";

import { useEffect, useState } from "react";
import styles from "./header.module.css";
import { useUIStore } from "@/store/ui";
import { useAuthStore } from "@/store/auth.store";
import { useCartStore } from "@/store/cart.store"; 
import { getShopStatus } from "@/lib/openingHours";
import { db } from "@/lib/firebase"; // Importante para os pontos
import { doc, onSnapshot } from "firebase/firestore"; // Listener em tempo real

export function Header() {
  const openModal = useUIStore((s) => s.openModal);
  const currentUser = useAuthStore((s) => s.currentUser);
  const items = useCartStore((s) => s.items); 
  
  const [shopStatus, setShopStatus] = useState({ isOpen: true, message: "" });
  const [points, setPoints] = useState(0);

  // 1. Monitorar Status da Loja
  useEffect(() => {
    setShopStatus(getShopStatus());
    const interval = setInterval(() => setShopStatus(getShopStatus()), 60000);
    return () => clearInterval(interval);
  }, []);

  // 2. Monitorar Pontos do Usuário em Tempo Real
  useEffect(() => {
    if (!currentUser) {
      setPoints(0);
      return;
    }
    // Usamos onSnapshot para que, se ele ganhar ponto, o diamante atualize na hora
    const unsub = onSnapshot(doc(db, "Usuarios", currentUser.uid), (doc) => {
      if (doc.exists()) {
        setPoints(doc.data().pedidosFeitos || 0);
      }
    });
    return () => unsub();
  }, [currentUser]);

  const totalItens = Array.isArray(items) 
    ? items.reduce((acc, item) => acc + (item.quantity || 0), 0) 
    : 0;

  const userName = currentUser?.displayName?.split(" ")[0] || currentUser?.email?.split("@")[0];

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <div style={{ display: "flex", flexDirection: "column" }}>
            <span className={styles.logo}>Da Família Lanches</span>
            <div style={{ display: "flex", alignItems: "center", gap: "5px", marginTop: "-2px" }}>
                <span style={{ 
                    width: "8px", height: "8px", borderRadius: "50%", 
                    background: shopStatus.isOpen ? "#4caf50" : "#d32f2f" 
                }} />
                <span style={{ fontSize: "10px", fontWeight: "bold", color: "#666" }}>
                    {shopStatus.isOpen ? "Aberto Agora" : "Fechado"}
                </span>
            </div>
        </div>
      </div>

      <div className={styles.right}>
        {/* Perfil e Pontos (Badge de Diamante) */}
        {currentUser ? (
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginRight: "5px" }}>
            <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <span style={{ fontSize: "13px", fontWeight: "800", color: "#333", lineHeight: "1.1" }}>{userName}</span>
              {/* Badge Amarelo com Diamante */}
              <div 
                onClick={() => (openModal as any)("rewards")}
                style={{ 
                  display: "flex", alignItems: "center", gap: "3px", 
                  background: "#fff9c4", padding: "1px 8px", borderRadius: "12px",
                  border: "1px solid #fbc02d", cursor: "pointer", marginTop: "3px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
                }}
              >
                <span style={{ fontSize: "10px" }}>💎</span>
                <span style={{ fontSize: "10px", fontWeight: "900", color: "#e65100" }}>{points} pts</span>
              </div>
            </div>

            <img 
              src={currentUser.photoURL || "https://cdn-icons-png.flaticon.com/512/149/149071.png"} 
              alt="User" 
              style={{ width: 34, height: 34, borderRadius: "50%", border: "2px solid #fff", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", cursor: "pointer" }}
              onClick={() => (openModal as any)("menu")} 
            />
          </div>
        ) : (
          <button className={styles.primaryBtn} onClick={() => (openModal as any)("login")}>
            Entrar
          </button>
        )}

        {/* Carrinho */}
        <button
          className={styles.iconBtn}
          onClick={() => (openModal as any)("cart")}
          style={{ position: "relative", marginLeft: "5px" }}
        >
          🛒
          {totalItens > 0 && (
            <span style={{
              position: "absolute", top: "-5px", right: "-5px", background: "#ff4d4f",
              color: "white", borderRadius: "50%", width: "18px", height: "18px",
              fontSize: "11px", display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: "bold", boxShadow: "0 2px 4px rgba(0,0,0,0.2)", border: "2px solid #fff"
            }}>
              {totalItens}
            </span>
          )}
        </button>

        {/* Menu Hambúrguer */}
        <button
          className={styles.iconBtn}
          onClick={() => (openModal as any)("menu")}
          style={{ fontSize: "24px", background: "none", border: "none", cursor: "pointer" }}
        >
          ☰
        </button>
      </div>
    </header>
  );
}
