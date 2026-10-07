"use client";

import { useEffect, useRef, useState } from "react";
import { Menu, Search, ShoppingCart, UserRound, X } from "lucide-react";
import { CATALOG_SEARCH_EVENT } from "@/lib/catalogSearch";
import { usePathname, useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useCustomerOrderCount } from "@/hooks/useCustomerOrderCount";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useShopStatus } from "@/hooks/useShopStatus";
import { useUIStore } from "@/store/ui";
import { useAuthStore } from "@/store/auth.store";
import { useCartStore } from "@/store/cart.store";
import styles from "./header.module.css";
import { clearGuestContinuity, readGuestIdentity, readGuestOrders, type GuestIdentity } from "@/lib/guestContinuity";

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const openModal = useUIStore((state) => state.openModal);
  const currentUser = useAuthStore((state) => state.currentUser);
  const items = useCartStore((state) => state.items);
  const shopStatus = useShopStatus();
  const { count: ordersCount } = useCustomerOrderCount();
  const { profile } = useUserProfile(currentUser);
  const [showMenu, setShowMenu] = useState(false);
  const [compact, setCompact] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [guestIdentity, setGuestIdentity] = useState<GuestIdentity | null>(null);
  const [guestOrderCount,setGuestOrderCount]=useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sync=()=>{setGuestIdentity(readGuestIdentity());setGuestOrderCount(readGuestOrders().length)}; sync();
    window.addEventListener("dfl:guest-continuity",sync); return()=>window.removeEventListener("dfl:guest-continuity",sync);
  }, []);

  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 120);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const updateCatalogSearch = (value: string) => {
    setCatalogSearch(value);
    window.dispatchEvent(new CustomEvent(CATALOG_SEARCH_EVENT, { detail: value }));
    if (pathname !== "/") router.push("/");
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setShowMenu(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const totalItems = items.reduce((total, item) => total + (item.quantity || 0), 0);
  const userName = profile?.name?.split(" ")[0] || currentUser?.displayName?.split(" ")[0] || currentUser?.email?.split("@")[0] || "Conta";
  const initials = userName.slice(0, 1).toUpperCase();
  const goHome = () => { if (pathname === "/") window.scrollTo({ top: 0, behavior: "smooth" }); else router.push("/"); };

  return (
    <header className={styles.header} data-compact={compact}>
      <button className={styles.brandBlock} type="button" onClick={goHome} aria-label="Ir para o início do cardápio">
        <strong className={styles.logo}>Da Família <span>Lanches</span></strong>
        <span className={styles.status}>
          <i className={shopStatus.isOpen ? styles.open : styles.closed} />
          <span>{shopStatus.isOpen ? "Aberto agora" : shopStatus.mode === "test_open" ? "Em manutenção" : "Fechado agora"}</span>
        </span>
      </button>

      {compact && pathname === "/" && (
        <label className={styles.compactSearch}>
          <Search size={17} aria-hidden="true" />
          <input value={catalogSearch} onChange={(event) => updateCatalogSearch(event.target.value)} placeholder="Buscar no cardápio" aria-label="Buscar no cardápio" />
          {catalogSearch && <button type="button" onClick={() => updateCatalogSearch("")} aria-label="Limpar busca"><X size={15}/></button>}
        </label>
      )}

      <div className={styles.actions}>
        {currentUser ? (
          <div className={styles.accountWrap} ref={menuRef}>
            <button className={styles.account} type="button" onClick={() => setShowMenu((value) => !value)} aria-expanded={showMenu}>
              <span className={styles.accountText}>
                <b>{userName}</b>
                <small>{ordersCount} {ordersCount === 1 ? "pedido" : "pedidos"}</small>
              </span>
              {currentUser.photoURL ? (
                <img src={currentUser.photoURL} alt="" referrerPolicy="no-referrer" />
              ) : (
                <span className={styles.avatar}>{initials}</span>
              )}
            </button>

            {showMenu && (
              <div className={styles.accountMenu}>
                <button type="button" onClick={() => { openModal("account"); setShowMenu(false); }}>Minha conta</button>
                <button type="button" onClick={() => { openModal("orders"); setShowMenu(false); }}>Meus pedidos</button>
                <button type="button" onClick={() => { openModal("rewards"); setShowMenu(false); }}>Meu progresso</button>
                <button className={styles.logout} type="button" onClick={() => auth.signOut()}>Sair da conta</button>
              </div>
            )}
          </div>
        ) : guestIdentity ? (
          <div className={styles.accountWrap} ref={menuRef}>
            <button className={styles.account} type="button" onClick={()=>setShowMenu(v=>!v)} aria-expanded={showMenu}><span className={styles.accountText}><b>{guestIdentity.name.split(" ")[0]}</b><small>{guestOrderCount} {guestOrderCount===1?"pedido":"pedidos"} · neste aparelho</small></span><span className={styles.avatar}>{guestIdentity.name.slice(0,1).toUpperCase()}</span></button>
            {showMenu&&<div className={styles.accountMenu}><button type="button" onClick={()=>{openModal("orders");setShowMenu(false)}}>Meus pedidos neste aparelho</button><button type="button" onClick={()=>{openModal("login");setShowMenu(false)}}>Sincronizar com Google</button><small className={styles.localAccountNote}>Pedidos e endereço ficam salvos neste navegador.</small><button className={styles.logout} type="button" onClick={()=>{if(window.confirm("Limpar os dados salvos neste aparelho?")){clearGuestContinuity();setShowMenu(false)}}}>Limpar dados deste aparelho</button></div>}
          </div>
        ) : (
          <button className={styles.login} type="button" onClick={() => openModal("login")} aria-label="Entrar na conta"><UserRound size={17}/><span>Entrar</span></button>
        )}

        <button className={`${styles.iconButton} ${styles.desktopCart}`} type="button" onClick={() => openModal("cart")} aria-label="Abrir carrinho">
          <ShoppingCart size={19} aria-hidden="true" />
          {totalItems > 0 && <b className={styles.badge}>{totalItems > 99 ? "99+" : totalItems}</b>}
        </button>
        <button className={styles.iconButton} type="button" onClick={() => openModal("menu")} aria-label="Abrir menu">
          <Menu size={20} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
