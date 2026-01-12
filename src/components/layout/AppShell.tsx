"use client";

import styles from "./AppShell.module.css";
import { ReactNode, useEffect, useState } from "react";
import { MobileDrawerMenu } from "./MobileDrawerMenu";
import { Footer } from "./Footer";
import { PrivacyBanner } from "@/components/ui/PrivacyBanner";
import { getShopStatus } from "@/lib/openingHours";

// IMPORTA O HEADER NOVO QUE CRIAMOS
import { Header } from "@/components//layout/Header"; 

// IMPORTS DOS MODAIS
import { CartModal } from "@/components/ui/CartModal";
import { ProductDetailsModal } from "@/components/ui/ProductDetailsModal";
import { OrdersModal } from "@/components/ui/OrdersModal";
import { CheckoutModal } from "@/components/ui/CheckoutModal";
import { LoginModal } from "@/components/auth/LoginModal"; 
import { RewardsModal } from "@/components/ui/RewardsModal";

import { useUIStore } from "@/store/ui"; 
import { useAuthStore } from "@/store/auth.store";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

type Props = {
  children: ReactNode;
};

export function AppShell({ children }: Props) {
  const ui = useUIStore();
  const { setCurrentUser } = useAuthStore();
  const [shopStatus, setShopStatus] = useState({ isOpen: true, message: "" });

  useEffect(() => {
    setShopStatus(getShopStatus());
    const interval = setInterval(() => setShopStatus(getShopStatus()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, [setCurrentUser]);

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

      {/* --- O HEADER NOVO ENTRA AQUI, SUBSTITUINDO O ANTIGO --- */}
      <Header />

      <MobileDrawerMenu />
      <main className={styles.main}>{children}</main>
      <Footer />
      <PrivacyBanner />

      {/* Gerenciamento de Modais */}
      {(ui as any).activeModal === "cart" && <CartModal />}
      {(ui as any).activeModal === "orders" && <OrdersModal />} 
      {(ui as any).activeModal === "login" && <LoginModal />}
      {(ui as any).activeModal === "rewards" && <RewardsModal />}
      {(ui as any).activeModal === "checkout" && <CheckoutModal />}
      {(ui as any).activeModal === "product-details" && <ProductDetailsModal />}
    </div>
  );
}
