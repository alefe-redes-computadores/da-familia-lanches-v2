"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Product } from "@/data/products";
import { useCatalog } from "@/hooks/useCatalog";
import { resolveBundleItems } from "@/lib/catalogComposition";
import { matchesProductRoute, productHref, PUBLIC_SECTION_LABELS, productPublicSection } from "@/lib/productRoutes";
import { useUIStore } from "@/store/ui";
import { useCartStore } from "@/store/cart.store";
import styles from "./ProductPublicPage.module.css";

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const CartIcon = () => <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="20" r="1"/><circle cx="19" cy="20" r="1"/><path d="M3 4h2l2.4 10.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 7H6"/></svg>;
import { getCommercialRecommendations } from "@/lib/commercialRecommendations";

export function ProductPublicPage({ section, slug }: { section: string; slug: string }) {
  const { products, loading } = useCatalog();
  const openModal = useUIStore((state) => state.openModal);
  const cartItems = useCartStore((state) => state.items);
  const [copied, setCopied] = useState(false);
  const product = useMemo(() => products.find((item) => matchesProductRoute(item, section, slug)), [products, section, slug]);
  const bundle = useMemo(() => product ? resolveBundleItems(product, products) : [], [product, products]);
  const related = useMemo(() => product ? getCommercialRecommendations(product, products, cartItems) : [], [product, products, cartItems]);

  if (loading) return <main className={styles.state}><strong>Abrindo o cardápio...</strong></main>;
  if (!product) return <main className={styles.state}><span>ITEM NÃO ENCONTRADO</span><h1>Esse endereço não está mais disponível.</h1><p>O produto pode ter mudado de endereço ou saído do cardápio.</p><Link href="/">Ver cardápio completo</Link></main>;

  const available = product.disponivel !== false;
  const inCart = cartItems.filter((item) => item.id === product.id).reduce((sum, item) => sum + item.quantity, 0);
  const hasDiscount = typeof product.oldPrice === "number" && product.oldPrice > product.price;
  const sectionLabel = PUBLIC_SECTION_LABELS[productPublicSection(product)] || product.category;
  const hasComposition = bundle.length > 0 || Boolean(product.detailsItems?.length) || Boolean(product.includedExtras);
  const share = async () => {
    const data = { title: `${product.name} | Da Família Lanches`, text: product.description, url: window.location.href };
    if (navigator.share) await navigator.share(data).catch(() => undefined);
    else { await navigator.clipboard.writeText(window.location.href); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
  };

  return <main className={styles.page}>
    <nav className={styles.breadcrumb} aria-label="Navegação"><Link href="/"><span aria-hidden="true">←</span> Cardápio</Link><span>•</span><strong>{sectionLabel}</strong></nav>
    <section className={styles.hero}>
      <div className={styles.media}><img src={product.image} alt={product.name} />{hasDiscount && <b>-{Math.round(((product.oldPrice! - product.price) / product.oldPrice!) * 100)}%</b>}{!available && <span>INDISPONÍVEL</span>}</div>
      <div className={styles.summary}>
        <span className={styles.kicker}>{sectionLabel}</span><h1>{product.name}</h1><p>{product.description}</p>
        {hasComposition && <section className={styles.composition}>
          <div className={styles.compositionHead}><span>{bundle.length ? "POR DENTRO DO COMBO" : "INGREDIENTES"}</span><h2>{product.detailsTitle || (bundle.length ? "O que vem nesta promoção?" : "Feito com")}</h2></div>
          {bundle.length ? <div className={styles.bundle}>{bundle.map((item) => <article key={item.key}><div><b>{item.quantity}×</b><strong>{item.product?.name || item.label}</strong>{item.note && <small>{item.note}</small>}</div>{item.product?.detailsItems?.length ? <ul>{item.product.detailsItems.map((detail) => <li key={detail}>{detail}</li>)}</ul> : null}</article>)}</div> : <ul className={styles.ingredients}>{product.detailsItems?.map((item) => <li key={item}>{item}</li>)}</ul>}
          {product.includedExtras && <p className={styles.included}><b>Acompanha:</b> {product.includedExtras}</p>}
        </section>}
        <div className={styles.buyRow}><div className={styles.price}>{hasDiscount && <s>{money(product.oldPrice!)}</s>}<strong>{money(product.price)}</strong>{hasDiscount && <small>Economize {money(product.oldPrice! - product.price)}</small>}</div><button className={styles.share} onClick={share} aria-label="Compartilhar produto"><span aria-hidden="true">↗</span><span>{copied ? "Copiado" : "Compartilhar"}</span></button></div>
        <button className={styles.primaryAction} disabled={!available} onClick={() => openModal("product-details", product)}><CartIcon /><span>{available ? "Personalizar e adicionar" : "Indisponível no momento"}</span><b>{available ? money(product.price) : ""}</b></button>
        {inCart > 0 && <button className={styles.inCart} onClick={() => openModal("cart")}><span>{inCart} no carrinho</span><b>Ver pedido <span aria-hidden="true">›</span></b></button>}
      </div>
    </section>
    {related.length > 0 && <section className={styles.related}><div className={styles.relatedHead}><div><span>ESCOLHAS PARA O SEU PEDIDO</span><h2>Complete do seu jeito</h2><p>Sem repetir o que já vem neste item ou no seu carrinho.</p></div></div><div className={styles.relatedGrid}>{related.map((entry) => <Link href={productHref(entry.product)} key={entry.product.id}><img src={entry.product.image} alt="" /><span><small>{entry.eyebrow}</small><strong>{entry.product.name}</strong><em>{entry.reason}</em><b>{money(entry.product.price)} <span aria-hidden="true">›</span></b></span></Link>)}</div></section>}
    <div className={styles.mobileAction}><button disabled={!available} onClick={() => openModal("product-details", product)}><CartIcon /><span>{available ? "Adicionar ao carrinho" : "Indisponível"}</span>{available && <b>{money(product.price)}</b>}</button></div>
  </main>;
}
