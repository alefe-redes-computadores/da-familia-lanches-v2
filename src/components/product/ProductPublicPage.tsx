"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useCatalog } from "@/hooks/useCatalog";
import { resolveBundleItems } from "@/lib/catalogComposition";
import { matchesProductRoute, productHref, PUBLIC_SECTION_LABELS, productPublicSection } from "@/lib/productRoutes";
import { useUIStore } from "@/store/ui";
import { useCartStore } from "@/store/cart.store";
import styles from "./ProductPublicPage.module.css";

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function ProductPublicPage({ section, slug }: { section: string; slug: string }) {
  const { products, loading } = useCatalog();
  const openModal = useUIStore((state) => state.openModal);
  const cartItems = useCartStore((state) => state.items);
  const [copied, setCopied] = useState(false);
  const product = useMemo(() => products.find((item) => matchesProductRoute(item, section, slug)), [products, section, slug]);
  const related = useMemo(() => product ? products.filter((item) => item.id !== product.id && item.disponivel !== false && item.category === product.category).slice(0, 4) : [], [product, products]);
  const bundle = useMemo(() => product ? resolveBundleItems(product, products) : [], [product, products]);

  if (loading) return <main className={styles.state}><strong>Abrindo o cardápio...</strong></main>;
  if (!product) return <main className={styles.state}><span>ITEM NÃO ENCONTRADO</span><h1>Esse endereço não está mais disponível.</h1><p>O produto pode ter mudado de endereço ou saído do cardápio.</p><Link href="/">Ver cardápio completo</Link></main>;

  const available = product.disponivel !== false;
  const inCart = cartItems.filter((item) => item.id === product.id).reduce((sum, item) => sum + item.quantity, 0);
  const hasDiscount = typeof product.oldPrice === "number" && product.oldPrice > product.price;
  const share = async () => {
    const data = { title: `${product.name} | Da Família Lanches`, text: product.description, url: window.location.href };
    if (navigator.share) await navigator.share(data).catch(() => undefined);
    else { await navigator.clipboard.writeText(window.location.href); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
  };

  return <main className={styles.page}>
    <nav className={styles.breadcrumb}><Link href="/">Cardápio</Link><span>›</span><strong>{PUBLIC_SECTION_LABELS[productPublicSection(product)] || product.category}</strong></nav>
    <section className={styles.hero}>
      <div className={styles.media}><img src={product.image} alt={product.name} />{hasDiscount && <b>-{Math.round(((product.oldPrice! - product.price) / product.oldPrice!) * 100)}%</b>}{!available && <span>INDISPONÍVEL</span>}</div>
      <div className={styles.summary}><span className={styles.kicker}>{PUBLIC_SECTION_LABELS[productPublicSection(product)] || "Da Família Lanches"}</span><h1>{product.name}</h1><p>{product.description}</p><div className={styles.price}>{hasDiscount && <s>{money(product.oldPrice!)}</s>}<strong>{money(product.price)}</strong>{hasDiscount && <small>Você economiza {money(product.oldPrice! - product.price)}</small>}</div><div className={styles.actions}><button disabled={!available} onClick={() => openModal("product-details", product)}>{available ? "Personalizar e adicionar" : "Indisponível no momento"}</button><button className={styles.share} onClick={share}>{copied ? "Link copiado" : "Compartilhar"}</button></div></div>
    </section>

    {(bundle.length > 0 || product.detailsItems?.length || product.includedExtras) && <section className={styles.composition}><span>{bundle.length ? "POR DENTRO DO COMBO" : "CONHEÇA SEU PEDIDO"}</span><h2>{product.detailsTitle || `O que vem no ${product.name}?`}</h2>{bundle.length ? <div className={styles.bundle}>{bundle.map((item) => <article key={item.key}><div><b>{item.quantity}×</b><strong>{item.product?.name || item.label}</strong>{item.note && <small>{item.note}</small>}</div>{item.product?.detailsItems?.length ? <ul>{item.product.detailsItems.map((detail) => <li key={detail}>{detail}</li>)}</ul> : null}</article>)}</div> : <ul className={styles.ingredients}>{product.detailsItems?.map((item) => <li key={item}>{item}</li>)}</ul>}{product.includedExtras && <p className={styles.included}><b>Acompanha:</b> {product.includedExtras}</p>}</section>}

    {related.length > 0 && <section className={styles.related}><div><span>CONTINUE ESCOLHENDO</span><h2>Talvez combine com seu pedido</h2></div><div className={styles.relatedGrid}>{related.map((item) => <Link href={productHref(item)} key={item.id}><img src={item.image} alt="" /><span><strong>{item.name}</strong><small>{money(item.price)}</small></span></Link>)}</div></section>}
    <div className={styles.mobileAction}><button disabled={!available} onClick={() => openModal("product-details", product)}>{available ? <><span aria-hidden="true">🛒</span><span>Adicionar <small>{money(product.price)}{inCart > 0 ? ` · ${inCart} no carrinho` : ""}</small></span></> : "Indisponível"}</button></div>
  </main>;
}
