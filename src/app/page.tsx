"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { readGuestIdentity, readGuestOrders, type GuestIdentity, type GuestOrderMemory } from "@/lib/guestContinuity";
import { CatalogImage } from "@/components/ui/CatalogImage";
import { VisualCampaignBanner } from "@/components/layout/VisualCampaignBanner";
import { campaignMatchesCatalogOffer, useVisualCampaign } from "@/components/layout/VisualCampaignProvider";
import type { Product } from "@/data/products";
import { useCatalog } from "@/hooks/useCatalog";
import { useCatalogCategories } from "@/hooks/useCatalogCategories";
import { compareCatalogProducts } from "@/lib/catalog";
import { useShopStatus } from "@/hooks/useShopStatus";
import { useUIStore } from "@/store/ui";
import { useAuthStore } from "@/store/auth.store";
import { ActiveOrderBanner } from "@/components/ui/ActiveOrderBanner";
import styles from "./page.module.css";
import { LastOrderCard } from "@/components/home/LastOrderCard";
import { CustomerExperiencePrompt } from "@/components/home/CustomerExperiencePrompt";
import { CATALOG_SEARCH_EVENT, rankCatalogProducts } from "@/lib/catalogSearch";
import { suggestCatalogQueries } from "@/lib/catalogSearchRecovery";
import { readRecentProductIds, rememberRecentProductId } from "@/lib/recentProductViews";
import { clearSavedProductIds, readSavedProductIds } from "@/lib/savedProductIds";



function money(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export default function Home() {
  const campaign = useVisualCampaign();
  const openModal = useUIStore((s) => s.openModal);
  const activeModal = useUIStore((s) => s.activeModal);
  const mobileMenuOpen = useUIStore((s) => s.isMobileMenuOpen);
  const [showAssistShortcut, setShowAssistShortcut] = useState(false);
  const [assistFirstHint, setAssistFirstHint] = useState(false);
  useEffect(() => {
    if (!showAssistShortcut || assistFirstHint) return;
    try {
      if (localStorage.getItem("dfl-assist-first-hint-r103") === "1") return;
      localStorage.setItem("dfl-assist-first-hint-r103", "1");
      setAssistFirstHint(true);
    } catch { /* Sem armazenamento: sem animação promocional. */ }
  }, [showAssistShortcut, assistFirstHint]);
  useEffect(() => {
    if (!assistFirstHint) return;
    const timer = window.setTimeout(() => setAssistFirstHint(false), 1800);
    return () => window.clearTimeout(timer);
  }, [assistFirstHint]);
  const [catalogSearchFocused, setCatalogSearchFocused] = useState(false); // R102: nao obstruir a busca no celular
  useEffect(() => {
    // DFL-R71-ASSIST-SCROLL: scroll passive, sem observar pixels ou consultar Firebase.
    const sync = () => setShowAssistShortcut(window.scrollY > 470);
    sync();
    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => { window.removeEventListener("scroll", sync); window.removeEventListener("resize", sync); };
  }, []);
  const currentUser = useAuthStore((s) => s.currentUser);
  const shopStatus = useShopStatus();
  const { products, loading: catalogLoading, error: catalogError, reload: reloadCatalog } = useCatalog();
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const { activeCategories: categories } = useCatalogCategories();
  const [search, setSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); searchInputRef.current?.focus(); searchInputRef.current?.select();
      } else if (event.key === "Escape" && document.activeElement === searchInputRef.current) {
        setSearch(""); searchInputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);
  const deferredSearch = useDeferredValue(search);
  const [activeCategory, setActiveCategory] = useState<string>("todos");
  const [showAllOffers, setShowAllOffers] = useState(false);
  const [recentProductIds, setRecentProductIds] = useState<string[]>([]);
  const [savedProductIds, setSavedProductIds] = useState<string[]>([]);
  const [clearFavoritesConfirm, setClearFavoritesConfirm] = useState(false);
  useEffect(() => {
    const sync = () => setSavedProductIds(readSavedProductIds());
    sync();
    window.addEventListener("pageshow", sync);
    window.addEventListener("dfl:saved-products-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("pageshow", sync);
      window.removeEventListener("dfl:saved-products-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  useEffect(() => {
    const sync = () => setRecentProductIds(readRecentProductIds());
    sync();
    window.addEventListener("pageshow", sync);
    return () => window.removeEventListener("pageshow", sync);
  }, []);
  const menuCategories = useMemo(() => {
    const availableCategoryIds = new Set(
      products.filter((product) => product.disponivel !== false).map((product) => product.category),
    );
    return categories.filter((category) => availableCategoryIds.has(category.id));
  }, [categories, products]);
  const [guestIdentity, setGuestIdentity] = useState<GuestIdentity | null>(null);
  const [guestLastOrder, setGuestLastOrder] = useState<GuestOrderMemory | null>(null);

  useEffect(() => {
    // Uma busca no Header feita de pagina interna continua na Home.
    try {
      const pending = window.sessionStorage.getItem("dfl:pending-catalog-search");
      if (pending !== null) {
        window.sessionStorage.removeItem("dfl:pending-catalog-search");
        setSearch(pending.slice(0, 100));
        if (pending.trim()) setActiveCategory("todos");
      }
    } catch { /* armazenamento indisponivel */ }
  }, []);
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(CATALOG_SEARCH_EVENT, { detail: search }));
  }, [search]);

  // R30: categorias visiveis indexadas uma unica vez por atualizacao.
  const visibleCategoryIds = useMemo(() => new Set(categories.map((category) => category.id)), [categories]);
  const filtered = useMemo(() => {
    const term = normalize(deferredSearch);
    const visibleCategories = visibleCategoryIds;
    const base = products.filter((product) => {
      if (product.disponivel === false) return false;
      if (!visibleCategories.has(product.category)) return false;
      return activeCategory === "todos" || product.category === activeCategory;
    });
    return term ? rankCatalogProducts(base, term) : base;
  }, [activeCategory, visibleCategoryIds, products, deferredSearch]);

  // R33: alternativas reais somente quando a busca nao retornou produtos.
  const catalogRecovery = useMemo(() => {
    if (catalogLoading || filtered.length || !deferredSearch.trim() || search.trim() !== deferredSearch.trim()) return [];
    const available = products.filter(candidate => candidate.disponivel !== false && visibleCategoryIds.has(candidate.category));
    return suggestCatalogQueries(available, deferredSearch, 4);
  }, [catalogLoading, filtered.length, products, visibleCategoryIds, deferredSearch, search]);

  useEffect(() => {
    const onSearch = (event: Event) => {
      const value = String((event as CustomEvent).detail ?? "");
      setSearch(value);
      if (value.trim()) setActiveCategory("todos");
    };
    window.addEventListener(CATALOG_SEARCH_EVENT, onSearch);
    return () => window.removeEventListener(CATALOG_SEARCH_EVENT, onSearch);
  }, []);
  useEffect(() => {
    if (activeCategory !== "todos" && !menuCategories.some((category) => category.id === activeCategory)) setActiveCategory("todos");
  }, [activeCategory, menuCategories]);
  useEffect(() => {
    const syncGuest=()=>{setGuestIdentity(readGuestIdentity());setGuestLastOrder(readGuestOrders()[0]||null)};
    syncGuest(); window.addEventListener("dfl:guest-continuity",syncGuest);
    return()=>window.removeEventListener("dfl:guest-continuity",syncGuest);
  }, []);
  useEffect(() => {
    const online=()=>setIsOnline(true), offline=()=>setIsOnline(false);
    window.addEventListener("online",online); window.addEventListener("offline",offline);
    return()=>{window.removeEventListener("online",online);window.removeEventListener("offline",offline);};
  }, []);

  const promoProducts = useMemo(
    () => products
      .filter((product) => visibleCategoryIds.has(product.category) && product.disponivel !== false && typeof product.oldPrice === "number" && product.oldPrice > product.price && (product.promoPlacement === "home_showcase" || (product.promoPlacement == null && product.isSuggestion === true)))
      .sort((a, b) => (((b.oldPrice! - b.price) / b.oldPrice!) * 100) - (((a.oldPrice! - a.price) / a.oldPrice!) * 100))
      .slice(0, 6),
    [products, visibleCategoryIds],
  );

  // V87 R1: uma indexação por render, sem filtragens/ordenações repetidas por categoria.
  const groupedProducts = useMemo(() => {
    const excludePromos = activeCategory === "todos" && !search.trim();
    const promoIds = excludePromos ? new Set(promoProducts.map((product) => product.id)) : null;
    const groups = new Map<string, Product[]>();
    for (const product of filtered) {
      if (promoIds?.has(product.id)) continue;
      const current = groups.get(product.category);
      if (current) current.push(product);
      else groups.set(product.category, [product]);
    }
    for (const group of groups.values()) group.sort(compareCatalogProducts);
    return groups;
  }, [activeCategory, filtered, promoProducts, search]);

  // R29: favoritos e recentes consultam indice local em O(1), sem novas consultas.
  const productById = useMemo(() => new Map(products.map(product => [product.id, product])), [products]);
  const savedProducts = useMemo(() => savedProductIds
    .map((id) => productById.get(id))
    .filter((product): product is Product => Boolean(product && product.disponivel !== false && visibleCategoryIds.has(product.category))),
  [savedProductIds, productById, visibleCategoryIds]);
  const recentlyViewed = useMemo(() => recentProductIds
    .map((id) => productById.get(id))
    .filter((product): product is Product => Boolean(product && product.disponivel !== false && visibleCategoryIds.has(product.category))), [recentProductIds, productById, visibleCategoryIds]);
  const openProduct = (product: Product) => {
    if (product.disponivel === false) return;
    rememberRecentProductId(product.id);
    setRecentProductIds(readRecentProductIds());
    openModal("product-details", product);
  };

  const bannerEligible = Boolean(campaign && campaign.scopes.includes("home") && !catalogLoading && !catalogError && campaignMatchesCatalogOffer(campaign, products));

  return (
    <div className={styles.page} data-dfl-campaign-home="true">
      {showAssistShortcut && !search.trim() && !catalogSearchFocused && !activeModal && !mobileMenuOpen && (
        <button type="button" className={styles.r71AssistShortcut} data-first-hint={assistFirstHint}
          onClick={() => window.dispatchEvent(new Event("dfl:assist-open"))}
          aria-label="Abrir DFL Assist para ajudar a escolher um produto">
          <span aria-hidden="true">✦</span> Precisa de ajuda?
        </button>
      )}
      <section className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.heroInner}>
          <div className={styles.heroLead}><p className={styles.eyebrow}>CARDÁPIO DA FAMÍLIA</p><h1>O que você quer pedir?</h1></div>

          <label className={styles.searchBox}>
            <span aria-hidden="true">⌕</span>
            <input ref={searchInputRef} aria-keyshortcuts="Control+K Meta+K" value={search} onFocus={() => setCatalogSearchFocused(true)} onBlur={() => setCatalogSearchFocused(false)} onChange={(event) => { setSearch(event.target.value); if (event.target.value.trim()) setActiveCategory("todos"); }} placeholder="Buscar lanche, combo ou bebida" aria-label="Buscar no cardápio" /><kbd className={styles.searchShortcut} aria-hidden="true">Ctrl K</kbd>
            {search && <button type="button" onClick={() => setSearch("")} aria-label="Limpar busca">×</button>}
          </label>
        </div>
      </section>

      {/* DFL-R58-ASSIST-VISIBLE: entrada editorial discreta; nao ocupa barra fixa. */}

      <div className={styles.categoryRailWrap} data-dfl-campaign-categories="true">
        <nav className={styles.categoryRail} aria-label="Categorias do cardápio">
          <button type="button" className={activeCategory === "todos" ? styles.categoryActive : styles.category} aria-current={activeCategory === "todos" ? "true" : undefined} onClick={() => setActiveCategory("todos")}>Todos</button>
          {menuCategories.map((category) => (
            <button type="button" key={category.id} className={activeCategory === category.id ? styles.categoryActive : styles.category} aria-current={activeCategory === category.id ? "true" : undefined} onClick={() => setActiveCategory(category.id)}>{category.label}</button>
          ))}
        </nav>
      </div>

      <main className={styles.content} id="dfl-family-catalog">
        {!isOnline && <div className={styles.connectionNotice} role="status"><div><strong>Você está offline</strong><span>O que já carregou continua disponível. Para atualizar o cardápio ou enviar um pedido, reconecte.</span></div></div>}
        {catalogError && isOnline && <div className={styles.catalogNotice} role="status"><div><strong>Cardápio em modo de contingência</strong><span>Mostrando a base disponível enquanto tentamos buscar a versão mais recente.</span></div><button type="button" onClick={() => void reloadCatalog()}>Tentar atualizar</button></div>}
        <VisualCampaignBanner show={bannerEligible} />
        <div className={styles.orderSlot}>
          <ActiveOrderBanner />
          <LastOrderCard />
          {!currentUser && guestLastOrder && <button type="button" className={styles.guestOrderCard} onClick={()=>openModal("orders")}><span>SEU PEDIDO NESTE APARELHO</span><strong>{guestLastOrder.status === "Agendado" ? "Seu pedido está agendado" : `Seu pedido está ${guestLastOrder.status.toLowerCase()}`}</strong><small>{guestLastOrder.scheduledLabel ? `${guestLastOrder.scheduledLabel} · Ver detalhes do pedido` : "Ver detalhes do pedido"}</small></button>}
        </div>
        {!currentUser && guestLastOrder && <CustomerExperiencePrompt />}
        {catalogLoading && <section className={styles.catalogSkeleton} aria-label="Carregando cardápio" aria-busy="true"><div className={styles.skeletonTitle}/><div className={styles.skeletonGrid}>{[0,1,2,3].map((item)=><div className={styles.skeletonCard} key={item}><i/><span/><b/></div>)}</div></section>}
        {activeCategory === "todos" && !search.trim() && promoProducts.length > 0 && (
          <section className={styles.promoShowcase} id="dfl-family-offers" data-dfl-campaign-offers="true">
            <div className={styles.promoShowcaseHead}>
              <div><span>{(campaign?.scopes.includes("offers") && campaign.offersTitle) || "OFERTAS DA FAMÍLIA"}</span><h2>Preço bom pra pedir agora</h2><p>Promoções ativas no cardápio, sem precisar de cupom.</p></div>
              <button type="button" className={styles.allOffersButton} onClick={()=>setShowAllOffers(v=>!v)}>{showAllOffers?"Fechar ofertas":`Ver ${promoProducts.length} ofertas`}</button>
            </div>
            {!showAllOffers && <div className={styles.promoRail}>
              {promoProducts.slice(0, 4).map((product, promoIndex) => {
                const discount = Math.round(((product.oldPrice! - product.price) / product.oldPrice!) * 100);
                return <article className={styles.promoHeroCard} key={`promo-${product.id}`} role="button" tabIndex={0} onClick={() => openProduct(product)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openProduct(product); } }}>
                  <div className={styles.promoHeroMedia}><CatalogImage src={product.image} alt="" sizes="(max-width: 699px) 74px, 82px" priority={promoIndex === 0} quality={70} /><span>-{discount}%</span></div>
                  <div className={styles.promoHeroCopy}><small data-dfl-campaign-badge="true">{(campaign?.scopes.includes("offers") && campaign.badgeLabel) || "OFERTA ATIVA"}</small><strong>{product.name}</strong><div><s>{money(product.oldPrice!)}</s><b>{money(product.price)}</b></div><em>Economize {money(product.oldPrice! - product.price)}</em><span className={styles.promoHint}>Toque para ver e personalizar</span></div>
                </article>;
              })}
            </div>}
            {showAllOffers && <div className={styles.offerGrid}>{promoProducts.map(product=><button type="button" key={`grid-${product.id}`} className={styles.offerGridCard} onClick={()=>openProduct(product)}><CatalogImage src={product.image} alt="" sizes="42vw" quality={68}/><span><b>{product.name}</b><s>{money(product.oldPrice!)}</s><strong>{money(product.price)}</strong><small>Ver e personalizar ›</small></span></button>)}</div>}
          </section>
        )}

        {!shopStatus.isOpen && (
          <div className={styles.closedNotice}>
            <strong>{shopStatus.message || "A loja está fechada agora."}</strong>
            <span>Você ainda pode explorar o cardápio e montar seu pedido para agendamento.</span>
          </div>
        )}

        {(Boolean(search.trim()) || activeCategory !== "todos") && !catalogLoading && (
          <div className={styles.searchSummary} role="status" aria-live="polite">
            <div>
              <strong>{filtered.length} {filtered.length === 1 ? "resultado" : "resultados"}</strong>
              <span>{search.trim()
                ? `Busca por “${search.trim()}”`
                : `Categoria: ${categories.find((category) => category.id === activeCategory)?.label ?? "Todos"}`}</span>
            </div>
            <button type="button" onClick={() => { setSearch(""); setActiveCategory("todos"); }}>Limpar</button>
          </div>
        )}

        {activeCategory === "todos" && !search.trim() && savedProducts.length > 0 && (
          <section className={`${styles.recentSection} ${styles.savedSection}`} aria-label="Seus produtos favoritos neste aparelho">
            <div className={styles.recentHeading}><div><span>SUAS ESCOLHAS</span><h2>Favoritos</h2></div><div className={styles.savedHeadingActions}><small>{savedProducts.length} salvos neste aparelho</small><button type="button" onClick={() => setClearFavoritesConfirm(true)}>Limpar favoritos</button></div></div>
            {clearFavoritesConfirm && <div className={styles.savedConfirm} role="group" aria-label="Confirmação para limpar favoritos"><span>Remover todos os favoritos deste aparelho?</span><button type="button" onClick={() => { if (clearSavedProductIds()) setClearFavoritesConfirm(false); }}>Sim, remover</button><button type="button" onClick={() => setClearFavoritesConfirm(false)}>Cancelar</button></div>}
            <div className={styles.recentRail}>
              {savedProducts.map((product) => <button type="button" key={product.id} onClick={() => openProduct(product)} aria-label={`Abrir favorito ${product.name}`}>
                <span className={styles.recentImage}><CatalogImage src={product.image} alt="" sizes="68px" quality={68}/></span>
                <span className={styles.recentInfo}><strong>{product.name}</strong><b>{money(product.price)}</b></span>
                <span className={styles.recentArrow} aria-hidden="true">›</span>
              </button>)}
            </div>
          </section>
        )}
        {activeCategory === "todos" && !search.trim() && recentlyViewed.length > 0 && (
          <section className={styles.recentSection} aria-label="Produtos vistos nesta visita">
            <div className={styles.recentHeading}><div><span>CONTINUE EXPLORANDO</span><h2>Vistos por você</h2></div><small>Só nesta visita</small></div>
            <div className={styles.recentRail}>
              {recentlyViewed.map((product) => (
                <button key={product.id} type="button" onClick={() => openProduct(product)} aria-label={"Voltar para " + product.name}>
                  <span className={styles.recentImage}><CatalogImage src={product.image} alt="" sizes="68px" quality={68}/></span>
                  <span className={styles.recentInfo}><strong>{product.name}</strong><b>{money(product.price)}</b></span>
                  <span className={styles.recentArrow} aria-hidden="true">›</span>
                </button>
              ))}
            </div>
          </section>
        )}
        {categories.map((category) => {
          if (activeCategory !== "todos" && activeCategory !== category.id) return null;
           const categoryProducts = groupedProducts.get(category.id) ?? [];
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
                    <article className={`${styles.card} ${!available ? styles.unavailable : ""}`} key={product.id} data-dfl-campaign-product={hasDiscount && available ? "true" : undefined}>
                      {available && <button type="button" className={styles.cardActionArea} onClick={() => openProduct(product)} aria-label={`Ver detalhes e personalizar ${product.name}`} />}
                      <div className={styles.media}>
                        <CatalogImage src={product.image} alt={product.name} sizes="(max-width: 560px) 37vw, (max-width: 640px) 50vw, (max-width: 1100px) 33vw, 280px" quality={72} />
                        <div className={styles.badges}>
                          {product.isSuggestion && available && <span className={styles.featured}>Sugestão da casa</span>}
                          {hasDiscount && available && <span className={styles.discount} data-dfl-campaign-badge="true">{campaign?.scopes.includes("catalog") && campaign.badgeLabel ? `${campaign.badgeLabel} · -${discount}%` : `-${discount}%`}</span>}
                        </div>
                        {!available && <span className={styles.soldOut}>Indisponível</span>}
                      </div>
                      <div className={styles.cardBody}>
                        <h3>{product.name}</h3>
                        <p className={styles.cardDescription}>{product.description}</p>

                        <div className={styles.cardFooter}>
                          <div className={styles.priceBlock}>
                            {hasDiscount && <span className={styles.oldPrice}>{money(product.oldPrice!)}</span>}
                            <strong>{money(product.price)}</strong>
                          </div>
                          <button type="button" className={styles.addButton} data-dfl-campaign-add="true" disabled={!available} onClick={(event) => { event.stopPropagation(); openProduct(product); }} aria-label={available ? `Ver opções de ${product.name}` : `${product.name} indisponível`}>
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

        {!catalogLoading && filtered.length === 0 && (
          <div className={styles.empty}>
            <strong>Nenhum item encontrado.</strong>
            <span>{search.trim() ? "Tente outro nome, confira a escrita ou procure uma sugestão." : "Tente outra categoria ou volte ao cardápio completo."}</span>
            {catalogRecovery.length > 0 && <div className={styles.catalogRecoverySuggestions} aria-label="Buscas alternativas do cardápio">
              <small>Produtos parecidos no cardápio. Toque para procurar:</small>
              <div>{catalogRecovery.map(name => <button type="button" key={name} onClick={() => { setSearch(name); setActiveCategory("todos"); }}>{name}</button>)}</div>
            </div>}
            {Boolean(search.trim()) && <div className={styles.emptyRecovery}>
              <button type="button" onClick={() => { setSearch("combo"); setActiveCategory("todos"); }}>Buscar combos</button>
              <button type="button" onClick={() => window.dispatchEvent(new Event("dfl:assist-open"))}>Usar DFL Assist</button>
            </div>}
            <button type="button" onClick={() => { setSearch(""); setActiveCategory("todos"); }}>Ver cardápio completo</button>
          </div>
        )}
      </main>
    </div>
  );
}

// DFL-R29-CATALOG-INDEX

// DFL-R30-HOME-INDEX
// DFL-R32-EMPTY-RECOVERY
// DFL-R33-CATALOG-SEARCH-RECOVERY
