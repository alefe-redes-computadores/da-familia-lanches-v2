"use client";

import { useEffect, useMemo, useState } from "react";
import { ModalBase } from "./ModalBase";
import { useCustomerOrderStats } from "@/hooks/useCustomerOrderStats";
import { useCartStore } from "@/store/cart.store";
import { useUIStore } from "@/store/ui";
import { useAuthStore } from "@/store/auth.store";
import { useCatalog } from "@/hooks/useCatalog";
import { CatalogImage } from "@/components/ui/CatalogImage";
import { remainingUpsellUnits } from "@/lib/upsellEntitlement";
import { canRestoreClearedCart } from "@/lib/cartRestoreSafety";
import { Trash2 } from "lucide-react";
import styles from "./CartModal.module.css";
import { haptic } from "@/lib/haptics";
import { CartPromotionInsight } from "@/components/ui/CartPromotionInsight";
import { selectSmartCartSuggestions } from "@/lib/smartCart";
import { DEFAULT_COMMERCIAL_SETTINGS, getCommercialSettings, type CommercialSettings } from "@/lib/commercialSettings";
import { availableAddonsForProduct } from "@/lib/catalog";
import { validAddonSelection, addonPolicyHint } from "@/lib/catalogAddonPolicy";
import { inspectProductSelections } from "@/lib/catalogModifierGroups";

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });


export function CartModal() {
  const { closeModal, openModal, showCartToast } = useUIStore();
  const currentUser = useAuthStore((state) => state.currentUser);
  const orderStats = useCustomerOrderStats();
  const { products, allAddons, loading: catalogLoading, error: catalogError, source: catalogSource } = useCatalog();
  const { items, increaseQtd, decreaseQtd, removeItem, restoreItem, clearCart, replaceItems, getCartTotal } = useCartStore();
  const [clearArmed, setClearArmed] = useState(false);
  // R30: segunda confirmacao expira; nao fica armada indefinidamente.
  useEffect(() => {
    if (!clearArmed) return;
    const timer = window.setTimeout(() => setClearArmed(false), 8000);
    return () => window.clearTimeout(timer);
  }, [clearArmed]);
  const [catalogNotice, setCatalogNotice] = useState("");
  const [commercial, setCommercial] = useState<CommercialSettings>(DEFAULT_COMMERCIAL_SETTINGS);
  // R29: indice local memoizado, sem novas leituras de banco.
  const catalogIndex = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const [loginIntentAlreadyShown, setLoginIntentAlreadyShown] = useState(false);
  useEffect(() => { setLoginIntentAlreadyShown(window.sessionStorage.getItem("dfl_login_intent_shown") === "1"); }, []);
  useEffect(() => { void getCommercialSettings().then(setCommercial).catch(() => setCommercial(DEFAULT_COMMERCIAL_SETTINGS)); }, []);
  // V85 R4: preparo puro, sem alterar o carrinho ao abrir o modal.
  // A atualizacao so acontece apos o cliente conferir e confirmar.
  const reconciliation = useMemo(() => {
    // Fallback em falha da API NAO pode sobrescrever preco ou disponibilidade
    // do carrinho persistido. O servidor valida novamente no fechamento.
    if (catalogLoading || !items.length || catalogError || catalogSource !== "hybrid") return null;
    const byId = catalogIndex;
    const next = items.flatMap((item) => {
      const product = byId.get(item.id);
      if (!product || product.disponivel === false) return [];
      const allowed = new Map(availableAddonsForProduct(product, allAddons).map((addon) => [addon.id, addon]));
      const selectedAddons = (item.selectedAddons ?? []).flatMap((addon) => {
        const current = allowed.get(addon.id);
        return !current || current.disponivel === false ? [] : [current];
      });
      const addonsId = selectedAddons.map((addon) => addon.id).sort().join("-");
      const observation = (item.observation ?? "").trim();
      const source = item.upsellSourceId ? byId.get(item.upsellSourceId) : undefined;
      const validUpsell = Boolean(source && source.upsellProductId === product.id &&
        source.upsellUnitPrice != null && source.upsellUnitPrice >= 0 && source.upsellUnitPrice < product.price);
      const basePrice = validUpsell ? Number(source!.upsellUnitPrice) : Number(product.price);
      const commercialKey = validUpsell ? `upsell:${source!.id}` : "regular";
      return [{ ...product, cartId: `${product.id}|${addonsId}|${observation}|${commercialKey}`,
        quantity: item.quantity, selectedAddons, observation,
        price: basePrice + selectedAddons.reduce((sum, addon) => sum + Number(addon.price), 0),
        ...(validUpsell ? { upsellSourceId: source!.id } : {}) }];
    });
    const compactedRaw = Array.from(next.reduce((map, item) => {
      const previous = map.get(item.cartId);
      map.set(item.cartId, previous ? { ...item, quantity: previous.quantity + item.quantity } : item);
      return map;
    }, new Map<string, (typeof next)[number]>()).values());
    const compacted = compactedRaw.flatMap((item) => {
      if (!item.upsellSourceId) return [item];
      const entitlement = compactedRaw.filter((other) => other.id === item.upsellSourceId && !other.upsellSourceId)
        .reduce((sum, other) => sum + other.quantity, 0);
      if (entitlement <= 0) return [];
      return [{ ...item, quantity: Math.min(item.quantity, entitlement) }];
    });
    const signature = (entries: typeof items) => JSON.stringify(entries.map((item) => ({
      id: item.id, cartId: item.cartId, name: item.name, quantity: item.quantity, price: item.price,
      upsellSourceId: item.upsellSourceId ?? "", observation: item.observation ?? "",
      addons: (item.selectedAddons ?? []).map((addon) => [addon.id, addon.name, addon.price]),
    })));
    if (signature(items) === signature(compacted)) return null;
    const removedNames = [...new Set(items.filter((item) => {
      const oldQuantity = items.filter((old) => old.id === item.id && old.upsellSourceId === item.upsellSourceId)
        .reduce((sum, old) => sum + old.quantity, 0);
      const newQuantity = compacted.filter((updated) => updated.id === item.id && updated.upsellSourceId === item.upsellSourceId)
        .reduce((sum, updated) => sum + updated.quantity, 0);
      return newQuantity < oldQuantity;
    }).map((item) => item.name))];
    return { next: compacted, removedNames, originalSignature: signature(items) };
  }, [allAddons, catalogLoading, catalogError, catalogSource, items, products, catalogIndex]);
  const invalidSelections = useMemo(()=>items.flatMap(item=>{
    const product=catalogIndex.get(item.id);
    if(!product)return [];
    const review=inspectProductSelections(product,(item.selectedAddons??[]).map(a=>a.id));
    return !review.valid ? [{name:item.name,hint:review.reason||addonPolicyHint(product)}] : [];
  }),[items,products,catalogIndex]);
  const total = getCartTotal();
  const freeDeliveryTarget = commercial.freeDeliveryEnabled ? commercial.globalMinimum : null;
  const freeDeliveryMissing = freeDeliveryTarget === null ? 0 : Math.max(0, freeDeliveryTarget - total);
  const freeDeliveryProgress = freeDeliveryTarget && freeDeliveryTarget > 0 ? Math.min(100, (total / freeDeliveryTarget) * 100) : 100;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const productSavings = useMemo(() => items.reduce((sum, item) => {
    const current = catalogIndex.get(item.id);
    return current && typeof current.oldPrice === "number" && current.oldPrice > current.price
      ? sum + (current.oldPrice - current.price) * item.quantity : sum;
  }, 0), [items, products, catalogIndex]);
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
    if(item.quantity >= 30){
      showCartToast({title:"Limite de unidades",message:"Cada produto permite até 30 unidades por linha.",kind:"restore"});
      haptic("step"); return;
    }
    if(item.upsellSourceId){
      if(remainingUpsellUnits(items, item.upsellSourceId, item.id)<=0){
        showCartToast({title:"Limite da oferta atingido",message:"Cada unidade do produto principal libera uma unidade neste preço especial.",kind:"restore"});
        haptic("step"); return;
      }
    }
    increaseQtd(cartId); haptic("step");
  };
  const handleClearCart = () => {
    if (!clearArmed) { setClearArmed(true); haptic("step"); return; }
    const snapshot = useCartStore.getState().items.map((item) => ({
      ...item, selectedAddons: (item.selectedAddons ?? []).map((addon) => ({ ...addon })),
    }));
    setClearArmed(false);
    if (!snapshot.length) return;
    clearCart(); haptic("remove");
    showCartToast({
      title: "Carrinho esvaziado",
      message: "Mudou de ideia? Restaure os itens antes que o aviso desapareça.",
      kind: "remove", actionLabel: "Desfazer",
      onAction: () => {
        const state = useCartStore.getState();
        if (!canRestoreClearedCart(state.items, snapshot)) {
          showCartToast({ title: "Seu carrinho já mudou", message: "Não restauramos a lista antiga para preservar os itens atuais.", kind: "restore" });
          return;
        }
        state.replaceItems(snapshot);
        haptic("restore");
        showCartToast({ title: "Carrinho restaurado", message: "Confira os itens e preços antes de finalizar.", kind: "restore" });
      },
    });
  };

  const handleSmartSuggestion = (suggestion: (typeof suggestions)[number]) => {
    if(suggestion.kind==="upsell" && suggestion.upsellSourceId && suggestion.explicitUnitPrice!=null){
      if(!inspectProductSelections(suggestion.product,[]).valid){
        openModal("product-details",suggestion.product);
        setCatalogNotice("Este item exige escolha de adicionais. Personalize antes de incluir.");return;
      }
      if(remainingUpsellUnits(items, suggestion.upsellSourceId, suggestion.product.id)<=0){showCartToast({title:"Oferta já aproveitada",message:"A quantidade promocional acompanha a quantidade do combo.",kind:"restore"});return;}
      useCartStore.getState().addItem(suggestion.product,1,[],"",{upsellSourceId:suggestion.upsellSourceId,unitPrice:suggestion.explicitUnitPrice});
      haptic("add"); showCartToast({title:suggestion.product.name+" adicionado",message:"Preço especial de "+money(suggestion.explicitUnitPrice)+" aplicado.",kind:"add"}); return;
    }
    haptic("step");
    openModal("product-details",suggestion.product);
  };

  const applyCatalogReview = () => {
    if (!reconciliation) return;
    // Mudancas feitas no carrinho durante a revisao nunca sao sobrescritas.
    const current = useCartStore.getState().items;
    const signature = (entries: typeof items) => JSON.stringify(entries.map((item) => ({
      id: item.id, cartId: item.cartId, name: item.name, quantity: item.quantity, price: item.price,
      upsellSourceId: item.upsellSourceId ?? "", observation: item.observation ?? "",
      addons: (item.selectedAddons ?? []).map((addon) => [addon.id, addon.name, addon.price]),
    })));
    if (signature(current) !== reconciliation.originalSignature) {
      setCatalogNotice("Seu carrinho mudou. Confira os itens antes de atualizar.");
      return;
    }
    replaceItems(reconciliation.next);
    haptic("step");
    setCatalogNotice(reconciliation.removedNames.length
      ? "Pedido atualizado após sua confirmação. Itens indisponíveis ou ofertas sem vínculo foram removidos."
      : "Preços e adicionais atualizados após sua confirmação.");
  };
  const handleFinish = () => {
    if (reconciliation) { setCatalogNotice("Confira e confirme as mudanças do carrinho antes de finalizar."); return; }
    if (catalogSource==="hybrid" && invalidSelections.length){setCatalogNotice(`Revise os adicionais de ${invalidSelections[0].name}: ${invalidSelections[0].hint}. Remova o item e adicione novamente com as opções corretas.`);return;}
    openModal("checkout");
  };

  return (
    <ModalBase title={`Seu carrinho${itemCount ? ` · ${itemCount} item${itemCount === 1 ? "" : "s"}` : ""}`} onClose={closeModal}>
      <div className={styles.body}>
        {catalogNotice && <div className={styles.catalogNotice} role="status">{catalogNotice}<button type="button" aria-label="Fechar aviso" onClick={() => setCatalogNotice("")}>×</button></div>}
        {!catalogLoading && catalogError && <div className={styles.catalogWait} role="status">Não conseguimos conferir o cardápio atualizado agora. Seu carrinho foi mantido intacto; preços e disponibilidade serão conferidos ao finalizar.</div>}
        {reconciliation && <section className={styles.cartReview} role="status" aria-label="Revisar mudanças do carrinho">
          <div><strong>Seu cardápio mudou</strong><p>Encontramos diferenças de preço, adicionais ou disponibilidade. Nada foi removido do seu carrinho: confira antes de atualizar.</p>
            {reconciliation.removedNames.length > 0 && <small>Itens indisponíveis ou quantidade ajustada: {reconciliation.removedNames.slice(0, 4).join(", ")}{reconciliation.removedNames.length > 4 ? " e outros" : ""}.</small>}</div>
          <button type="button" onClick={applyCatalogReview}>Conferi, atualizar meu pedido</button>
        </section>}
        {items.length === 0 ? (
          <div className={styles.empty}><span>🛒</span><strong>Seu carrinho está vazio</strong><p>Escolha seus favoritos e volte aqui para finalizar.</p><button type="button" onClick={closeModal}>Explorar cardápio</button></div>
        ) : <>
          <div className={styles.items}>{items.map((item) => <article className={styles.item} key={item.cartId}>
            <div className={styles.itemMedia}>{item.image ? <CatalogImage src={item.image} alt="" sizes="(max-width: 420px) 64px, 76px" quality={65}/> : <span aria-hidden="true">DFL</span>}</div>
            <div className={styles.itemInfo}><strong>{item.name}</strong>{item.upsellSourceId && <span className={styles.offerBadge}>PREÇO ESPECIAL DO COMBO</span>}{item.selectedAddons?.length > 0 && <small>+ {item.selectedAddons.map((addon) => addon.name).join(", ")}</small>}{item.observation?.trim() && <small>Obs.: {item.observation.trim()}</small>}<b>{money(item.price * item.quantity)}</b>{item.quantity > 1 && <i>{money(item.price)} cada</i>}</div>
            <div className={styles.itemActions}><div className={styles.stepper}><button type="button" aria-label={`Diminuir ${item.name}`} onClick={() => handleDecreaseItem(item.cartId)}>−</button><span>{item.quantity}</span><button type="button" aria-label={`Aumentar ${item.name}`} disabled={item.quantity >= 30} aria-disabled={Boolean(item.upsellSourceId && remainingUpsellUnits(items, item.upsellSourceId, item.id) <= 0)} onClick={() => handleIncreaseItem(item.cartId)}>+</button></div><button className={styles.remove} type="button" aria-label={`Remover ${item.name} do carrinho`} onClick={() => handleRemoveItem(item.cartId)}><Trash2 size={16} aria-hidden="true"/><span>Remover</span></button></div>
          </article>)}</div>

          {!currentUser && !loginIntentAlreadyShown ? <div className={styles.loginCard}><strong>Quer agilizar os próximos pedidos?</strong><p>Entrar com Google é opcional: salva seu histórico e seus dados entre dispositivos. Você também pode continuar como convidado.</p><button type="button" onClick={() => openModal("login", { returnTo: "cart" })}>Entrar com Google</button><button type="button" className={styles.guestContinue} onClick={() => {
            // DFL-R100-FINAL-POLISH: dispensar convite sem bloquear pedido de convidado.
            setLoginIntentAlreadyShown(true);
            try { window.sessionStorage.setItem("dfl_login_intent_shown", "1"); } catch { /* sem armazenamento */ }
          }}>Continuar sem conta</button></div> : currentUser ? <button className={styles.progress} type="button" onClick={() => openModal("rewards")}><div><strong>Seu histórico na casa</strong><span>{orderStats.loading ? "..." : `${orderStats.completed} concluído${orderStats.completed === 1 ? "" : "s"}`}</span></div><small>{orderStats.active > 0 ? `${orderStats.active} pedido${orderStats.active === 1 ? "" : "s"} em andamento. ` : ""}A fidelidade será baseada em pedidos realmente concluídos.</small></button> : null}

          {suggestions.length > 0 && <section className={styles.smartSuggestions} aria-label="Sugestões para o pedido"><div className={styles.smartHead}><strong>Seu pedido, um pouco mais esperto</strong><span>Sugestões baseadas no que já está no carrinho.</span></div><div className={styles.smartList}>{suggestions.map((suggestion) => <button type="button" className={styles.smartCard} key={`${suggestion.kind}-${suggestion.product.id}`} onClick={() => handleSmartSuggestion(suggestion)}><CatalogImage src={suggestion.product.image} alt="" sizes="96px" quality={68} /><span className={styles.smartCopy}><small>{suggestion.eyebrow}</small><b>{suggestion.title}</b><em>{suggestion.description}</em>{suggestion.saving && suggestion.saving > 0 ? <strong>{suggestion.kind==="upsell" ? "Você economiza " : "Economia calculada de "}{money(suggestion.saving)}</strong> : null}</span><span className={styles.smartPrice}>{suggestion.kind==="upsell"&&suggestion.explicitUnitPrice!=null?<><del>{money(suggestion.product.price)}</del>{money(suggestion.explicitUnitPrice)}</>:money(suggestion.product.price)}<i>{suggestion.kind==="upsell"?"Adicionar agora +":"Ver opção ›"}</i></span></button>)}</div></section>}

          {freeDeliveryTarget !== null && <section className={styles.freeDeliveryProgress} data-earned={freeDeliveryMissing <= 0}><div className={styles.freeDeliveryCopy}><span>{freeDeliveryMissing <= 0 ? "META PARA ENTREGA GRÁTIS ALCANÇADA" : "CAMINHO PARA ENTREGA GRÁTIS"}</span><strong>{freeDeliveryMissing <= 0 ? "Você bateu a meta" : `Faltam ${money(freeDeliveryMissing)}`}</strong></div><div className={styles.freeDeliveryTrack}><i style={{ width: `${freeDeliveryProgress}%` }} /></div><small>{freeDeliveryMissing <= 0 ? "Condição sujeita à confirmação do bairro: confira o valor final no checkout." : `Complete o carrinho até ${money(freeDeliveryTarget)}.`}</small></section>}
          {catalogSource === "hybrid" && invalidSelections.length > 0 && <div className={styles.catalogNotice} role="alert">Revise os adicionais de {invalidSelections[0].name}: {invalidSelections[0].hint}. Remova esse item e adicione novamente com as escolhas corretas. Seu carrinho foi preservado.</div>}<CartPromotionInsight />{productSavings > 0 && <div className={styles.savings}><span>Você economizou nos produtos</span><strong>{money(productSavings)}</strong></div>}<div className={styles.summary}><div><span>Subtotal</span><strong>{money(total)}</strong></div><small>Entrega, descontos e forma de pagamento são confirmados na próxima etapa.</small><button className={styles.checkout} type="button" onClick={handleFinish} disabled={Boolean(reconciliation) || (catalogSource === "hybrid" && invalidSelections.length > 0)}>{reconciliation ? "Revise as mudanças acima" : "Continuar para finalizar"}</button><button className={styles.clear} data-armed={clearArmed} type="button" onClick={handleClearCart}>{clearArmed ? "Confirmar esvaziamento · 8 segundos" : "Esvaziar carrinho"}</button>{clearArmed && <button className={styles.cancelClear} type="button" onClick={() => setClearArmed(false)}>Cancelar</button>}</div>
        </>}
      </div>
    </ModalBase>
  );
}

// DFL-R29-CART-PREMIUM

// DFL-R30-CART-SAFETY
// DFL-R32-CART-UNDO
