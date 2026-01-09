"use client";

import styles from "./AppShell.module.css";
import { ReactNode, useEffect, useState, useRef } from "react";
import { HamburgerButton } from "@/components/ui/HamburgerButton";
import { MobileDrawerMenu } from "./MobileDrawerMenu";
import { Footer } from "./Footer";
import { PrivacyBanner } from "@/components/ui/PrivacyBanner";
import { getShopStatus } from "@/lib/openingHours";

// IMPORTS DOS MODAIS
import { CartModal } from "@/components/ui/CartModal";
import { ProductDetailsModal } from "@/components/ui/ProductDetailsModal";
import { OrdersModal } from "@/components/ui/OrdersModal";
import { CheckoutModal } from "@/components/ui/CheckoutModal";
import { LoginModal } from "@/components/auth/LoginModal"; 
import { RewardsModal } from "@/components/ui/RewardsModal";

import { useUIStore } from "@/store/ui";
import { useAuthStore } from "@/store/auth.store";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth"; // <--- Importei signOut
import { doc, onSnapshot } from "firebase/firestore";

type Props = {
  children: ReactNode;
};

export function AppShell({ children }: Props) {
  const { toggleMobileMenu, openModal, isModalOpen, modalType } = useUIStore();
  const { currentUser, setCurrentUser } = useAuthStore();
  
  const [points, setPoints] = useState(0);
  const [shopStatus, setShopStatus] = useState({ isOpen: true, message: "" });
  const [imageError, setImageError] = useState(false);
  
  // ESTADO DO MENU DO PERFIL
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Verifica horário
  useEffect(() => {
    setShopStatus(getShopStatus());
    const interval = setInterval(() => setShopStatus(getShopStatus()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setImageError(false);
    });
    return () => unsubscribe();
  }, [setCurrentUser]);

  useEffect(() => {
    if (!currentUser) { setPoints(0); return; }
    const userRef = doc(db, "Usuarios", currentUser.uid);
    const unsubscribePoints = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) setPoints(docSnap.data().pedidosFeitos || 0);
    });
    return () => unsubscribePoints();
  }, [currentUser]);

  // Fecha o menu se clicar fora
  useEffect(() => {
    function handleClickOutside(event: any) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getInitials = (name: string) => {
    return name ? name.charAt(0).toUpperCase() : "?";
  };

  const handleLogout = async () => {
    await signOut(auth);
    setIsProfileMenuOpen(false);
    window.location.reload(); // Recarrega para limpar estados
  };

  return (
    <div className={styles.shell}>
      
      {/* FAIXA DE AVISO */}
      {!shopStatus.isOpen && (
        <div style={{ 
            background: "#fff9c4", color: "#856404", textAlign: "center", 
            padding: "8px", fontSize: "12px", fontWeight: "bold",
            borderBottom: "1px solid #ffeeba"
        }}>
            🛑 Loja Fechada Agora. Seu pedido será agendado! ({shopStatus.message})
        </div>
      )}

      <header className={styles.header}>
        <div className={styles.left}>
          <HamburgerButton onClick={toggleMobileMenu} ariaLabel="Abrir menu" />
          <div className={styles.brand}>
            <div className={styles.title}>Da Família Lanches</div>
            <div className={styles.sub}>
                <span style={{ 
                    display: "inline-block", width: "8px", height: "8px", 
                    borderRadius: "50%", background: shopStatus.isOpen ? "#4caf50" : "#d32f2f", 
                    marginRight: "5px" 
                }} />
                {shopStatus.isOpen ? "Aberto Agora" : "Fechado"}
            </div>
          </div>
        </div>

        <div className={styles.right}>
          {currentUser ? (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", position: "relative" }} ref={menuRef}>
                
                {/* INFO (Nome e Pontos) */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                    <span style={{ fontSize: "12px", fontWeight: "bold", color: "#111" }}>
                      {currentUser.displayName?.split(' ')[0]}
                    </span>
                    <span 
                      style={{ 
                        fontSize: "10px", color: "#e65100", background: "#fff3e0", 
                        padding: "2px 6px", borderRadius: "10px", fontWeight: "700",
                         border: "1px solid #ffe0b2"
                      }}
                    >
                       💎 {points} pts
                    </span>
                </div>

                {/* FOTO DO PERFIL (CLICÁVEL) */}
                <div 
                    onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                    style={{ cursor: "pointer", position: "relative" }}
                >
                    {currentUser.photoURL && !imageError ? (
                        <img 
                            src={currentUser.photoURL} 
                            alt="Perfil"
                            referrerPolicy="no-referrer"
                            onError={() => setImageError(true)}
                            style={{ 
                                width: "38px", height: "38px", borderRadius: "50%", 
                                objectFit: "cover", border: "2px solid #fff",
                                boxShadow: "0 2px 5px rgba(0,0,0,0.1)"
                            }}
                        />
                    ) : (
                        <div style={{ 
                                width: "38px", height: "38px", borderRadius: "50%", 
                                background: "#111", color: "#fff", display: "flex", 
                                alignItems: "center", justifyContent: "center", fontWeight: "bold",
                                border: "2px solid #fff", boxShadow: "0 2px 5px rgba(0,0,0,0.1)", fontSize: "14px"
                            }}>
                            {getInitials(currentUser.displayName || "")}
                        </div>
                    )}
                </div>

                {/* --- MENU SUSPENSO DO PERFIL --- */}
                {isProfileMenuOpen && (
                    <div style={{
                        position: "absolute", top: "50px", right: "0", width: "200px",
                        background: "#fff", borderRadius: "12px", boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                        padding: "10px", zIndex: 100, border: "1px solid #eee",
                        animation: "fadeIn 0.2s ease"
                    }}>
                        
                        {/* Cabeçalho do Menu */}
                        <div style={{ borderBottom: "1px solid #eee", paddingBottom: "10px", marginBottom: "5px", textAlign: "center" }}>
                             <div style={{ fontSize: "12px", color: "#666" }}>Você tem</div>
                             <div style={{ fontSize: "24px", fontWeight: "900", color: "#e65100" }}>{points}</div>
                             <div style={{ fontSize: "12px", fontWeight: "bold", color: "#e65100" }}>PONTOS</div>
                        </div>

                        {/* Opções */}
                        <button 
                            onClick={() => { openModal("rewards"); setIsProfileMenuOpen(false); }}
                            style={{ 
                                width: "100%", padding: "10px", background: "transparent", border: "none", 
                                textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px",
                                fontSize: "14px", color: "#333", borderRadius: "8px"
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = "#f5f5f5"}
                            onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
                        >
                            💎 Prêmios e Pontos
                        </button>

                        <button 
                            onClick={() => { openModal("orders"); setIsProfileMenuOpen(false); }}
                            style={{ 
                                width: "100%", padding: "10px", background: "transparent", border: "none", 
                                textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px",
                                fontSize: "14px", color: "#333", borderRadius: "8px"
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = "#f5f5f5"}
                            onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
                        >
                            🛍️ Meus Pedidos
                        </button>

                        <div style={{ borderTop: "1px solid #eee", margin: "5px 0" }}></div>

                        <button 
                            onClick={handleLogout}
                            style={{ 
                                width: "100%", padding: "10px", background: "transparent", border: "none", 
                                textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px",
                                fontSize: "14px", color: "#d32f2f", borderRadius: "8px", fontWeight: "bold"
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = "#ffebee"}
                            onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
                        >
                            🚪 Sair da Conta
                        </button>
                    </div>
                )}

            </div>
          ) : (
            <button className={styles.primaryBtn} type="button" onClick={() => openModal("login")}>
                Entrar
            </button>
          )}

          <button className={styles.iconBtn} type="button" onClick={() => openModal("cart")}>
            🛒
          </button>
        </div>
      </header>

      <MobileDrawerMenu />
      <main className={styles.main}>{children}</main>
      <Footer />
      <PrivacyBanner />

      {isModalOpen && modalType === "cart" && <CartModal />}
      {isModalOpen && modalType === "checkout" && <CheckoutModal />}
      {isModalOpen && modalType === "orders" && <OrdersModal />} 
      {isModalOpen && modalType === "product-details" && <ProductDetailsModal />}
      {isModalOpen && modalType === "login" && <LoginModal />}
      {isModalOpen && modalType === "rewards" && <RewardsModal />}
    </div>
  );
}