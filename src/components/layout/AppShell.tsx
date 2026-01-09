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

import { useUIStore } from "@/store/ui"; // Certifique-se que o caminho está correto (ex: @/store/ui.store se for o caso)
import { useAuthStore } from "@/store/auth.store";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";

type Props = {
  children: ReactNode;
};

export function AppShell({ children }: Props) {
  // CORREÇÃO AQUI: Usando activeModal conforme definido no seu ui.store.ts
  const { openMenu, openModal, activeModal } = useUIStore();
  const { currentUser, setCurrentUser } = useAuthStore();
  
  const [points, setPoints] = useState(0);
  const [shopStatus, setShopStatus] = useState({ isOpen: true, message: "" });
  const [imageError, setImageError] = useState(false);
  
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
    window.location.reload();
  };

  return (
    <div className={styles.shell}>
      
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
          {/* Mudei toggleMobileMenu para openMenu conforme seu ui.store.ts */}
          <HamburgerButton onClick={openMenu} ariaLabel="Abrir menu" />
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

                {isProfileMenuOpen && (
                    <div style={{
                        position: "absolute", top: "50px", right: "0", width: "200px",
                        background: "#fff", borderRadius: "12px", boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                        padding: "10px", zIndex: 100, border: "1px solid #eee"
                    }}>
                        
                        <div style={{ borderBottom: "1px solid #eee", paddingBottom: "10px", marginBottom: "5px", textAlign: "center" }}>
                             <div style={{ fontSize: "12px", color: "#666" }}>Você tem</div>
                             <div style={{ fontSize: "24px", fontWeight: "900", color: "#e65100" }}>{points}</div>
                             <div style={{ fontSize: "12px", fontWeight: "bold", color: "#e65100" }}>PONTOS</div>
                        </div>

                        <button 
                            onClick={() => { openModal("rewards"); setIsProfileMenuOpen(false); }}
                            style={{ 
                                width: "100%", padding: "10px", background: "transparent", border: "none", 
                                textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px",
                                fontSize: "14px", color: "#333", borderRadius: "8px"
                            }}
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

      {/* CORREÇÃO AQUI: Verificando apenas activeModal */}
      {activeModal === "cart" && <CartModal />}
      {activeModal === "orders" && <OrdersModal />} 
      {activeModal === "login" && <LoginModal />}
      {activeModal === "rewards" && <RewardsModal />}
      
      {/* Caso use outros modais que não estão na store básica: */}
      {(activeModal as string) === "checkout" && <CheckoutModal />}
      {(activeModal as string) === "product-details" && <ProductDetailsModal />}
    </div>
  );
}