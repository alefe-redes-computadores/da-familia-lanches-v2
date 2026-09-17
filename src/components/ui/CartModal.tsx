"use client";

import { useMemo, useState } from "react";
import { ModalBase } from "./ModalBase";
import { useCustomerOrderStats } from "@/hooks/useCustomerOrderStats";
import { useCartStore } from "@/store/cart.store";
import { useUIStore } from "@/store/ui";
import { useAuthStore } from "@/store/auth.store";
import { useCatalog } from "@/hooks/useCatalog";
import styles from "./CartModal.module.css";
import { haptic } from "@/lib/haptics";
import { CartPromotionInsight } from "@/components/ui/CartPromotionInsight";
import { selectSmartCartSuggestions } from "@/lib/smartCart";

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });


export function CartModal() {
  const { closeModal, openModal, showCartToast } = useUIStore();
  const currentUser = useAuthStore((state) => state.currentUser);
  const orderStats = useCustomerOrderStats();
  const { products } = useCatalog();
  const { items, increaseQtd, decreaseQtd, removeItem, restoreItem, clearCart, getCartTotal } = useCartStore();
  const [clearArmed, setClearArmed] = useState(false);
  const total = getCartTotal();
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const productSavings = useMemo(() => items.reduce((sum, item) => {
    const current = products.find((product) => product.id === item.id);
    return current && typeof current.oldPrice === "number" && current.oldPrice > current.price
      ? sum + (current.oldPrice - current.price) * item.quantity : sum;
  }, 0), [items, products]);
  const suggestions = useMemo(() => selectSmartCartSuggestions(items, products, 3), [items, products]);

  const handleRemoveItem = (cartId: string) => {
    const removed = items.find((item) => item.cartId === cartId);
    if (!removed) return;
    removeItem(cartId); haptic("remove");
    showCartToast({ title: `${removed.name} removido`, message: "Mudou de ideia? Dá para colocar exatamente como estava.", kind: "remove", actionLabel: "Desfazer", onAction: () => { restoreItem(removed); haptic("restore"); showCartToast({ title: `${removed.name} restaurado`, kind: "restore" }); } });
  };
  const handleDecreaseItem = (cartId: string) => { const item = items.find((current) => current.cartId === cartId); if (!item) return; if (item.quantity <= 1) return handleRemoveItem(cartId); decreaseQtd(cartId); haptic("step"); };
  const handleIncreaseItem = (cartId: string) => { increaseQtd(cartId); haptic("step"); };
  const handleClearCart = () => { if (!clearArmed) { setClearArmed(true); haptic("step"); return; } clearCart(); setClearArmed(false); haptic("remove"); showCartToast({ title: "Carrinho esvaziado", message: "Pronto para montar um novo pedido.", kind: "remove" }); };

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
            <div className={styles.itemActions}><div className={styles.stepper}><button type="button" aria-label={`Diminuir ${item.name}`} onClick={() => handleDecreaseItem(item.cartId)}>−</button><span>{item.quantity}</span><button type="button" aria-label={`Aumentar ${item.name}`} onClick={() => handleIncreaseItem(item.cartId)}>+</button></div><button className={styles.remove} type="button" onClick={() => handleRemoveItem(item.cartId)}>Remover</button></div>
          </article>)}</div>

          {!currentUser ? <div className={styles.loginCard}><strong>Seu pedido fica melhor conectado à sua conta.</strong><p>O login com Google leva poucos segundos, vincula o histórico e facilita seus próximos pedidos.</p><button type="button" onClick={() => openModal("login", { returnTo: "cart" })}>Entrar com Google</button></div> : <button className={styles.progress} type="button" onClick={() => openModal("rewards")}><div><strong>Seu histórico na casa</strong><span>{orderStats.loading ? "..." : `${orderStats.completed} concluído${orderStats.completed === 1 ? "" : "s"}`}</span></div><small>{orderStats.active > 0 ? `${orderStats.active} pedido${orderStats.active === 1 ? "" : "s"} em andamento. ` : ""}A fidelidade será baseada em pedidos realmente concluídos.</small></button>}

          {suggestions.length > 0 && <section className={styles.smartSuggestions}><div className={styles.smartHead}><strong>Seu pedido, um pouco mais esperto</strong><span>Sugestões baseadas no que já está no carrinho.</span></div><div className={styles.smartList}>{suggestions.map((suggestion) => <button type="button" className={styles.smartCard} key={`${suggestion.kind}-${suggestion.product.id}`} onClick={() => openModal("product-details", suggestion.product)}><img src={suggestion.product.image} alt="" loading="lazy" /><span className={styles.smartCopy}><small>{suggestion.eyebrow}</small><b>{suggestion.title}</b><em>{suggestion.description}</em>{suggestion.saving && suggestion.saving > 0 ? <strong>Economia potencial de {money(suggestion.saving)}</strong> : null}</span><span className={styles.smartPrice}>{money(suggestion.product.price)}<i>Adicionar ›</i></span></button>)}</div></section>}

          <CartPromotionInsight />{productSavings > 0 && <div className={styles.savings}><span>Você economizou nos produtos</span><strong>{money(productSavings)}</strong></div>}<div className={styles.summary}><div><span>Subtotal</span><strong>{money(total)}</strong></div><small>Entrega, descontos e forma de pagamento são confirmados na próxima etapa.</small><button className={styles.checkout} type="button" onClick={handleFinish}>Continuar para finalizar</button><button className={styles.clear} data-armed={clearArmed} type="button" onClick={handleClearCart}>{clearArmed ? "Toque novamente para esvaziar" : "Esvaziar carrinho"}</button>{clearArmed && <button className={styles.cancelClear} type="button" onClick={() => setClearArmed(false)}>Cancelar</button>}</div>
        </>}
      </div>
    </ModalBase>
  );
}
