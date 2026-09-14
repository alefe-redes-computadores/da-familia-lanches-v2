"use client";

import { type ReactNode, useEffect } from "react";
import { usePathname } from "next/navigation";
import styles from "./AppShell.module.css";
import { Header } from "@/components/layout/Header";
import { MobileDrawerMenu } from "@/components/layout/MobileDrawerMenu";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { Footer } from "@/components/layout/Footer";
import { PrivacyBanner } from "@/components/ui/PrivacyBanner";
import { CartModal } from "@/components/ui/CartModal";
import { ProductDetailsModal } from "@/components/ui/ProductDetailsModal";
import { OrdersModal } from "@/components/ui/OrdersModal";
import { CheckoutModal } from "@/components/ui/CheckoutModal";
import { OrderSuccessModal } from "@/components/ui/OrderSuccessModal";
import { LoginModal } from "@/components/auth/LoginModal";
import { LoginIntentModal } from "@/components/auth/LoginIntentModal";
import { RewardsModal } from "@/components/ui/RewardsModal";
import { PixModal } from "@/components/ui/PixModal";
import { TermsModal } from "@/components/ui/TermsModal";
import { useUIStore } from "@/store/ui";
import { useAuthStore } from "@/store/auth.store";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

type Props = { children: ReactNode };

export function AppShell({ children }: Props) {
  const pathname = usePathname();
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const activeModal = useUIStore((state) => state.activeModal);
  const closeModal = useUIStore((state) => state.closeModal);
  const setCurrentUser = useAuthStore((state) => state.setCurrentUser);
  const setLoading = useAuthStore((state) => state.setLoading);

  useEffect(() => onAuthStateChanged(auth, (user) => {
    setCurrentUser(user);
    setLoading(false);
  }), [setCurrentUser, setLoading]);

  useEffect(() => {
    if (isAdmin && activeModal) closeModal();
  }, [isAdmin, activeModal, closeModal]);

  useEffect(() => {
    const shouldLock = Boolean(!isAdmin && activeModal && activeModal !== "menu");
    if (!shouldLock) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [activeModal, isAdmin]);

  if (isAdmin) {
    return <div className={styles.shell}><main className={styles.main}>{children}</main></div>;
  }

  const modal = (() => {
    switch (activeModal) {
      case "cart": return <CartModal />;
      case "orders": return <OrdersModal />;
      case "login": return <LoginModal />;
      case "login-prompt": return <LoginIntentModal />;
      case "rewards": return <RewardsModal />;
      case "checkout": return <CheckoutModal />;
      case "order-success": return <OrderSuccessModal />;
      case "product-details": return <ProductDetailsModal />;
      case "pix": return <PixModal />;
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
    </div>
  );
}
