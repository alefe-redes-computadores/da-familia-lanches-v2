"use client";

import { type ReactNode, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import styles from "./AppShell.module.css";
import { Header } from "@/components/layout/Header";
import { DFLAssist } from "@/components/layout/DFLAssist";
import { MobileDrawerMenu } from "@/components/layout/MobileDrawerMenu";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { Footer } from "@/components/layout/Footer";
import { PrivacyBanner } from "@/components/ui/PrivacyBanner";





import { LoginModal } from "@/components/auth/LoginModal";
import { LoginIntentModal } from "@/components/auth/LoginIntentModal";


import { TermsModal } from "@/components/ui/TermsModal";
import { CartToast } from "@/components/ui/CartToast";
import { useUIStore } from "@/store/ui";
import { useAuthStore } from "@/store/auth.store";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

// Carregados somente ao abrir a respectiva tela.
const CartModal = dynamic(() => import("@/components/ui/CartModal").then(m => m.CartModal));
const ProductDetailsModal = dynamic(() => import("@/components/ui/ProductDetailsModal").then(m => m.ProductDetailsModal));
const OrdersModal = dynamic(() => import("@/components/ui/OrdersModal").then(m => m.OrdersModal));
const CheckoutModal = dynamic(() => import("@/components/ui/CheckoutModal").then(m => m.CheckoutModal));
const OrderSuccessModal = dynamic(() => import("@/components/ui/OrderSuccessModal").then(m => m.OrderSuccessModal));
const RewardsModal = dynamic(() => import("@/components/ui/RewardsModal").then(m => m.RewardsModal));
const AccountModal = dynamic(() => import("@/components/ui/AccountModal").then(m => m.AccountModal));

type Props = { children: ReactNode };

export function AppShell({ children }: Props) {
  const pathname = usePathname();
  const [adminHost, setAdminHost] =
    useState(false);

  const routeIsAdmin =
    pathname === "/admin" ||
    pathname.startsWith("/admin/");

  const isAdmin =
    routeIsAdmin ||
    adminHost;

  const activeModal =
    useUIStore(
      (state) => state.activeModal
    );
  const closeModal = useUIStore((state) => state.closeModal);
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser);
  const setLoading = useAuthStore((state) => state.setLoading);

  useEffect(() => {
    setAdminHost(
      window.location.hostname ===
        "admin.dafamilialanches.com.br"
    );
  }, []);

  useEffect(() => onAuthStateChanged(auth, (user) => {
    setCurrentUser(user);
    setLoading(false);
  }), [setCurrentUser, setLoading]);

  useEffect(() => {
    if (isAdmin && activeModal) closeModal();
  }, [isAdmin, activeModal, closeModal]);

  useEffect(() => {
    const shouldLock = Boolean(!isAdmin && activeModal);
    if (!shouldLock) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [activeModal, isAdmin]);

  if (isAdmin) {
    return <div className={`${styles.shell} ${styles.adminShell}`}><main className={`${styles.main} ${styles.adminMain}`}>{children}</main></div>;
  }

  const modal = (() => {
    switch (activeModal) {
      case "cart": return <CartModal />;
      case "orders": return <OrdersModal />;
      case "login": return <LoginModal />;
      case "login-prompt": return <LoginIntentModal />;
      case "rewards": return <RewardsModal />;
      case "account": return <AccountModal />;
      case "checkout": return <CheckoutModal />;
      case "order-success": return <OrderSuccessModal />;
      case "product-details": return <ProductDetailsModal />;
      case "terms": return <TermsModal />;
      default: return null;
    }
  })();

  return (
    <div className={styles.shell}>
      <Header />
      <MobileDrawerMenu />
      <main className={styles.main}>{children}</main>
      <Footer />
      <MobileBottomNav />
      <PrivacyBanner />
      {modal}
      <CartToast />
      <DFLAssist />
    </div>
  );
}
