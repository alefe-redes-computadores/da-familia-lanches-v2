"use client";

import { useEffect, useState, useRef } from "react"; // Adicionado useRef
import styles from "./header.module.css";
import { useUIStore } from "@/store/ui";
import { useAuthStore } from "@/store/auth.store";
import { useCartStore } from "@/store/cart.store"; 
import { getShopStatus } from "@/lib/openingHours";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { auth } from "@/lib/firebase"; // Para o logout

export function Header() {
  const openModal = useUIStore((s) => s.openModal);
  const currentUser = useAuthStore((s) => s.currentUser);
  const items = useCartStore((s) => s.items); 
  
  const [shopStatus, setShopStatus] = useState({ isOpen: true, message: "" });
  const [points, setPoints] = useState(0);
  const [showMenu, setShowMenu] = useState(false); // Controla o Dropdown
  const menuRef = useRef<HTMLDivElement>(null);

  // Fecha o menu se clicar fora dele
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setShopStatus(getShopStatus());
    const interval = setInterval(() => setShopStatus(getShopStatus()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!currentUser) { setPoints(0); return; }
    const unsub = onSnapshot(doc(db, "Usuarios", currentUser.uid), (doc) => {
      if (doc.exists()) setPoints(doc.data().pedidosFeitos || 0);
    });
    return () => unsub();
  }, [currentUser]);

  const totalItens = Array.isArray(items) ? items.reduce((acc, item) => acc + (item.quantity || 0), 0) : 0;
  const userName = currentUser?.displayName?.split(" ")[0] || currentUser?.email?.split("@")[0];

   return (
    <header className={styles.header} style={{ 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "space-between", 
      gap: "2px", 
      padding: "8px 12px",
      minHeight: "60px" 
    }}>
      {/* LADO ESQUERDO: LOGO OTIMIZADA */}
      <div className={styles.left} style={{ flex: "1 1 auto", minWidth: 0 }}>
        <div style={{ display: "flex", flexDirection: "column", lineHeight: "1.2" }}>
            <span className={styles.logo} style={{ 
              fontSize: "15px", 
              whiteSpace: "nowrap", 
              fontWeight: "900",
              letterSpacing: "-0.5px" 
            }}>
              Da Família Lanches
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ 
                  width: "6px", 
                  height: "6px", 
                  borderRadius: "50%", 
                  background: shopStatus.isOpen ? "#4caf50" : "#d32f2f",
                  flexShrink: 0 
                }} />
                <span style={{ fontSize: "9px", fontWeight: "bold", color: "#666" }}>
                  {shopStatus.isOpen ? "Aberto" : "Fechado"}
                </span>
            </div>
        </div>
      </div>

      {/* CENTRO/DIREITA: PERFIL E PONTOS */}
      <div className={styles.right} style={{ 
        display: "flex", 
        alignItems: "center", 
        gap: "6px", 
        flexShrink: 0 
      }}>
        
        {currentUser && (
          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "4px" }} ref={menuRef}>
            <div 
              onClick={() => setShowMenu(!showMenu)}
              style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" }}
            >
              <div style={{ textAlign: "right" }}>
                <div style={{ 
                  fontSize: "11px", 
                  fontWeight: "800", 
                  color: "#333", 
                  whiteSpace: "nowrap", 
                  overflow: "hidden", 
                  textOverflow: "ellipsis", 
                  maxWidth: "55px" 
                }}>
                  {userName}
                </div>
                <div style={{ 
                  display: "inline-flex", 
                  alignItems: "center", 
                  gap: "2px", 
                  background: "#fff9c4", 
                  padding: "1px 5px", 
                  borderRadius: "8px", 
                  border: "1px solid #fbc02d" 
                }}>
                  <span style={{ fontSize: "8px" }}>💎</span>
                  <span style={{ fontSize: "9px", fontWeight: "900", color: "#e65100" }}>{points}</span>
                </div>
              </div>
              <img 
                src={currentUser.photoURL || "https://cdn-icons-png.flaticon.com/512/149/149071.png"} 
                alt="User" 
                style={{ width: "30px", height: "30px", borderRadius: "50%", border: "1px solid #fff", flexShrink: 0 }} 
              />
            </div>

            {/* DROPDOWN */}
            {showMenu && (
              <div style={{ position: "absolute", top: "120%", right: 0, background: "#fff", borderRadius: "12px", boxShadow: "0 8px 20px rgba(0,0,0,0.15)", width: "155px", zIndex: 1000, border: "1px solid #eee", padding: "4px" }}>
                <button onClick={() => { (openModal as any)("rewards"); setShowMenu(false); }} style={{ width: "100%", textAlign: "left", padding: "10px", background: "none", border: "none", fontSize: "12px", fontWeight: "600", borderBottom: "1px solid #f5f5f5" }}>💎 Recompensas</button>
                <button onClick={() => { (openModal as any)("orders"); setShowMenu(false); }} style={{ width: "100%", textAlign: "left", padding: "10px", background: "none", border: "none", fontSize: "12px", fontWeight: "600", borderBottom: "1px solid #f5f5f5" }}>🛍️ Meus Pedidos</button>
                <button onClick={() => auth.signOut()} style={{ width: "100%", textAlign: "left", padding: "10px", background: "none", border: "none", fontSize: "12px", fontWeight: "600", color: "#d32f2f" }}>🚪 Sair</button>
              </div>
            )}
          </div>
        )}

        {/* CARRINHO E MENU (COMPACTOS) */}
        <div style={{ display: "flex", alignItems: "center", gap: "0px" }}>
            <button className={styles.iconBtn} onClick={() => (openModal as any)("cart")} style={{ position: "relative", padding: "4px" }}>
              <span style={{ fontSize: "18px" }}>🛒</span>
              {totalItens > 0 && (
                <span style={{ position: "absolute", top: "0", right: "0", background: "#ff4d4f", color: "white", borderRadius: "50%", width: "14px", height: "14px", fontSize: "9px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>
                  {totalItens}
                </span>
              )}
            </button>
            <button className={styles.iconBtn} onClick={() => (openModal as any)("menu")} style={{ fontSize: "20px", padding: "4px" }}>
              ☰
            </button>
        </div>
      </div>
    </header>
  );
}
