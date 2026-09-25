"use client";

import { useEffect, useMemo, useState } from "react";
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
import { DEFAULT_COMMERCIAL_SETTINGS, getCommercialSettings, type CommercialSettings } from "@/lib/commercialSettings";
import { availableAddonsForProduct } from "@/lib/catalog";

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });


export function CartModal() {
  const { closeModal, openModal, showCartToast } = useUIStore();
  const currentUser = useAuthStore((state) => state.currentUser);
  const orderStats = useCustomerOrderStats();
  const { products, allAddons, loading: catalogLoading } = useCatalog();
  const { items, increaseQtd, decreaseQtd, removeItem, restoreItem, clearCart, replaceItems, getCartTotal } = useCartStore();
  const [clearArmed, setClearArmed] = useState(false);
  const [catalogNotice, setCatalogNotice] = useState("");
  const [commercial, setCommercial] = useState<CommercialSettings>(DEFAULT_COMMERCIAL_SETTINGS);
  useEffect(() => { void getCommercialSettings().then(setCommercial).catch(() => setCommercial(DEFAULT_COMMERCIAL_SETTINGS)); }, []);
  useEffect(() => {
    if (catalogLoading || !items.length) return;
    const next = items.flatMap((item) => {
      const product = products.find((candidate) => candidate.id === item.id);
      if (!product?.disponivel) return [];
      const allowed = new Map(availableAddonsForProduct(product, allAddons).map((addon) => [addon.id, addon]));
      const selectedAddons = (item.selectedAddons ?? []).flatMap((addon) => {
        const current = allowed.get(addon.id);
        return current?.disponivel === false || !current ? [] : [current];
      });
      const addonsId = selectedAddons.map((addon) => addon.id).sort().join("-");
      const observation = (item.observation ?? "").trim();
      const source=item.upsellSourceId ? products.find(candidate=>candidate.id===item.upsellSourceId) : undefined;
      const validUpsell=Boolean(source && source.upsellProductId===product.id && source.upsellUnitPrice!=null && source.upsellUnitPrice>=0 && source.upsellUnitPrice<product.price);
      const basePrice=validUpsell ? Number(source!.upsellUnitPrice) : Number(product.price);
      const commercialKey=validUpsell ? `upsell:${source!.id}` : "regular";
      return [{ ...product, cartId: `${product.id}|${addonsId}|${observation}|${commercialKey}`, quantity:item.quantity, selectedAddons, observation, price:basePrice+selectedAddons.reduce((sum,addon)=>sum+Number(addon.price),0), ...(validUpsell?{upsellSourceId:source!.id}:{}) }];
    });
    const compactedRaw = Array.from(next.reduce((map, item) => {
      const previous = map.get(item.cartId);
      map.set(item.cartId, previous ? { ...item, quantity: previous.quantity + item.quantity } : item);
      return map;
    }, new Map<string, (typeof next)[number]>()).values());
    const compacted = compactedRaw.flatMap(item=>{
      if(!item.upsellSourceId) return [item];
      const entitlement=compactedRaw.filter(source=>source.id===item.upsellSourceId&&!source.upsellSourceId).reduce((sum,source)=>sum+source.quantity,0);
      if(entitlement<=0) return [];
      return [{...item,quantity:Math.min(item.quantity,entitlement)}];
    });
    const before = items.map(({ cartId, quantity, price }) => [cartId, quantity, price]);
    const after = compacted.map(({ cartId, quantity, price }) => [cartId, quantity, price]);
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      const removed = items.length - next.length;
      replaceItems(compacted);
      setCatalogNotice(removed > 0 ? "Atualizamos os preços e removemos item(ns) que não estão mais disponíveis." : "Seu carrinho foi atualizado com os preços atuais do cardápio.");
    }
  }, [allAddons, catalogLoading, items, products, replaceItems]);
  const total = getCartTotal();
  const freeDeliveryTarget = commercial.freeDeliveryEnabled ? commercial.globalMinimum : null;
  const freeDeliveryMissing = freeDeliveryTarget === null ? 0 : Math.max(0, freeDeliveryTarget - total);
  const freeDeliveryProgress = freeDeliveryTarget && freeDeliveryTarget > 0 ? Math.min(100, (total / freeDeliveryTarget) * 100) : 100;
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
  const handleIncreaseItem = (cartId: string) => {
    const item=items.find(current=>current.cartId===cartId);
    if(!item) return;
    if(item.upsellSourceId){
      const sourceQty=items.filter(current=>current.id===item.upsellSourceId&&!current.upsellSourceId).reduce((sum,current)=>sum+current.quantity,0);
      const usedQty=items.filter(current=>current.id===item.id&&current.upsellSourceId===item.upsellSourceId).reduce((sum,current)=>sum+current.quantity,0);
      if(usedQty>=sourceQty){
        showCartToast({title:"Limite da oferta atingido",message:"Cada unidade do produto principal libera uma unidade neste preço especial.",kind:"restore"});
        haptic("step"); return;
      }
    }
    increaseQtd(cartId); haptic("step");
  };
  const handleClearCart = () => { if (!clearArmed) { setClearArmed(true); haptic("step"); return; } clearCart(); setClearArmed(false); haptic("remove"); showCartToast({ title: "Carrinho esvaziado", message: "Pronto para montar um novo pedido.", kind: "remove" }); };

  const handleSmartSuggestion = (suggestion: (typeof suggestions)[number]) => {
    if(suggestion.kind==="upsell" && suggestion.upsellSourceId && suggestion.explicitUnitPrice!=null){
      const sourceQty=items.filter(i=>i.id===suggestion.upsellSourceId&&!i.upsellSourceId).reduce((n,i)=>n+i.quantity,0);
      const used=items.filter(i=>i.id===suggestion.product.id&&i.upsellSourceId===suggestion.upsellSourceId).reduce((n,i)=>n+i.quantity,0);
      if(used>=sourceQty){showCartToast({title:"Oferta já aproveitada",message:"A quantidade promocional acompanha a quantidade do combo.",kind:"restore"});return;}
      useCartStore.getState().addItem(suggestion.product,1,[],"",{upsellSourceId:suggestion.upsellSourceId,unitPrice:suggestion.explicitUnitPrice});
      haptic("add"); showCartToast({title:suggestion.product.name+" adicionado",message:"Preço especial de "+money(suggestion.explicitUnitPrice)+" aplicado.",kind:"add"}); return;
    }
    openModal("product-details",suggestion.product);
  };

  const handleFinish = () => {
    if (!currentUser) { openModal("login", { returnTo: "checkout" }); return; }
    openModal("checkout");
  };

  return (
    <ModalBase title={`Seu carrinho${itemCount ? ` · ${itemCount} item${itemCount === 1 ? "" : "s"}` : ""}`} onClose={closeModal}>
      <div className={styles.body}>
        {catalogNotice && <div className={styles.catalogNotice} role="status">{catalogNotice}<button type="button" aria-label="Fechar aviso" onClick={() => setCatalogNotice("")}>×</button></div>}
        {items.length === 0 ? (
          <div className={styles.empty}><span>🛒</span><strong>Seu carrinho está vazio</strong><p>Escolha seus favoritos e volte aqui para finalizar.</p><button type="button" onClick={closeModal}>Explorar cardápio</button></div>
        ) : <>
          <div className={styles.items}>{items.map((item) => <article className={styles.item} key={item.cartId}>
            <div className={styles.itemInfo}><strong>{item.name}</strong>{item.upsellSourceId && <span className={styles.offerBadge}>PREÇO ESPECIAL DO COMBO</span>}{item.selectedAddons?.length > 0 && <small>+ {item.selectedAddons.map((addon) => addon.name).join(", ")}</small>}{item.observation?.trim() && <small>Obs.: {item.observation.trim()}</small>}<b>{money(item.price * item.quantity)}</b>{item.quantity > 1 && <i>{money(item.price)} cada</i>}</div>
            <div className={styles.itemActions}><div className={styles.stepper}><button type="button" aria-label={`Diminuir ${item.name}`} onClick={() => handleDecreaseItem(item.cartId)}>−</button><span>{item.quantity}</span><button type="button" aria-label={`Aumentar ${item.name}`} onClick={() => handleIncreaseItem(item.cartId)}>+</button></div><button className={styles.remove} type="button" onClick={() => handleRemoveItem(item.cartId)}>Remover</button></div>
          </article>)}</div>

          {!currentUser ? <div className={styles.loginCard}><strong>Seu pedido fica melhor conectado à sua conta.</strong><p>O login com Google leva poucos segundos, vincula o histórico e facilita seus próximos pedidos.</p><button type="button" onClick={() => openModal("login", { returnTo: "cart" })}>Entrar com Google</button></div> : <button className={styles.progress} type="button" onClick={() => openModal("rewards")}><div><strong>Seu histórico na casa</strong><span>{orderStats.loading ? "..." : `${orderStats.completed} concluído${orderStats.completed === 1 ? "" : "s"}`}</span></div><small>{orderStats.active > 0 ? `${orderStats.active} pedido${orderStats.active === 1 ? "" : "s"} em andamento. ` : ""}A fidelidade será baseada em pedidos realmente concluídos.</small></button>}

          {suggestions.length > 0 && <section className={styles.smartSuggestions} aria-label="Sugestões para o pedido"><div className={styles.smartHead}><strong>Seu pedido, um pouco mais esperto</strong><span>Sugestões baseadas no que já está no carrinho.</span></div><div className={styles.smartList}>{suggestions.map((suggestion) => <button type="button" className={styles.smartCard} key={`${suggestion.kind}-${suggestion.product.id}`} onClick={() => handleSmartSuggestion(suggestion)}><img src={suggestion.product.image} alt="" loading="lazy" /><span className={styles.smartCopy}><small>{suggestion.eyebrow}</small><b>{suggestion.title}</b><em>{suggestion.description}</em>{suggestion.saving && suggestion.saving > 0 ? <strong>{suggestion.kind==="upsell" ? "Você economiza " : "Economia calculada de "}{money(suggestion.saving)}</strong> : null}</span><span className={styles.smartPrice}>{suggestion.kind==="upsell"&&suggestion.explicitUnitPrice!=null?<><del>{money(suggestion.product.price)}</del>{money(suggestion.explicitUnitPrice)}</>:money(suggestion.product.price)}<i>{suggestion.kind==="upsell"?"Adicionar agora +":"Ver opção ›"}</i></span></button>)}</div></section>}

          {freeDeliveryTarget !== null && <section className={styles.freeDeliveryProgress} data-earned={freeDeliveryMissing <= 0}><div className={styles.freeDeliveryCopy}><span>{freeDeliveryMissing <= 0 ? "FRETE GRÁTIS LIBERADO" : "META DE FRETE GRÁTIS"}</span><strong>{freeDeliveryMissing <= 0 ? "Benefício alcançado" : `Faltam ${money(freeDeliveryMissing)}`}</strong></div><div className={styles.freeDeliveryTrack}><i style={{ width: `${freeDeliveryProgress}%` }} /></div><small>{freeDeliveryMissing <= 0 ? "A regra final considera o bairro informado no checkout." : `Regra geral: entrega grátis a partir de ${money(freeDeliveryTarget)}.`}</small></section>}
          <CartPromotionInsight />{productSavings > 0 && <div className={styles.savings}><span>Você economizou nos produtos</span><strong>{money(productSavings)}</strong></div>}<div className={styles.summary}><div><span>Subtotal</span><strong>{money(total)}</strong></div><small>Entrega, descontos e forma de pagamento são confirmados na próxima etapa.</small><button className={styles.checkout} type="button" onClick={handleFinish}>Continuar para finalizar</button><button className={styles.clear} data-armed={clearArmed} type="button" onClick={handleClearCart}>{clearArmed ? "Toque novamente para esvaziar" : "Esvaziar carrinho"}</button>{clearArmed && <button className={styles.cancelClear} type="button" onClick={() => setClearArmed(false)}>Cancelar</button>}</div>
        </>}
      </div>
    </ModalBase>
  );
}
