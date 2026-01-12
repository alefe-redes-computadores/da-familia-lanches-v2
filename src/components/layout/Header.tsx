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
    <header className={styles.header} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "5px", padding: "10px 15px" }}>
      {/* LADO ESQUERDO: LOGO */}
      <div className={styles.left} style={{ flexShrink: 0 }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
            <span className={styles.logo} style={{ fontSize: "16px", whiteSpace: "nowrap", fontWeight: "900" }}>Da Família</span>
            <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "-2px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: shopStatus.isOpen ? "#4caf50" : "#d32f2f" }} />
                <span style={{ fontSize: "9px", fontWeight: "bold", color: "#666" }}>{shopStatus.isOpen ? "Aberto" : "Fechado"}</span>
            </div>
        </div>
      </div>

      {/* LADO DIREITO: PERFIL + CARRINHO + MENU */}
      <div className={styles.right} style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, justifyContent: "flex-end" }}>
        
        {currentUser && (
          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "6px" }} ref={menuRef}>
            <div 
              onClick={() => setShowMenu(!showMenu)}
              style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", minWidth: 0 }}
            >
              <div style={{ textAlign: "right", minWidth: 0 }}>
                <div style={{ 
                  fontSize: "12px", fontWeight: "800", color: "#333", 
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "65px" 
                }}>
                  {userName}
                </div>
                <div style={{ 
                  display: "inline-flex", alignItems: "center", gap: "2px", 
                  background: "#fff9c4", padding: "1px 6px", borderRadius: "10px", 
                  border: "1px solid #fbc02d", marginTop: "1px" 
                }}>
                  <span style={{ fontSize: "9px" }}>💎</span>
                  <span style={{ fontSize: "9px", fontWeight: "900", color: "#e65100" }}>{points}</span>
                </div>
              </div>
              <img 
                src={currentUser.photoURL || "https://cdn-icons-png.flaticon.com/512/149/149071.png"} 
                alt="User" 
                style={{ width: "32px", height: "32px", borderRadius: "50%", border: "1px solid #fff", flexShrink: 0, boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }} 
              />
            </div>

            {/* DROPDOWN */}
            {showMenu && (
              <div style={{ position: "absolute", top: "125%", right: 0, background: "#fff", borderRadius: "12px", boxShadow: "0 8px 20px rgba(0,0,0,0.15)", width: "160px", zIndex: 1000, border: "1px solid #eee", padding: "5px" }}>
                <button onClick={() => { (openModal as any)("rewards"); setShowMenu(false); }} style={{ width: "100%", textAlign: "left", padding: "10px", background: "none", border: "none", fontSize: "13px", fontWeight: "600", color: "#444", borderBottom: "1px solid #f5f5f5", cursor: "pointer" }}>💎 Recompensas</button>
                <button onClick={() => { (openModal as any)("orders"); setShowMenu(false); }} style={{ width: "100%", textAlign: "left", padding: "10px", background: "none", border: "none", fontSize: "13px", fontWeight: "600", color: "#444", borderBottom: "1px solid #f5f5f5", cursor: "pointer" }}>🛍️ Meus Pedidos</button>
                <button onClick={() => auth.signOut()} style={{ width: "100%", textAlign: "left", padding: "10px", background: "none", border: "none", fontSize: "13px", fontWeight: "600", color: "#d32f2f", cursor: "pointer" }}>🚪 Sair</button>
              </div>
            )}
          </div>
        )}

        {!currentUser && (
          <button className={styles.primaryBtn} onClick={() => (openModal as any)("login")} style={{ fontSize: "12px", padding: "6px 12px", height: "32px" }}>
            Entrar
          </button>
        )}

        {/* CARRINHO E MENU */}
        <div style={{ display: "flex", alignItems: "center", gap: "2px", flexShrink: 0 }}>
            <button className={styles.iconBtn} onClick={() => (openModal as any)("cart")} style={{ position: "relative", padding: "5px", background: "none", border: "none" }}>
              <span style={{ fontSize: "20px" }}>🛒</span>
              {totalItens > 0 && (
                <span style={{ position: "absolute", top: "0", right: "0", background: "#ff4d4f", color: "white", borderRadius: "50%", width: "16px", height: "16px", fontSize: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", border: "1px solid #fff" }}>
                  {totalItens}
                </span>
              )}
            </button>

            <button className={styles.iconBtn} onClick={() => (openModal as any)("menu")} style={{ fontSize: "22px", padding: "5px", background: "none", border: "none" }}>
              ☰
            </button>
        </div>
      </div>
    </header>
  );
}
