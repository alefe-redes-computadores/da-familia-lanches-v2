"use client";

import { useMemo, useState } from "react";
import { ModalBase } from "./ModalBase";
import { useCustomerOrderStats } from "@/hooks/useCustomerOrderStats";
import { useCartStore } from "@/store/cart.store";
import { useUIStore } from "@/store/ui";
import { useAuthStore } from "@/store/auth.store";
import { useCatalog } from "@/hooks/useCatalog";
import styles from "./CartModal.module.css";

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });


export function CartModal() {
  const { closeModal, openModal } = useUIStore();
  const currentUser = useAuthStore((state) => state.currentUser);
  const orderStats = useCustomerOrderStats();
  const { products } = useCatalog();
  const { items, increaseQtd, decreaseQtd, removeItem, clearCart, getCartTotal } = useCartStore();
  const [clearArmed, setClearArmed] = useState(false);
  const total = getCartTotal();
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const suggestions = useMemo(() => products.filter((product) => product.isSuggestion && product.disponivel !== false && !items.some((item) => item.id === product.id)).slice(0, 6), [items]);

  const handleFinish = () => {
    if (!currentUser) { openModal("login", { returnTo: "checkout" }); return; }
    openModal("checkout");
  };

  return (
    <ModalBase title={`Seu carrinho${itemCount ? ` · ${itemCount} item${itemCount === 1 ? "" : "s"}` : ""}`} onClose={closeModal}>
      <div className={styles.body}>
        {items.length === 0 ? (
          <div className={styles.empty}><span>🛒</span><strong>Seu carrinho está vazio</strong><p>Escolha seus favoritos e volte aqui para finalizar.</p><button type="button" onClick={closeModal}>Explorar cardápio</button></div>
        ) : <>
          <div className={styles.items}>{items.map((item) => <article className={styles.item} key={item.cartId}>
            <div className={styles.itemInfo}><strong>{item.name}</strong>{item.selectedAddons?.length > 0 && <small>+ {item.selectedAddons.map((addon) => addon.name).join(", ")}</small>}{item.observation?.trim() && <small>Obs.: {item.observation.trim()}</small>}<b>{money(item.price * item.quantity)}</b>{item.quantity > 1 && <i>{money(item.price)} cada</i>}</div>
            <div className={styles.itemActions}><div className={styles.stepper}><button type="button" aria-label={`Diminuir ${item.name}`} onClick={() => decreaseQtd(item.cartId)}>−</button><span>{item.quantity}</span><button type="button" aria-label={`Aumentar ${item.name}`} onClick={() => increaseQtd(item.cartId)}>+</button></div><button className={styles.remove} type="button" onClick={() => removeItem(item.cartId)}>Remover</button></div>
          </article>)}</div>

          {!currentUser ? <div className={styles.loginCard}><strong>Seu pedido fica melhor conectado à sua conta.</strong><p>O login com Google leva poucos segundos, vincula o histórico e facilita seus próximos pedidos.</p><button type="button" onClick={() => openModal("login", { returnTo: "cart" })}>Entrar com Google</button></div> : <button className={styles.progress} type="button" onClick={() => openModal("rewards")}><div><strong>Seu histórico na casa</strong><span>{orderStats.loading ? "..." : `${orderStats.completed} concluído${orderStats.completed === 1 ? "" : "s"}`}</span></div><small>{orderStats.active > 0 ? `${orderStats.active} pedido${orderStats.active === 1 ? "" : "s"} em andamento. ` : ""}A fidelidade será baseada em pedidos realmente concluídos.</small></button>}

          {suggestions.length > 0 && <section className={styles.suggestions}><strong>Que tal completar o pedido?</strong><div>{suggestions.map((product) => <article key={product.id}><img src={product.image} alt={product.name} loading="lazy" /><b>{product.name}</b><span>{money(product.price)}</span><button type="button" onClick={() => openModal("product-details", product)}>Ver opções</button></article>)}</div></section>}

          <div className={styles.summary}><div><span>Subtotal</span><strong>{money(total)}</strong></div><small>Entrega, descontos e forma de pagamento são confirmados na próxima etapa.</small><button className={styles.checkout} type="button" onClick={handleFinish}>Continuar para finalizar</button><button className={styles.clear} data-armed={clearArmed} type="button" onClick={() => { if (clearArmed) { clearCart(); setClearArmed(false); } else setClearArmed(true); }}>{clearArmed ? "Toque novamente para esvaziar" : "Esvaziar carrinho"}</button>{clearArmed && <button className={styles.cancelClear} type="button" onClick={() => setClearArmed(false)}>Cancelar</button>}</div>
        </>}
      </div>
    </ModalBase>
  );
}
