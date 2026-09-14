"use client";

import { useMemo } from "react";
import { ModalBase } from "./ModalBase";
import { useCustomerOrderCount } from "@/hooks/useCustomerOrderCount";
import { useCartStore } from "@/store/cart.store";
import { useUIStore } from "@/store/ui";
import { useAuthStore } from "@/store/auth.store";
import { products } from "@/data/products";
import styles from "./CartModal.module.css";

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const milestones = [5, 10, 20, 50];

export function CartModal() {
  const { closeModal, openModal } = useUIStore();
  const currentUser = useAuthStore((state) => state.currentUser);
  const { count: ordersCount, loading: loadingHistory } = useCustomerOrderCount();
  const { items, increaseQtd, decreaseQtd, removeItem, clearCart, getCartTotal, addItem } = useCartStore();
  const total = getCartTotal();
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const nextMilestone = useMemo(() => milestones.find((target) => target > ordersCount) ?? milestones[milestones.length - 1], [ordersCount]);
  const progress = Math.min(100, (ordersCount / nextMilestone) * 100);
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

          {!currentUser ? <div className={styles.loginCard}><strong>Seu pedido fica melhor conectado à sua conta.</strong><p>O login com Google leva poucos segundos, vincula o histórico e facilita seus próximos pedidos.</p><button type="button" onClick={() => openModal("login", { returnTo: "cart" })}>Entrar com Google</button></div> : <button className={styles.progress} type="button" onClick={() => openModal("rewards")}><div><strong>Seu histórico na casa</strong><span>{loadingHistory ? "…" : `${ordersCount}/${nextMilestone} pedidos`}</span></div><div className={styles.track}><i style={{ width: `${progress}%` }} /></div><small>Veja seus marcos. Benefícios só aparecem quando estiverem realmente configurados.</small></button>}

          {suggestions.length > 0 && <section className={styles.suggestions}><strong>Que tal completar o pedido?</strong><div>{suggestions.map((product) => <article key={product.id}><img src={product.image} alt={product.name} loading="lazy" /><b>{product.name}</b><span>{money(product.price)}</span><button type="button" onClick={() => addItem(product)}>Adicionar</button></article>)}</div></section>}

          <div className={styles.summary}><div><span>Subtotal</span><strong>{money(total)}</strong></div><small>Entrega, descontos e forma de pagamento são confirmados na próxima etapa.</small><button className={styles.checkout} type="button" onClick={handleFinish}>Continuar para finalizar</button><button className={styles.clear} type="button" onClick={() => window.confirm("Esvaziar carrinho?") && clearCart()}>Esvaziar carrinho</button></div>
        </>}
      </div>
    </ModalBase>
  );
}
