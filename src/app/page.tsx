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
import { CustomerPwaInvite } from "@/components/home/CustomerPwaInvite";
import { OrderTrackingInfoCard } from "@/components/home/OrderTrackingInfoCard";
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

const R20_SEARCH_HINTS = ["Buscar lanche…", "Buscar combo…", "Buscar bebida…"] as const;

export default function Home() {
  const campaign = useVisualCampaign();
  const openModal = useUIStore((s) => s.openModal);
  const activeModal = useUIStore((s) => s.activeModal);
  const mobileMenuOpen = useUIStore((s) => s.isMobileMenuOpen);
  const [catalogSearchFocused, setCatalogSearchFocused] = useState(false);
  const [searchSuggestionsOpen, setSearchSuggestionsOpen] = useState(false);
  const currentUser = useAuthStore((s) => s.currentUser);
  const shopStatus = useShopStatus();
  const { products, loading: catalogLoading, error: catalogError, reload: reloadCatalog } = useCatalog();
  const [isOnline, setIsOnline] = useState(true);
  const { activeCategories: categories } = useCatalogCategories();
  const [search, setSearch] = useState("");
  // R20: anima apenas o placeholder; nunca modifica a busca escrita pelo cliente.
  const [hintIndex, setHintIndex] = useState(0);
  const [hintLength, setHintLength] = useState(0);
  const [reducedSearchMotion, setReducedSearchMotion] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedSearchMotion(media.matches);
    sync();
    media.addEventListener?.("change", sync);
    return () => media.removeEventListener?.("change", sync);
  }, []);
  useEffect(() => {
    if (search || catalogSearchFocused || reducedSearchMotion) return;
    const full = R20_SEARCH_HINTS[hintIndex];
    const complete = hintLength >= full.length;
    const timer = window.setTimeout(() => {
      if (complete) {
        setHintIndex((value) => (value + 1) % R20_SEARCH_HINTS.length);
        setHintLength(0);
      } else setHintLength((value) => Math.min(full.length, value + 1));
    }, complete ? 1500 : 100);
    return () => window.clearTimeout(timer);
  }, [search, catalogSearchFocused, reducedSearchMotion, hintIndex, hintLength]);
  const searchHint = reducedSearchMotion ? "Buscar no cardápio" : R20_SEARCH_HINTS[hintIndex].slice(0, hintLength) || "Buscar";
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchScrollPending = useRef(false);
  const [searchSubmitSeq, setSearchSubmitSeq] = useState(0);
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
  const [offersOpenRequest,setOffersOpenRequest] = useState(0);
  const [highlightOffers,setHighlightOffers] = useState(false);
  const offersScrollPending = useRef(false);
  useEffect(()=>{
    const expand=()=>{offersScrollPending.current=true;setShowAllOffers(true);setOffersOpenRequest(value=>value+1);setSearch("");setActiveCategory("todos");};
    window.addEventListener("dfl:campaign-offers-open",expand);
    return()=>window.removeEventListener("dfl:campaign-offers-open",expand);
  },[]);
  useEffect(()=>{
    if(!showAllOffers||!offersScrollPending.current)return;
    offersScrollPending.current=false;
    const target=document.getElementById("dfl-family-offers");
    if(!target)return;
    const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({behavior:reduced?"auto":"smooth",block:"start"});
    const frame=window.requestAnimationFrame(()=>setHighlightOffers(true));
    const timer=window.setTimeout(()=>setHighlightOffers(false),1500);
    return()=>{window.cancelAnimationFrame(frame);window.clearTimeout(timer);};
  },[showAllOffers,offersOpenRequest]);
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
    const frame=window.requestAnimationFrame(()=>{
      try {
        const pending = window.sessionStorage.getItem("dfl:pending-catalog-search");
        if (pending !== null) {
          window.sessionStorage.removeItem("dfl:pending-catalog-search");
          setSearch(pending.slice(0, 100));
          if (pending.trim()) setActiveCategory("todos");
        }
      } catch { /* armazenamento indisponivel */ }
    });
    return()=>window.cancelAnimationFrame(frame);
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

  // R62: sugestoes derivadas somente do catalogo local ja carregado.
  const liveSearchMatches = useMemo(() => {
    if (search.trim().length < 2) return [];
    const eligible = products.filter(product => product.disponivel !== false && visibleCategoryIds.has(product.category));
    return rankCatalogProducts(eligible, search);
  }, [products, visibleCategoryIds, search]);
  const submitCatalogSearch = (selected?: string) => {
    const term = (selected ?? search).trim();
    if (!term) return;
    if (selected) setSearch(term);
    setActiveCategory("todos");
    setSearchSuggestionsOpen(false);
    searchScrollPending.current = true;
    setSearchSubmitSeq(value => value + 1);
    searchInputRef.current?.blur();
  };
  useEffect(() => {
    if (!searchScrollPending.current || catalogLoading || !search.trim() ||
        deferredSearch.trim() !== search.trim()) return;
    const target = document.getElementById("dfl-search-results");
    if (!target) return;
    searchScrollPending.current = false;
    const frame = window.requestAnimationFrame(() => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [catalogLoading, deferredSearch, search, searchSubmitSeq]);

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
    if (activeCategory === "todos" || menuCategories.some((category) => category.id === activeCategory)) return;
    const frame=window.requestAnimationFrame(()=>setActiveCategory("todos"));
    return()=>window.cancelAnimationFrame(frame);
  }, [activeCategory, menuCategories]);
  useEffect(() => {
    const syncGuest=()=>{setGuestIdentity(readGuestIdentity());setGuestLastOrder(readGuestOrders()[0]||null)};
    syncGuest(); window.addEventListener("dfl:guest-continuity",syncGuest);
    return()=>window.removeEventListener("dfl:guest-continuity",syncGuest);
  }, []);
  useEffect(() => {
    const online=()=>setIsOnline(true), offline=()=>setIsOnline(false);
    const syncConnectivity=()=>setIsOnline(navigator.onLine);
    const onVisible=()=>{ if (document.visibilityState === "visible") syncConnectivity(); };
    syncConnectivity();
    window.addEventListener("online",online); window.addEventListener("offline",offline);
    window.addEventListener("pageshow",syncConnectivity);
    window.addEventListener("focus",syncConnectivity);
    document.addEventListener("visibilitychange",onVisible);
    return()=>{window.removeEventListener("online",online);window.removeEventListener("offline",offline);window.removeEventListener("pageshow",syncConnectivity);window.removeEventListener("focus",syncConnectivity);document.removeEventListener("visibilitychange",onVisible);};
  }, []);

  const promoProducts = useMemo(
    () => products
      .filter((product) => visibleCategoryIds.has(product.category) && product.disponivel !== false && typeof product.oldPrice === "number" && product.oldPrice > product.price && (product.promoPlacement === "home_showcase" || (product.promoPlacement == null && product.isSuggestion === true)))
      .sort((a, b) => (((b.oldPrice! - b.price) / b.oldPrice!) * 100) - (((a.oldPrice! - a.price) / a.oldPrice!) * 100))
      .slice(0, 6),
    [products, visibleCategoryIds],
  );

  // R104: IDs reais controlados no Admin; no legado preserva as seis ofertas comerciais existentes.
  const showcaseProducts=useMemo(()=>{
    const ids=campaign?.scopes.includes("offers") ? campaign.offerProductIds : [];
    if(!ids?.length)return promoProducts;
    const indexed=new Map(products.filter(product=>product.disponivel!==false&&
      typeof product.oldPrice==="number"&&product.oldPrice>product.price&&visibleCategoryIds.has(product.category))
      .map(product=>[product.id,product]));
    return ids.map(id=>indexed.get(id)).filter((product):product is Product=>Boolean(product)).slice(0,12);
  },[campaign,products,promoProducts,visibleCategoryIds]);
  const renderShowcaseOffer=(product:Product,promoIndex:number,expanded:boolean)=>{
    const validDiscount=typeof product.oldPrice==="number"&&Number.isFinite(product.oldPrice)&&product.oldPrice>product.price;
    const pct=validDiscount?Math.round((1-product.price/product.oldPrice!)*100):0;
    return <button type="button" key={`offer-${product.id}`} className={`${styles.r104OfferCard} ${expanded?styles.r104OfferCardExpanded:styles.r104OfferCardPreview}`}
      onClick={()=>openProduct(product)} aria-label={`Ver e personalizar ${product.name}`}>
      <div className={styles.r104OfferImage}><CatalogImage src={product.image} alt="" sizes={expanded?"(max-width: 699px) 100px, 140px":"(max-width: 699px) 92px, 118px"} quality={70} priority={promoIndex === 0}/></div>
      <div className={styles.r104OfferContent}>
        <span className={styles.r104OfferBadge} data-dfl-campaign-badge="true">{(campaign?.scopes.includes("offers") && campaign.badgeLabel)||"OFERTA"}{pct>0?` · -${pct}%`:""}</span>
        <strong className={styles.r104OfferName}>{product.name}</strong>
        <div className={styles.r104OfferPrices}>{validDiscount&&<s>{money(product.oldPrice!)}</s>}<b>{money(product.price)}</b></div>
        <small>Ver e personalizar <span aria-hidden="true">›</span></small>
      </div>
    </button>;
  };

  // V87 R1: uma indexação por render, sem filtragens/ordenações repetidas por categoria.
  const groupedProducts = useMemo(() => {
    const exclusive=Boolean(campaign?.scopes.includes("offers")&&campaign.exclusiveShowcase);
    const excludePromos=!search.trim() && (exclusive || activeCategory === "todos");
    const promoIds=excludePromos?new Set((exclusive?showcaseProducts:promoProducts).map(product=>product.id)):null;
    const groups = new Map<string, Product[]>();
    for (const product of filtered) {
      if (promoIds?.has(product.id)) continue;
      const current = groups.get(product.category);
      if (current) current.push(product);
      else groups.set(product.category, [product]);
    }
    for (const group of groups.values()) group.sort(compareCatalogProducts);
    return groups;
  }, [activeCategory, filtered, promoProducts, showcaseProducts, campaign, search]);

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

  const bannerEligible = Boolean(campaign && campaign.scopes.includes("home") && !catalogLoading && !catalogError && !search.trim() && activeCategory === "todos" && campaignMatchesCatalogOffer(campaign, products));

  return (
    <div className={styles.page} data-dfl-campaign-home="true">
      <section className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.heroInner}>
          <div className={styles.heroLead}><p className={styles.eyebrow}>CARDÁPIO DA FAMÍLIA</p><h1>O que você quer pedir?</h1></div>

          <div className={styles.searchUi} onFocusCapture={() => setSearchSuggestionsOpen(true)} onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setSearchSuggestionsOpen(false);
          }}>
          <label className={styles.searchBox}>
            <span aria-hidden="true">⌕</span>
            <input ref={searchInputRef} aria-keyshortcuts="Control+K Meta+K" value={search} onFocus={() => setCatalogSearchFocused(true)} onBlur={() => setCatalogSearchFocused(false)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); submitCatalogSearch(); } else if (event.key === "Escape") setSearchSuggestionsOpen(false); }} onChange={(event) => { setSearch(event.target.value); if (event.target.value.trim()) setActiveCategory("todos"); }} aria-autocomplete="list" aria-controls="dfl-search-preview" aria-expanded={searchSuggestionsOpen && search.trim().length >= 2} placeholder={search || catalogSearchFocused ? "Buscar no cardápio" : searchHint} aria-label="Buscar no cardápio" /><kbd className={styles.searchShortcut} aria-hidden="true">Ctrl K</kbd>
            {search && <button type="button" onClick={() => setSearch("")} aria-label="Limpar busca">×</button>}
          </label>
          {searchSuggestionsOpen && search.trim().length >= 2 && (
            <section className={styles.searchPreview} id="dfl-search-preview" aria-label="Sugestões do cardápio">
              <div className={styles.searchPreviewTitle} role="status" aria-live="polite">
                <strong>{liveSearchMatches.length} {liveSearchMatches.length === 1 ? "produto encontrado" : "produtos encontrados"}</strong>
                <span>Toque em um produto ou veja todos os resultados</span>
              </div>
              {liveSearchMatches.slice(0, 4).map(product => (
                <button className={styles.searchPreviewChoice} type="button" key={product.id} onClick={() => submitCatalogSearch(product.name)}>
                  <span>{product.name}</span><b>{money(product.price)}</b>
                </button>
              ))}
              {!catalogLoading && liveSearchMatches.length === 0 && <p className={styles.searchPreviewEmpty}>Nenhuma sugestão exata. Confira outras possibilidades na busca completa.</p>}
              <button className={styles.searchPreviewAll} type="button" onClick={() => submitCatalogSearch()}>
                Ver resultados da pesquisa <span aria-hidden="true">↓</span>
              </button>
            </section>
          )}
          </div>
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
        {!search.trim() && activeCategory === "todos" && (
        <div className={styles.orderSlot}>
          <ActiveOrderBanner />
          <LastOrderCard />
          {!currentUser && guestLastOrder && <button type="button" className={styles.guestOrderCard} onClick={()=>openModal("orders")}><span>SEU PEDIDO NESTE APARELHO</span><strong>{guestLastOrder.status === "Agendado" ? "Seu pedido está agendado" : `Seu pedido está ${guestLastOrder.status.toLowerCase()}`}</strong><small>{guestLastOrder.scheduledLabel ? `${guestLastOrder.scheduledLabel} · Ver detalhes do pedido` : "Ver detalhes do pedido"}</small></button>}
        </div>
        )}
        {!currentUser && guestLastOrder && !search.trim() && <CustomerExperiencePrompt />}
        {!activeModal && !search.trim() && <CustomerPwaInvite />}
        {catalogLoading && <section className={styles.catalogSkeleton} aria-label="Carregando cardápio" aria-busy="true"><div className={styles.skeletonTitle}/><div className={styles.skeletonGrid}>{[0,1,2,3].map((item)=><div className={styles.skeletonCard} key={item}><i/><span/><b/></div>)}</div></section>}
        {activeCategory === "todos" && !search.trim() && showcaseProducts.length > 0 && (
          <section className={styles.promoShowcase} id="dfl-family-offers" data-dfl-campaign-offers="true" data-highlight={highlightOffers?"true":"false"} aria-label="Ofertas da Família">
            <div className={styles.promoShowcaseHead}>
              <div><span data-dfl-campaign-heading="true">{(campaign?.scopes.includes("offers") && campaign.offersTitle)||"OFERTAS DA FAMÍLIA"}</span><h2>Preço bom pra pedir agora</h2></div>
              <button type="button" data-dfl-campaign-expand="true" aria-expanded={showAllOffers} aria-controls="dfl-offers-products" className={styles.allOffersButton}
                onClick={()=>setShowAllOffers(value=>!value)}>{showAllOffers?"Mostrar menos ofertas":`Ver todas as ${showcaseProducts.length} ofertas`}</button>
            </div>
            <div id="dfl-offers-products" className={showAllOffers?styles.r104OffersExpanded:styles.r104OffersPreview}>
              {(showAllOffers?showcaseProducts:showcaseProducts.slice(0,2)).map((product,index)=>renderShowcaseOffer(product,index,showAllOffers))}
            </div>
            {!showAllOffers && showcaseProducts.length>2 && <p className={styles.r104OffersHint}>Deslize para conhecer as ofertas ou toque em “Ver todas”.</p>}
          </section>
        )}

        {!shopStatus.isOpen && (
          <div className={styles.closedNotice}>
            <strong>{shopStatus.message || "A loja está fechada agora."}</strong>
            <span>Você ainda pode explorar o cardápio e montar seu pedido para agendamento.</span>
          </div>
        )}

        {activeCategory === "todos" && !search.trim() && <OrderTrackingInfoCard />}

        {(Boolean(search.trim()) || activeCategory !== "todos") && !catalogLoading && (
          <div id="dfl-search-results" className={styles.searchResultsAnchor}>
          <div className={styles.searchSummary} role="status" aria-live="polite">
            <div>
              <strong>{filtered.length} {filtered.length === 1 ? "resultado" : "resultados"}</strong>
              <span>{search.trim()
                ? `Busca por “${search.trim()}”`
                : `Categoria: ${categories.find((category) => category.id === activeCategory)?.label ?? "Todos"}`}</span>
            </div>
            <button type="button" onClick={() => { setSearch(""); setActiveCategory("todos"); }}>Limpar</button>
          </div>
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
