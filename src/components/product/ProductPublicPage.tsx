"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CatalogImage } from "@/components/ui/CatalogImage";
import { ArrowLeft, ChevronRight, Copy, MessageCircle, Share2, ShoppingCart } from "lucide-react";
import type { Product } from "@/data/products";
import { useCatalog } from "@/hooks/useCatalog";
import { resolveBundleItems } from "@/lib/catalogComposition";
import { matchesProductRoute, productHref, PUBLIC_SECTION_LABELS, productPublicSection } from "@/lib/productRoutes";
import { useUIStore } from "@/store/ui";
import { useCartStore } from "@/store/cart.store";
import styles from "./ProductPublicPage.module.css";

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
import { getCommercialRecommendations } from "@/lib/commercialRecommendations";
import { haptic } from "@/lib/haptics";
import { productLeadDescription } from "@/lib/productPresentation";

export function ProductPublicPage({ section, slug }: { section: string; slug: string }) {
  const { products, loading } = useCatalog();
  const openModal = useUIStore((state) => state.openModal);
  const cartItems = useCartStore((state) => state.items);
  const [copied, setCopied] = useState(false);
  const [shareFallback, setShareFallback] = useState(false);
  const [shareError, setShareError] = useState(false);
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
  const leadDescription = productLeadDescription(product);
  // URL canonica, independente de PWA, dominio alternativo ou parametros de navegacao.
  const shareUrl = `https://dafamilialanches.com.br${productHref(product)}`;
  const shareText = `Olha esse lanche da Da Família Lanches: ${product.name}`;
  const share = async () => {
    haptic("step");
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: `${product.name} | Da Família Lanches`, text: shareText, url: shareUrl });
        return;
      } catch (error) {
        // Cancelar a folha nativa nao e falha; outras falhas recebem alternativas.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    setShareFallback((current) => !current);
  };
  const copyLink = async () => {
    setShareError(false);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("CLIPBOARD_UNAVAILABLE");
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setShareFallback(false);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setShareError(true); // exibe campo selecionavel, sem dialogo nativo intrusivo.
    }
  };

  return <main className={styles.page}>
    <nav className={styles.breadcrumb} aria-label="Navegação"><Link href="/"><ArrowLeft size={16} /> Cardápio</Link><span>•</span><strong>{sectionLabel}</strong></nav>
    <section className={styles.hero}>
      <div className={styles.media}><CatalogImage src={product.image} alt={product.name} sizes="(max-width: 760px) calc(100vw - 20px), (max-width: 1080px) 48vw, 520px" priority quality={76} style={{ objectFit: "contain" }} />{hasDiscount && <b>-{Math.round(((product.oldPrice! - product.price) / product.oldPrice!) * 100)}%</b>}{!available && <span>INDISPONÍVEL</span>}</div>
      <div className={styles.summary}>
        <span className={styles.kicker}>{sectionLabel}</span><h1>{product.name}</h1>{leadDescription && <p>{leadDescription}</p>}
        <div className={styles.buyRow}><div className={styles.price}>{hasDiscount && <s>{money(product.oldPrice!)}</s>}<strong>{money(product.price)}</strong>{hasDiscount && <small>Economize {money(product.oldPrice! - product.price)}</small>}</div><button type="button" className={styles.share} onClick={share} aria-label="Compartilhar produto"><Share2 size={17} /><span>{copied ? "Link copiado" : "Compartilhar"}</span></button></div>
        {shareFallback && <div className={styles.shareFallback} aria-label="Outras formas de compartilhar">
          <button type="button" onClick={copyLink}><Copy size={16} /> Copiar link</button>
          <a href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} /> WhatsApp</a>
          {shareError && <input aria-label="Selecione e copie o link do produto" readOnly value={shareUrl} onFocus={(event) => event.currentTarget.select()} onClick={(event) => event.currentTarget.select()} />}
        </div>}
        <button className={styles.primaryAction} disabled={!available} onClick={() => { haptic("step"); openModal("product-details", product); }}><ShoppingCart size={20} strokeWidth={2} /><span>{available ? "Personalizar e adicionar" : "Indisponível no momento"}</span><b>{available ? money(product.price) : ""}</b></button>
        {inCart > 0 && <button className={styles.inCart} onClick={() => openModal("cart")}><span>{inCart} no carrinho</span><b>Ver pedido <ChevronRight size={15} /></b></button>}
        {hasComposition && <section className={styles.composition}>
          <div className={styles.compositionHead}><span>{bundle.length ? "POR DENTRO DO COMBO" : "INGREDIENTES"}</span><h2>{product.detailsTitle || `O que vem no ${product.name}?`}</h2></div>
          {bundle.length ? <div className={styles.bundle}>{bundle.map((item) => <article key={item.key}><div><b>{item.quantity}×</b><strong>{item.product?.name || item.label}</strong>{item.note && <small>{item.note}</small>}</div>{item.product?.detailsItems?.length ? <ul>{item.product.detailsItems.map((detail) => <li key={detail}>{detail}</li>)}</ul> : null}</article>)}</div> : <ul className={styles.ingredients}>{product.detailsItems?.map((item) => <li key={item}>{item}</li>)}</ul>}
          {product.includedExtras && <p className={styles.included}><b>Acompanha:</b> {product.includedExtras}</p>}
        </section>}
      </div>
    </section>
    {related.length > 0 && <section className={styles.related}><div className={styles.relatedHead}><div><span>ESCOLHAS PARA O SEU PEDIDO</span><h2>Complete do seu jeito</h2><p>Sem repetir o que já vem neste item ou no seu carrinho.</p></div></div><div className={styles.relatedGrid}>{related.map((entry) => <Link href={productHref(entry.product)} key={entry.product.id}><CatalogImage src={entry.product.image} alt="" sizes="(max-width: 700px) 38vw, 180px" quality={68} /><span><small>{entry.eyebrow}</small><strong>{entry.product.name}</strong><em>{entry.reason}</em><b>{money(entry.product.price)} <span aria-hidden="true">›</span></b></span></Link>)}</div></section>}

  </main>;
}
