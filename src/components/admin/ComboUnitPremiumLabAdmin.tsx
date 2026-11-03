"use client";
/**
 * DFL SITE R247 — painel de HOMOLOGACAO VISUAL dentro do Admin.
 * Nunca montar na loja pública; nenhuma gravação, pedido, impressão ou cobrança.
 */
import { useEffect, useRef } from "react";
import type { Product } from "@/data/products";
import type { Addon } from "@/data/addons";
import { ComboUnitBatchConfiguratorDraft } from "@/components/ui/ComboUnitBatchConfiguratorDraft";
import styles from "./ComboUnitPremiumLabAdmin.module.css";

type Props = Readonly<{
  comboId: string;
  products: readonly Product[];
  addons: readonly Addon[];
  onClose: () => void;
}>;
const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export function ComboUnitPremiumLabAdmin({ comboId, products, addons, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const product = products.find(item => item.id === comboId && item.bundleItems?.length);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusables = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]',
      ));
      if (!focusables.length) return;
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); previous?.focus(); };
  }, [onClose]);

  return <div className={styles.backdrop} onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="dfl-r247-title" data-dfl-combo-lab="admin-only">
      <header className={styles.topbar}>
        <div className={styles.brand} aria-hidden="true"><span>✦</span></div>
        <div className={styles.heading}>
          <span className={styles.eyebrow}>DFL LAB <i/> PRÉVIA ADMINISTRATIVA</span>
          <h2 id="dfl-r247-title">Personalização de combos</h2>
        </div>
        <button ref={closeRef} className={styles.close} type="button" onClick={onClose} aria-label="Fechar laboratório de combos">×</button>
      </header>
      <div className={styles.scroll}>
        <div className={styles.banner} role="status">
          <span className={styles.dot} aria-hidden="true"/>
          <div><strong>Modo de demonstração seguro</strong><p>Experimente a personalização e a conferência de cozinha. Não altera carrinho, pedidos, preços oficiais ou impressão.</p></div>
        </div>
        {product ? <>
          <div className={styles.product}>
            <div className={styles.productCopy}><small>COMBO SELECIONADO</small><strong>{product.name}</strong><span>{product.bundleItems?.map(item => `${item.quantity}× ${products.find(p => p.id === item.productId)?.name ?? item.productId}`).join(" · ")}</span></div>
            <div className={styles.productPrice}><small>Preço cadastrado</small><b>{brl(product.price)}</b><span>Base da prévia, não autorização</span></div>
          </div>
          <ComboUnitBatchConfiguratorDraft key={comboId} comboId={comboId} products={products} addons={addons} initialQuantity={2}/>
        </> : <div className={styles.unavailable} role="alert">Combo não encontrado ou sem componentes cadastrados. Salve a composição primeiro e abra novamente a prévia.</div>}
        <p className={styles.disclaimer}>DFL SITE R247 · Ferramenta de homologação administrativa. Não enviar este conteúdo à cozinha e não utilizar os preços para cobrar clientes.</p>
      </div>
    </section>
  </div>;
}
