"use client";

import { useMemo, useState } from "react";
import type { Addon } from "@/data/addons";
import type { Product } from "@/data/products";
import { useCatalog } from "@/hooks/useCatalog";
import { availableAddonsForProduct } from "@/lib/catalog";
import { useAuthStore } from "@/store/auth.store";
import { useCartStore } from "@/store/cart.store";
import { useUIStore } from "@/store/ui";
import { ModalBase } from "./ModalBase";
import styles from "./ProductDetailsModal.module.css";
import { haptic } from "@/lib/haptics";

function money(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ProductDetailsModal() {
  const closeModal = useUIStore((s) => s.closeModal);
  const openModal = useUIStore((s) => s.openModal);
  const showCartToast = useUIStore((s) => s.showCartToast);
  const modalData = useUIStore((s) => s.modalData);
  const currentUser = useAuthStore((s) => s.currentUser);
  const authLoading = useAuthStore((s) => s.loading);
  const addItem = useCartStore((s) => s.addItem);
  const { addons } = useCatalog();
  const [quantity, setQuantity] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState<Addon[]>([]);
  const [observation, setObservation] = useState("");
  const product = modalData as Product | null;

  const addonsTotal = useMemo(() => selectedAddons.reduce((sum, addon) => sum + addon.price, 0), [selectedAddons]);
  if (!product) return null;

  const total = (product.price + addonsTotal) * quantity;
  const hasDiscount = typeof product.oldPrice === "number" && product.oldPrice > product.price;
  const savings = hasDiscount ? product.oldPrice! - product.price : 0;
  const productAddons = availableAddonsForProduct(product, addons);
  const allowAddons = productAddons.length > 0;

  const toggleAddon = (addon: Addon) => {
    setSelectedAddons((current) => current.some((item) => item.id === addon.id) ? current.filter((item) => item.id !== addon.id) : [...current, addon]);
  };

  const handleAdd = () => {
    addItem(product, quantity, selectedAddons, observation.trim());
    haptic("add");
    showCartToast({ title: `${product.name} adicionado`, message: quantity > 1 ? `${quantity} unidades entraram no carrinho.` : "Seu carrinho foi atualizado.", kind: "add", actionLabel: "Ver carrinho", onAction: () => openModal("cart") });
    const alreadyPrompted = typeof window !== "undefined" && window.sessionStorage.getItem("dfl_login_intent_shown") === "1";
    if (!authLoading && !currentUser && !alreadyPrompted) {
      window.sessionStorage.setItem("dfl_login_intent_shown", "1");
      openModal("login-prompt");
      return;
    }
    closeModal();
  };

  return (
    <ModalBase title="Personalizar pedido" onClose={closeModal}>
      <div className={styles.wrap}>
        <div className={styles.product}>
          <img src={product.image} alt={product.name} />
          <div><span className={styles.kicker}>{product.isSuggestion ? "SUGESTÃO DA CASA" : "PERSONALIZE"}</span><h3>{product.name}</h3><p>{product.description}</p><div className={styles.productPrice}>{hasDiscount && <span>{money(product.oldPrice!)}</span>}<strong>{money(product.price)}</strong>{hasDiscount && <small className={styles.savings}>Economize {money(savings)}</small>}</div></div>
        </div>

        {(product.detailsItems?.length || product.includedExtras) && <section className={styles.composition}><div className={styles.compositionHead}><span>POR DENTRO DO PEDIDO</span><strong>{product.detailsTitle || `O que vem no ${product.name}?`}</strong></div>{product.detailsItems?.length ? <div className={styles.detailChips}>{product.detailsItems.map((item) => <span key={item}>{item}</span>)}</div> : null}{product.includedExtras && <p><b>Acompanha:</b> {product.includedExtras}</p>}</section>}

        {allowAddons && (
          <section className={styles.section}>
            <div className={styles.sectionTitle}><div><strong>Quer incrementar?</strong><span>Adicionais opcionais · escolha quantos quiser</span></div>{selectedAddons.length > 0 && <b>{selectedAddons.length}</b>}</div>
            <div className={styles.addons}>
              {productAddons.map((addon) => {
                const selected = selectedAddons.some((item) => item.id === addon.id);
                return <button type="button" key={addon.id} className={selected ? styles.addonSelected : styles.addon} onClick={() => toggleAddon(addon)}><span className={styles.check}>{selected ? "✓" : "+"}</span><span className={styles.addonName}>{addon.name}</span><strong>+ {money(addon.price)}</strong></button>;
              })}
            </div>
          </section>
        )}

        <section className={styles.section}>
          <label className={styles.observation}>
            <strong>Observação</strong><span>Ex.: sem cebola, molho separado...</span>
            <textarea value={observation} onChange={(event) => setObservation(event.target.value)} maxLength={180} placeholder="Algum detalhe para a cozinha?" />
            <small>{observation.length}/180</small>
          </label>
        </section>

        <div className={styles.bottom}>
          <div className={styles.quantity}><button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>−</button><span>{quantity}</span><button type="button" onClick={() => setQuantity((q) => q + 1)}>+</button></div>
          <button type="button" className={styles.confirm} onClick={handleAdd}><span>Adicionar</span><strong>{money(total)}</strong></button>
        </div>
      </div>
    </ModalBase>
  );
}
