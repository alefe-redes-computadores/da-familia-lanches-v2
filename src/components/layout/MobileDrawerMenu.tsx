"use client";

import { useEffect, useState } from "react";
import {
  Home,
  ClipboardList,
  Star,
  ShoppingCart,
  UserRound,
  Share2,
  MessageCircle,
  X,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { useCartStore } from "@/store/cart.store";
import { useUIStore } from "@/store/ui";
import { useShopStatus } from "@/hooks/useShopStatus";
import { businessWhatsAppUrl } from "@/lib/businessContact";
import styles from "./MobileDrawerMenu.module.css";

type IconName = "home" | "orders" | "star" | "cart" | "user" | "share" | "chat" | "close";

function Icon({ name }: { name: IconName }) {
  const props = { size: 21, strokeWidth: 1.9, "aria-hidden": true as const };
  if (name === "home") return <Home {...props} />;
  if (name === "orders") return <ClipboardList {...props} />;
  if (name === "star") return <Star {...props} />;
  if (name === "cart") return <ShoppingCart {...props} />;
  if (name === "user") return <UserRound {...props} />;
  if (name === "share") return <Share2 {...props} />;
  if (name === "chat") return <MessageCircle {...props} />;
  return <X {...props} />;
}

export function MobileDrawerMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const activeModal = useUIStore((state) => state.activeModal);
  const closeModal = useUIStore((state) => state.closeModal);
  const openModal = useUIStore((state) => state.openModal);
  const currentUser = useAuthStore((state) => state.currentUser);
  const items = useCartStore((state) => state.items);
  const shopStatus = useShopStatus();
  const [shared, setShared] = useState(false);
  const isOpen = activeModal === "menu";
  const itemCount = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const cartTotal = items.reduce((sum, item) => sum + Number(item.price) * (item.quantity || 0), 0);
  const firstName = currentUser?.displayName?.split(" ")[0] || currentUser?.email?.split("@")[0] || "Visitante";

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") closeModal(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeModal, isOpen]);

  if (!isOpen) return null;

  const modal = (destination: "orders" | "rewards" | "account" | "cart") => {
    closeModal();
    openModal(destination === "cart" || currentUser ? destination : "login");
  };
  const home = () => {
    closeModal();
    if (pathname === "/") window.scrollTo({ top: 0, behavior: "smooth" });
    else router.push("/");
  };
  const share = async () => {
    const data = { title: "Da Família Lanches", text: "Veja o cardápio da Da Família Lanches", url: "https://dafamilialanches.com.br" };
    try {
      if (navigator.share) await navigator.share(data);
      else await navigator.clipboard.writeText(data.url);
      setShared(true);
      window.setTimeout(() => setShared(false), 2200);
    } catch { /* cancelamento não precisa virar erro */ }
  };

  return (
    <div className={styles.root} role="dialog" aria-modal="true" aria-label="Menu rápido">
      <button className={styles.backdrop} type="button" onClick={closeModal} aria-label="Fechar menu" />
      <aside className={styles.drawer}>
        <header className={styles.drawerHeader}>
          <div className={styles.brandMark}>DFL</div>
          <div className={styles.brandCopy}><span>DA FAMÍLIA LANCHES</span><strong>Seu pedido começa aqui</strong></div>
          <button className={styles.closeBtn} type="button" onClick={closeModal} aria-label="Fechar"><Icon name="close" /></button>
        </header>

        <section className={styles.welcome}>
          <div className={styles.welcomeTop}>
            <div><span>{currentUser ? `Olá, ${firstName}` : "Bem-vindo"}</span><strong>{currentUser ? "Tudo pronto para pedir de novo." : "Entre para acompanhar seus pedidos."}</strong></div>
            <i data-open={shopStatus.isOpen}>{shopStatus.isOpen ? "ABERTO" : "FECHADO"}</i>
          </div>
          {!currentUser && <button type="button" onClick={() => modal("account")}>Entrar com Google <b>›</b></button>}
        </section>

        <nav className={styles.actionGrid} aria-label="Atalhos">
          <button type="button" onClick={home}><span><Icon name="home" /></span><div><b>Cardápio</b><small>Voltar ao início</small></div></button>
          <button type="button" onClick={() => modal("orders")}><span><Icon name="orders" /></span><div><b>Meus pedidos</b><small>Acompanhar e repetir</small></div></button>
          <button type="button" onClick={() => modal("rewards")}><span><Icon name="star" /></span><div><b>Recompensas</b><small>Progresso e benefícios</small></div></button>
          <button className={styles.cartAction} type="button" onClick={() => modal("cart")}><span><Icon name="cart" /></span><div><b>Carrinho {itemCount > 0 ? `· ${itemCount}` : ""}</b><small>{itemCount ? cartTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "Comece seu pedido"}</small></div></button>
        </nav>

        <div className={styles.utility}>
          <button type="button" onClick={() => modal("account")}><Icon name="user" /><span>{currentUser ? "Minha conta" : "Entrar"}</span></button>
          <button type="button" onClick={share}><Icon name="share" /><span>{shared ? "Link copiado" : "Compartilhar"}</span></button>
          <a href={businessWhatsAppUrl("Olá! Preciso de ajuda com um pedido no site.")} target="_blank" rel="noreferrer"><Icon name="chat" /><span>Ajuda</span></a>
        </div>

        <footer><span>Pedido direto, sem taxa de aplicativo.</span><small>Da Família Lanches · Patos de Minas</small></footer>
      </aside>
    </div>
  );
}
