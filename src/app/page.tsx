"use client";

import { useEffect, useMemo, useState } from "react";
import type { Product } from "@/data/products";
import { useCatalog } from "@/hooks/useCatalog";
import { useCatalogCategories } from "@/hooks/useCatalogCategories";
import { compareCatalogProducts } from "@/lib/catalog";
import { useShopStatus } from "@/hooks/useShopStatus";
import { useUIStore } from "@/store/ui";
import { ActiveOrderBanner } from "@/components/ui/ActiveOrderBanner";
import styles from "./page.module.css";
import { LastOrderCard } from "@/components/home/LastOrderCard";
import { useRouter } from "next/navigation";
import { productHref } from "@/lib/productRoutes";
import Link from "next/link";



function money(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export default function Home() {
  const router = useRouter();
  const openModal = useUIStore((s) => s.openModal);
  const shopStatus = useShopStatus();
  const { products } = useCatalog();
  const { activeCategories: categories } = useCatalogCategories();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("todos");

  const filtered = useMemo(() => {
    const term = normalize(search);
    const visibleCategories = new Set(categories.map((category) => category.id));
    return products.filter((product) => {
      if (product.disponivel === false) return false;
      if (!visibleCategories.has(product.category)) return false;
      const categoryOk = activeCategory === "todos" || product.category === activeCategory;
      const searchOk = !term || normalize(product.name).includes(term) || normalize(product.description || "").includes(term);
      return categoryOk && searchOk;
    });
  }, [activeCategory, categories, products, search]);

  useEffect(() => {
    if (activeCategory !== "todos" && !categories.some((category) => category.id === activeCategory)) setActiveCategory("todos");
  }, [activeCategory, categories]);

  const promoProducts = useMemo(
    () => products
      .filter((product) => product.disponivel !== false && typeof product.oldPrice === "number" && product.oldPrice > product.price && (product.promoPlacement === "home_showcase" || (product.promoPlacement == null && product.isSuggestion === true)))
      .sort((a, b) => (((b.oldPrice! - b.price) / b.oldPrice!) * 100) - (((a.oldPrice! - a.price) / a.oldPrice!) * 100))
      .slice(0, 6),
    [products],
  );

  const openProduct = (product: Product) => {
    if (product.disponivel === false) return;
    openModal("product-details", product);
  };

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>DA FAMÍLIA LANCHES</p>
          <h1>O que vai matar sua fome hoje?</h1>
          <p className={styles.heroText}>Encontre rápido, personalize do seu jeito e acompanhe o pedido por aqui.</p>

          <label className={styles.searchBox}>
            <span aria-hidden="true">⌕</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar lanche, combo ou bebida" aria-label="Buscar no cardápio" />
            {search && <button type="button" onClick={() => setSearch("")} aria-label="Limpar busca">×</button>}
          </label>
        </div>
      </section>

      <div className={styles.categoryRailWrap}>
        <nav className={styles.categoryRail} aria-label="Categorias do cardápio">
          <button type="button" className={activeCategory === "todos" ? styles.categoryActive : styles.category} onClick={() => setActiveCategory("todos")}>Todos</button>
          {categories.map((category) => (
            <button type="button" key={category.id} className={activeCategory === category.id ? styles.categoryActive : styles.category} onClick={() => setActiveCategory(category.id)}>{category.label}</button>
          ))}
        </nav>
      </div>

      <main className={styles.content}>
        <div className={styles.orderSlot}>
          <ActiveOrderBanner />
          <LastOrderCard />
        </div>
        {activeCategory === "todos" && !search.trim() && promoProducts.length > 0 && (
          <section className={styles.promoShowcase}>
            <div className={styles.promoShowcaseHead}>
              <div><span>OFERTAS DA FAMÍLIA</span><h2>Preço bom pra pedir agora</h2><p>Promoções ativas no cardápio, sem precisar de cupom.</p></div>
              <b>{promoProducts.length} oferta{promoProducts.length === 1 ? "" : "s"}</b>
            </div>
            <div className={styles.promoRail}>
              {promoProducts.map((product) => {
                const discount = Math.round(((product.oldPrice! - product.price) / product.oldPrice!) * 100);
                return <Link className={styles.promoHeroCard} key={`promo-${product.id}`} href={productHref(product)}>
                  <div className={styles.promoHeroMedia}><img src={product.image} alt="" loading="lazy" /><span>-{discount}%</span></div>
                  <div className={styles.promoHeroCopy}><small>OFERTA ATIVA</small><strong>{product.name}</strong><div><s>{money(product.oldPrice!)}</s><b>{money(product.price)}</b></div><em>Economize {money(product.oldPrice! - product.price)}</em></div>
                </Link>;
              })}
            </div>
          </section>
        )}

        {!shopStatus.isOpen && (
          <div className={styles.closedNotice}>
            <strong>{shopStatus.message || "A loja está fechada agora."}</strong>
            <span>Você ainda pode explorar o cardápio e montar seu pedido para agendamento.</span>
          </div>
        )}

        {categories.map((category) => {
          if (activeCategory !== "todos" && activeCategory !== category.id) return null;
          const categoryProducts = filtered.filter((product) => product.category === category.id).sort(compareCatalogProducts);
          if (!categoryProducts.length) return null;

          return (
            <section className={styles.section} key={category.id} id={category.id}>
              <div className={styles.sectionHeader}>
                <div><span className={styles.sectionKicker}>{category.id === "promocoes" ? "OFERTAS DO CARDÁPIO" : "ESCOLHA O SEU"}</span><h2>{category.label}</h2></div>
                <span className={styles.count}>{categoryProducts.length} itens</span>
              </div>
              <div className={styles.grid}>
                {categoryProducts.map((product) => {
                  const available = product.disponivel !== false;
                  const hasDiscount = typeof product.oldPrice === "number" && product.oldPrice > product.price;
                  const discount = hasDiscount ? Math.round(((product.oldPrice! - product.price) / product.oldPrice!) * 100) : 0;
                  return (
                    <article className={`${styles.card} ${!available ? styles.unavailable : ""}`} key={product.id} onClick={() => available && router.push(productHref(product))}>
                      <div className={styles.media}>
                        <img src={product.image} alt={product.name} loading="lazy" />
                        <div className={styles.badges}>
                          {product.isSuggestion && available && <span className={styles.featured}>Sugestão da casa</span>}
                          {hasDiscount && available && <span className={styles.discount}>-{discount}%</span>}
                        </div>
                        {!available && <span className={styles.soldOut}>Indisponível</span>}
                      </div>
                      <div className={styles.cardBody}>
                        <h3>{product.name}</h3>
                        <p className={styles.cardDescription}>{product.description}</p>
                        {(product.bundleItems?.length || product.detailsItems?.length) && available && <Link href={productHref(product)} onClick={(event) => event.stopPropagation()} className={styles.detailsLink}>Ver página completa <b>›</b></Link>}
                        <div className={styles.cardFooter}>
                          <div className={styles.priceBlock}>
                            {hasDiscount && <span className={styles.oldPrice}>{money(product.oldPrice!)}</span>}
                            <strong>{money(product.price)}</strong>
                          </div>
                          <button type="button" className={styles.addButton} disabled={!available} onClick={(event) => { event.stopPropagation(); openProduct(product); }} aria-label={available ? `Ver opções de ${product.name}` : `${product.name} indisponível`}>
                            {available ? "+" : "—"}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}

        {filtered.length === 0 && (
          <div className={styles.empty}>
            <strong>Nenhum item encontrado.</strong>
            <span>Tente outro nome ou volte ao cardápio completo.</span>
            <button type="button" onClick={() => { setSearch(""); setActiveCategory("todos"); }}>Ver cardápio completo</button>
          </div>
        )}
      </main>
    </div>
  );
}
