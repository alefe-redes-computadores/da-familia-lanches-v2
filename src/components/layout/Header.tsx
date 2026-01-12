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
    <header className={styles.header}>
      <div className={styles.left}>
        <div style={{ display: "flex", flexDirection: "column" }}>
            <span className={styles.logo}>Da Família Lanches</span>
            <div style={{ display: "flex", alignItems: "center", gap: "5px", marginTop: "-2px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: shopStatus.isOpen ? "#4caf50" : "#d32f2f" }} />
                <span style={{ fontSize: "10px", fontWeight: "bold", color: "#666" }}>{shopStatus.isOpen ? "Aberto Agora" : "Fechado"}</span>
            </div>
        </div>
      </div>

      <div className={styles.right}>
        {currentUser ? (
          <div style={{ position: "relative" }} ref={menuRef}>
            <div 
              onClick={() => setShowMenu(!showMenu)}
              style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}
            >
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "13px", fontWeight: "800", color: "#333" }}>{userName}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "3px", background: "#fff9c4", padding: "1px 8px", borderRadius: "12px", border: "1px solid #fbc02d", marginTop: "2px" }}>
                  <span style={{ fontSize: "10px" }}>💎</span>
                  <span style={{ fontSize: "10px", fontWeight: "900", color: "#e65100" }}>{points} pts</span>
                </div>
              </div>
              <img src={currentUser.photoURL || "https://cdn-icons-png.flaticon.com/512/149/149071.png"} alt="User" style={{ width: 38, height: 38, borderRadius: "50%", border: "2px solid #fff", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }} />
            </div>

            {/* --- DROPDOWN DESIGN --- */}
            {showMenu && (
              <div style={{ 
                position: "absolute", top: "110%", right: 0, background: "#fff", 
                borderRadius: "15px", boxShadow: "0 10px 25px rgba(0,0,0,0.15)", 
                width: "180px", zIndex: 1000, padding: "10px", border: "1px solid #eee" 
              }}>
                <button 
                  onClick={() => { (openModal as any)("orders"); setShowMenu(false); }}
                  style={{ width: "100%", textAlign: "left", padding: "12px", background: "none", border: "none", fontSize: "14px", fontWeight: "600", color: "#444", cursor: "pointer", borderBottom: "1px solid #f5f5f5" }}
                >
                  🛍️ Meus Pedidos
                </button>
                <button 
                  onClick={() => { (openModal as any)("rewards"); setShowMenu(false); }}
                  style={{ width: "100%", textAlign: "left", padding: "12px", background: "none", border: "none", fontSize: "14px", fontWeight: "600", color: "#444", cursor: "pointer", borderBottom: "1px solid #f5f5f5" }}
                >
                  💎 Recompensas
                </button>
                <button 
                  onClick={() => auth.signOut()}
                  style={{ width: "100%", textAlign: "left", padding: "12px", background: "none", border: "none", fontSize: "14px", fontWeight: "600", color: "#d32f2f", cursor: "pointer" }}
                >
                  🚪 Sair
                </button>
              </div>
            )}
          </div>
        ) : (
          <button className={styles.primaryBtn} onClick={() => (openModal as any)("login")}>Entrar</button>
        )}

        <button className={styles.iconBtn} onClick={() => (openModal as any)("cart")} style={{ position: "relative" }}>
          🛒
          {totalItens > 0 && (
            <span style={{ position: "absolute", top: "-5px", right: "-5px", background: "#ff4d4f", color: "white", borderRadius: "50%", width: "18px", height: "18px", fontSize: "11px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", border: "2px solid #fff" }}>
              {totalItens}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
