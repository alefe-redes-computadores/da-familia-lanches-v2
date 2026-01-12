"use client";

import { useEffect, useState, useRef } from "react";
import styles from "./header.module.css";
import { useUIStore } from "@/store/ui";
import { useAuthStore } from "@/store/auth.store";
import { useCartStore } from "@/store/cart.store"; 
import { getShopStatus } from "@/lib/openingHours";
import { db, auth } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

export function Header() {
  const openModal = useUIStore((s) => s.openModal);
  const currentUser = useAuthStore((s) => s.currentUser);
  const items = useCartStore((s) => s.items); 
  
  const [shopStatus, setShopStatus] = useState({ isOpen: true, message: "" });
  const [points, setPoints] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fecha o menu ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Status da Loja
  useEffect(() => {
    setShopStatus(getShopStatus());
    const interval = setInterval(() => setShopStatus(getShopStatus()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Busca Pontos em Tempo Real
  useEffect(() => {
    if (!currentUser) { setPoints(0); return; }
    const unsub = onSnapshot(doc(db, "Usuarios", currentUser.uid), (doc) => {
      if (doc.exists()) setPoints(doc.data().pedidosFeitos || 0);
    });
    return () => unsub();
  }, [currentUser]);

  const totalItens = Array.isArray(items) ? items.reduce((acc, item) => acc + (item.quantity || 0), 0) : 0;
  const userName = currentUser?.displayName?.split(" ")[0] || currentUser?.email?.split("@")[0] || "Usuário";

  return (
    <header className={styles.header} style={{ 
      display: "flex", alignItems: "center", justifyContent: "space-between", 
      padding: "10px 15px", minHeight: "65px", gap: "5px",
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000, background: "#fff",
      boxShadow: "0 2px 10px rgba(0,0,0,0.05)"
    }}>
      {/* ESQUERDA: LOGO E STATUS (O DESIGN QUE VOCÊ APROVOU) */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", flexShrink: 0 }}>
        <span style={{ fontSize: "16px", fontWeight: "900", lineHeight: "1.1", whiteSpace: "nowrap" }}>
          Da Família<br/>Lanches
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "3px" }}>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: shopStatus.isOpen ? "#4caf50" : "#d32f2f" }} />
            <span style={{ fontSize: "10px", fontWeight: "bold", color: "#666" }}>
              {shopStatus.isOpen ? "Aberto Agora" : "Fechado"}
            </span>
        </div>
      </div>

      {/* DIREITA: PERFIL, PONTOS E BOTÕES */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", justifyContent: "flex-end", flex: 1 }}>
        
        {currentUser && (
          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "6px" }} ref={menuRef}>
            <div onClick={() => setShowMenu(!showMenu)} style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "12px", fontWeight: "800", color: "#333", maxWidth: "55px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {userName}
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: "2px", background: "#fff9c4", padding: "1px 6px", borderRadius: "10px", border: "1px solid #fbc02d" }}>
                  <span style={{ fontSize: "9px" }}>💎</span>
                  <span style={{ fontSize: "9px", fontWeight: "900", color: "#e65100" }}>{points}</span>
                </div>
              </div>
              <img src={currentUser.photoURL || "https://cdn-icons-png.flaticon.com/512/149/149071.png"} alt="User" style={{ width: "34px", height: "34px", borderRadius: "50%", border: "2px solid #fff", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }} />
            </div>

            {/* MENU SUSPENSO (ABRE AO CLICAR NA FOTO) */}
            {showMenu && (
              <div style={{ position: "absolute", top: "120%", right: 0, background: "#fff", borderRadius: "12px", boxShadow: "0 8px 20px rgba(0,0,0,0.15)", width: "165px", zIndex: 1000, border: "1px solid #eee" }}>
                <button onClick={() => { (openModal as any)("rewards"); setShowMenu(false); }} style={{ width: "100%", textAlign: "left", padding: "12px", background: "none", border: "none", fontSize: "13px", fontWeight: "600", borderBottom: "1px solid #f5f5f5", cursor: "pointer" }}>💎 Recompensas</button>
                <button onClick={() => { (openModal as any)("orders"); setShowMenu(false); }} style={{ width: "100%", textAlign: "left", padding: "12px", background: "none", border: "none", fontSize: "13px", fontWeight: "600", borderBottom: "1px solid #f5f5f5", cursor: "pointer" }}>🛍️ Meus Pedidos</button>
                <button onClick={() => auth.signOut()} style={{ width: "100%", textAlign: "left", padding: "12px", background: "none", border: "none", fontSize: "13px", fontWeight: "600", color: "#d32f2f", cursor: "pointer" }}>🚪 Sair da Conta</button>
              </div>
            )}
          </div>
        )}

        {!currentUser && (
          <button onClick={() => (openModal as any)("login")} style={{ background: "#111", color: "#fff", border: "none", padding: "8px 15px", borderRadius: "10px", fontWeight: "bold", fontSize: "12px", cursor: "pointer" }}>Entrar</button>
        )}

        {/* ÍCONES DO CARRINHO E MENU GERAL */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button onClick={() => (openModal as any)("cart")} style={{ position: "relative", padding: "4px", background: "none", border: "none", cursor: "pointer" }}>
              <span style={{ fontSize: "22px" }}>🛒</span>
              {totalItens > 0 && (
                <span style={{ position: "absolute", top: "-2px", right: "-2px", background: "#ff4d4f", color: "white", borderRadius: "50%", width: "16px", height: "16px", fontSize: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", border: "1px solid #fff" }}>
                  {totalItens}
                </span>
              )}
            </button>
            <button onClick={() => (openModal as any)("menu")} style={{ fontSize: "24px", padding: "4px", background: "none", border: "none", cursor: "pointer" }}>
              ☰
            </button>
        </div>
      </div>
    </header>
  );
}
