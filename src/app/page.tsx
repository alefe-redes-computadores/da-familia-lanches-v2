"use client";

import { useMemo, useState } from "react";
import { products, type Product } from "@/data/products";
import { useShopStatus } from "@/hooks/useShopStatus";
import { useUIStore } from "@/store/ui";
import styles from "./page.module.css";

const categories = [
  { id: "promocoes", label: "Promoções" },
  { id: "combos", label: "Combos" },
  { id: "tradicionais", label: "Tradicionais" },
  { id: "artesanais", label: "Artesanais" },
  { id: "hotdogs", label: "Hot Dogs" },
  { id: "bebidas", label: "Bebidas" },
] as const;

function money(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export default function Home() {
  const openModal = useUIStore((s) => s.openModal);
  const shopStatus = useShopStatus();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("todos");

  const filtered = useMemo(() => {
    const term = normalize(search);
    return products.filter((product) => {
      const categoryOk = activeCategory === "todos" || product.category === activeCategory;
      const searchOk = !term || normalize(product.name).includes(term) || normalize(product.description || "").includes(term);
      return categoryOk && searchOk;
    });
  }, [activeCategory, search]);

  const openProduct = (product: Product) => {
    if (product.disponivel === false) return;
    openModal("product-details", product);
  };

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.heroInner}>
          <div className={styles.statusRow}>
            <span className={`${styles.statusDot} ${shopStatus.isOpen ? styles.open : styles.closed}`} />
            <span>{shopStatus.isOpen ? "Aberto agora" : "Fechado agora"}</span>
          </div>
          <p className={styles.eyebrow}>DA FAMÍLIA LANCHES</p>
          <h1>Seu lanche favorito, sem enrolação.</h1>
          <p className={styles.heroText}>Escolha, personalize e finalize seu pedido. O cardápio ficou mais rápido para achar o que você quer.</p>

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
        {!shopStatus.isOpen && (
          <div className={styles.closedNotice}>
            <strong>A loja está fechada agora.</strong>
            <span>Você ainda pode explorar o cardápio e montar seu pedido para agendamento.</span>
          </div>
        )}

        {categories.map((category) => {
          if (activeCategory !== "todos" && activeCategory !== category.id) return null;
          const categoryProducts = filtered.filter((product) => product.category === category.id).sort((a, b) => {
            if (a.disponivel !== b.disponivel) return a.disponivel ? -1 : 1;
            if (!!a.isSuggestion !== !!b.isSuggestion) return a.isSuggestion ? -1 : 1;
            return a.price - b.price;
          });
          if (!categoryProducts.length) return null;

          return (
            <section className={styles.section} key={category.id} id={category.id}>
              <div className={styles.sectionHeader}>
                <div><span className={styles.sectionKicker}>CARDÁPIO</span><h2>{category.label}</h2></div>
                <span className={styles.count}>{categoryProducts.length} itens</span>
              </div>
              <div className={styles.grid}>
                {categoryProducts.map((product) => {
                  const available = product.disponivel !== false;
                  const hasDiscount = typeof product.oldPrice === "number" && product.oldPrice > product.price;
                  const discount = hasDiscount ? Math.round(((product.oldPrice! - product.price) / product.oldPrice!) * 100) : 0;
                  return (
                    <article className={`${styles.card} ${!available ? styles.unavailable : ""}`} key={product.id} onClick={() => openProduct(product)}>
                      <div className={styles.media}>
                        <img src={product.image} alt={product.name} loading="lazy" />
                        <div className={styles.badges}>
                          {product.isSuggestion && available && <span className={styles.featured}>Destaque</span>}
                          {hasDiscount && available && <span className={styles.discount}>-{discount}%</span>}
                        </div>
                        {!available && <span className={styles.soldOut}>Esgotado</span>}
                      </div>
                      <div className={styles.cardBody}>
                        <h3>{product.name}</h3>
                        <p>{product.description}</p>
                        <div className={styles.cardFooter}>
                          <div className={styles.priceBlock}>
                            {hasDiscount && <span className={styles.oldPrice}>{money(product.oldPrice!)}</span>}
                            <strong>{money(product.price)}</strong>
                          </div>
                          <button type="button" className={styles.addButton} disabled={!available} onClick={(event) => { event.stopPropagation(); openProduct(product); }} aria-label={available ? `Adicionar ${product.name}` : `${product.name} esgotado`}>
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
            <span>Tente outro nome ou volte para “Todos”.</span>
            <button type="button" onClick={() => { setSearch(""); setActiveCategory("todos"); }}>Limpar filtros</button>
          </div>
        )}
      </main>
    </div>
  );
}
