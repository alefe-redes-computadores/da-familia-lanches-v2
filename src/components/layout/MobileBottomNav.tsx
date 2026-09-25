"use client";

import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { useCartStore } from "@/store/cart.store";
import { useUIStore } from "@/store/ui";
import styles from "./MobileBottomNav.module.css";

export function MobileBottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const openModal = useUIStore((state) => state.openModal);
  const currentUser = useAuthStore((state) => state.currentUser);
  const items = useCartStore((state) => state.items);
  const totalItems = items.reduce((total, item) => total + (item.quantity || 0), 0);

  const requireAccount = (destination: "orders" | "rewards") => {
    if (currentUser) openModal(destination);
    else openModal("login");
  };

  const goHome = () => { if (pathname === "/") window.scrollTo({ top: 0, behavior: "smooth" }); else router.push("/"); };

  return (
    <nav className={styles.nav} aria-label="Ações principais">
      <button type="button" onClick={goHome}>
        <span aria-hidden="true">⌂</span><b>Cardápio</b>
      </button>
      <button type="button" onClick={() => requireAccount("orders")}>
        <span aria-hidden="true">▤</span><b>Pedidos</b>
      </button>
      <button type="button" onClick={() => requireAccount("rewards")}>
        <span aria-hidden="true">★</span><b>Progresso</b>
      </button>
      <button className={styles.cart} type="button" onClick={() => openModal("cart")}>
        <span aria-hidden="true">🛒</span><b>Carrinho</b>
        {totalItems > 0 && <i>{totalItems > 99 ? "99+" : totalItems}</i>}
      </button>
    </nav>
  );
}
