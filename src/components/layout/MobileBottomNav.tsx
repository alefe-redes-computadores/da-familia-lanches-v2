"use client";

import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { useCartStore } from "@/store/cart.store";
import { useUIStore } from "@/store/ui";
import { House, ClipboardList, Gift, ShoppingCart } from "lucide-react";
import styles from "./MobileBottomNav.module.css";

export function MobileBottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const openModal = useUIStore((state) => state.openModal);
  const currentUser = useAuthStore((state) => state.currentUser);
  const items = useCartStore((state) => state.items);
  const totalItems = items.reduce((total, item) => total + (item.quantity || 0), 0);

  // DFL-R100-FINAL-POLISH: pedidos de convidados ja existem no OrdersModal.
  const openRewards = () => {
    if (currentUser) openModal("rewards");
    else openModal("login");
  };

  const goHome = () => { if (pathname === "/") window.scrollTo({ top: 0, behavior: "smooth" }); else router.push("/"); };

  return (
    <nav className={styles.nav} aria-label="Ações principais">
      <button type="button" onClick={goHome} aria-current={pathname === "/" ? "page" : undefined} aria-label="Ir ao cardápio">
        <span aria-hidden="true"><House size={20} strokeWidth={1.9}/></span><b>Cardápio</b>
      </button>
      <button type="button" onClick={() => openModal("orders")} aria-label="Acompanhar meus pedidos, inclusive sem conta">
        <span aria-hidden="true"><ClipboardList size={20} strokeWidth={1.9}/></span><b>Pedidos</b>
      </button>
      <button type="button" onClick={openRewards} aria-label="Abrir fidelidade">
        <span aria-hidden="true"><Gift size={20} strokeWidth={1.9}/></span><b>Fidelidade</b>
      </button>
      <button className={styles.cart} type="button" onClick={() => openModal("cart")} aria-label={`Abrir carrinho, ${totalItems} item(ns)`}>
        <span aria-hidden="true"><ShoppingCart size={20} strokeWidth={1.9}/></span><b>Carrinho</b>
        {totalItems > 0 && <i>{totalItems > 99 ? "99+" : totalItems}</i>}
      </button>
    </nav>
  );
}
