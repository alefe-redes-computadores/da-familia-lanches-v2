"use client";
import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { CatalogImage } from "@/components/ui/CatalogImage";
import { useCatalog } from "@/hooks/useCatalog";
import type { Product } from "@/data/products";
import { extractDFLIntent, recommendDFLProducts } from "@/lib/dflAssistRecommendations";
import { suggestCatalogQueries } from "@/lib/catalogSearchRecovery";
import styles from "./DFLAssist.module.css";

type Props = { onFindProduct: (name: string) => void; onOpenProduct: (product: Product) => void };
const currency = (value: number) => value.toLocaleString("pt-BR", {style:"currency", currency:"BRL"});
/** Recomenda apenas itens do catalogo atual; nunca cria ou altera pedido. */
export function DFLAssistOffers({ onFindProduct, onOpenProduct }: Props) {
  // DFL-R64-DIRECT-PRODUCT: nunca cria pedido ou muda precos.
  const { products, loading, error, source } = useCatalog();
  const [people, setPeople] = useState(2);
  const [query, setQuery] = useState("");
  const [budgetInput, setBudgetInput] = useState("");
  const [onlyCombos, setOnlyCombos] = useState(false);
  // DFL-R45-ASSIST: exibicao progressiva, sem remover resultados.
  const [showAllOffers, setShowAllOffers] = useState(false);
  // DFL-R89-ADMIN-MACRO: ordenacao apenas visual; resultado sempre vem do catalogo confirmado.
  const [offerSort, setOfferSort] = useState<"relevance" | "cheapest" | "expensive">("relevance");
  // Centavos inteiros: formato previsível no teclado Android, sem input numérico nativo.
  const budget = budgetInput ? Number(budgetInput) / 100 : undefined;
  const formatBudget = (cents: string) => cents ? currency(Number(cents) / 100) : "";
  const validBudget = budget === undefined || (Number.isFinite(budget) && budget >= 0);
  const intent = useMemo(() => extractDFLIntent(query), [query]);
  const catalogReady = !loading && !error && source === "hybrid";
  const offers = useMemo(() => catalogReady && validBudget
    ? recommendDFLProducts(products, { people, budget, onlyCombos, query }, 4)
    : [], [catalogReady, validBudget, products, people, budget, onlyCombos, query]);
  const discoveryHints = useMemo(() => catalogReady && validBudget && !offers.length && query.trim()
    ? suggestCatalogQueries(products, query, 3)
    : [], [catalogReady, validBudget, offers.length, products, query]);
  // DFL-R100-FINAL-POLISH: limpeza inclui ordenacao, mesmo sem filtros textuais.
  const clearFilters = () => { setQuery(""); setPeople(2); setBudgetInput(""); setOnlyCombos(false); setShowAllOffers(false); setOfferSort("relevance"); };
  const orderedOffers = useMemo(() => {
    if (offerSort === "relevance") return offers;
    return [...offers].sort((a, b) => offerSort === "cheapest"
      ? a.product.price - b.product.price || b.score - a.score
      : b.product.price - a.product.price || b.score - a.score);
  }, [offers, offerSort]);
  const visibleOffers = showAllOffers ? orderedOffers : orderedOffers.slice(0, 2);
  // R102: indice somente em memoria; evita varrer o catalogo para cada componente do combo.
  const productLookup = useMemo(() => new Map(products.map(product => [product.id, product])), [products]);
  const effectiveBudget = intent.budget ?? budget;
  // DFL-R61-ASSIST-NAVIGATION: texto conversacional nunca vira busca literal por frase inteira.
  // Prioriza produto realmente recomendado, respeitando orcamento e disponibilidade do catalogo.
  const findFromIntent = () => {
    if (orderedOffers.length > 0) {
      // DFL-R74-ASSIST-PURCHASE: produto confirmado, sem pesquisa intermediaria.
      onOpenProduct(orderedOffers[0].product);
      return;
    }
    if (discoveryHints.length > 0) {
      onFindProduct(discoveryHints[0]);
      return;
    }
    // Sem resultado valido: manter o usuario no assistente para ajustar os filtros.
  };
  const canFindFromIntent = catalogReady && validBudget && (offers.length > 0 || discoveryHints.length > 0);

  return <section className={styles.offers} aria-label="Sugestões do DFL Assist">
    <h3 className={styles.offerTitle}>Encontre seu lanche</h3>
    <div className={styles.quickSearch} role="group" aria-label="Buscas rápidas">
      <button type="button" aria-pressed={query === "frango"} onClick={()=>{setQuery("frango");setOnlyCombos(false);}}>Frango</button>
      <button type="button" aria-pressed={query === "sem bacon"} onClick={()=>{setQuery("sem bacon");setOnlyCombos(false);}}>Sem bacon</button>
      <button type="button" aria-pressed={query === "bacon"} onClick={()=>{setQuery("bacon");setOnlyCombos(false);}}>Bacon</button>
      <button type="button" aria-pressed={onlyCombos} onClick={()=>{setQuery("combo");setOnlyCombos(true);}}>Combos</button>
      {/* R102: orcamentos ficam unificados nos atalhos logo abaixo do campo de valor;
          quantidade de pessoas ja possui seletor proprio. Menos botoes repetidos. */}
    </div>
    <label className={styles.offerQueryLabel} htmlFor="dfl-assist-ingredients">Descreva seu pedido ou procure um ingrediente</label>
    {/* DFL-R88-CATALOG-CHECK: orientação de uso sem inventar produtos. */}
    {!query && !budgetInput && <p className={styles.r88AssistHint}>Experimente “frango”, “sem bacon” ou um orçamento rápido. Sugestões vêm do cardápio disponível.</p>}
    {/* DFL-R95-MACRO: orientacao de pesquisa e limpeza seletiva. */}
    {query.trim() && <div className={styles.r95QueryTools}><span>Buscando por: <strong>{query.trim()}</strong></span><button type="button" onClick={() => { setQuery(""); setShowAllOffers(false); }}>Limpar texto</button></div>}
    <div className={styles.offerSearchRow}>
      <input id="dfl-assist-ingredients" className={styles.offerQuery} type="search" autoComplete="off" maxLength={100}
        placeholder="Ex.: combo com frango até R$ 50" value={query}
        onChange={e=>{setQuery(e.target.value);setShowAllOffers(false);}}
        onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();findFromIntent();}}}/>
      <button type="button" className={styles.offerSearchAction} disabled={!canFindFromIntent} onClick={findFromIntent}>{offers.length ? "Abrir produto" : discoveryHints.length ? "Ver alternativa" : "Sem resultado"}</button>
    </div>
    {(intent.budget !== null || intent.people !== null) && <p className={styles.offerIntent} role="status">
      Entendi na frase: {intent.people !== null ? `${intent.people} pessoa(s)` : ""}{intent.people !== null && intent.budget !== null ? " · " : ""}{intent.budget !== null ? `até ${currency(intent.budget)}` : ""}. A frase tem prioridade sobre esses filtros.
    </p>}
    {/* DFL-R60-ASSIST-UX: transparencia sobre filtros reais, nunca promessa de porcao ou ingrediente */}
    {catalogReady && (query.trim() || budgetInput || onlyCombos) && <div className={styles.activeAssistFilters} role="status" aria-live="polite">
      <strong>Busca personalizada</strong>
      <span>{intent.people ?? people} { (intent.people ?? people) === 1 ? "pessoa" : "pessoas"}{(intent.budget ?? budget) != null ? ` · até ${currency((intent.budget ?? budget)!)}` : " · sem limite de preço"}{(onlyCombos || intent.comboOnly) ? " · somente combos" : ""}</span>
    </div>}
    {intent.hasExclusion && <p className={styles.offerSafety}>Evitar: {intent.excludedTerms.join(", ")}. Produtos que mencionam esses ingredientes não são sugeridos, mas a ausência na descrição NÃO garante ausência no preparo ou contaminação cruzada. Confira com a equipe antes de pedir.</p>}
    <div className={styles.offerFilters}>
      <div className={styles.peopleFilter} role="group" aria-label="Quantidade de pessoas">
        <span>Quantas pessoas?</span>
        <div className={styles.peopleStepper}>
          <button type="button" aria-label="Diminuir pessoas" disabled={people === 1} onClick={() => setPeople(n => Math.max(1,n-1))}><Minus size={18}/></button>
          <strong aria-live="polite">{people} {people === 1 ? "pessoa" : "pessoas"}</strong>
          <button type="button" aria-label="Aumentar pessoas" disabled={people === 8} onClick={() => setPeople(n => Math.min(8,n+1))}><Plus size={18}/></button>
        </div>
      </div>
      <label className={styles.budgetFilter}>Orçamento (R$)
        <input inputMode="numeric" type="text" value={formatBudget(budgetInput)}
          onChange={e => setBudgetInput(e.target.value.replace(/\D/g, "").slice(0, 8))}
          placeholder="Sem limite" aria-label="Orçamento em reais, opcional" autoComplete="off" />
      </label>
    </div>
    {/* DFL-R94-MACRO-360 — dicas claras sem conclusoes sobre alergias. */}
    <p className={styles.r94AssistGuidance}>Dica: combine pessoas, orçamento e ingrediente. Os resultados respeitam a disponibilidade informada pelo cardápio.</p>
    {catalogReady && effectiveBudget != null && Number.isFinite(effectiveBudget) && <p className={styles.r97BudgetGuide}>Orçamento considerado: <strong>{currency(effectiveBudget)}</strong>. As recomendações exibidas respeitam esse teto, mas não incluem entrega ou adicionais.</p>}
    {/* DFL-R98-MACRO-FINAL: orçamento rápido sem apagar pesquisa ou tipo de oferta. */}
    <div className={styles.r98BudgetPresets} role="group" aria-label="Limites rapidos de orcamento">
      <span>Orçamento rápido</span>
      {([3000, 4000, 5000, 6000, 8000, 10000] as const).map((cents) => <button type="button" key={cents} aria-pressed={budgetInput === String(cents)} data-active={budgetInput === String(cents)} onClick={() => { setBudgetInput(String(cents)); setShowAllOffers(false); }}>{currency(cents / 100)}</button>)}
      {budgetInput && <button type="button" onClick={() => { setBudgetInput(""); setShowAllOffers(false); }}>Sem limite</button>}
    </div>
    <div className={styles.offerFilterFooter}>
      <label className={styles.offerToggle}><input type="checkbox" checked={onlyCombos} onChange={e=>setOnlyCombos(e.target.checked)}/> Mostrar somente combos</label>
      <button type="button" className={styles.offerClearFilters} onClick={clearFilters} disabled={!query && !budgetInput && !onlyCombos && people === 2 && offerSort === "relevance"}>Limpar filtros</button>
    </div>
    {catalogReady && offers.length > 1 && <div className={styles.r89OfferSort} role="group" aria-label="Ordenar sugestões">
      <span>Comparar sugestões</span>
      <div>
        <button type="button" aria-pressed={offerSort === "relevance"} data-active={offerSort === "relevance"} onClick={() => setOfferSort("relevance")}>Recomendadas</button>
        <button type="button" aria-pressed={offerSort === "cheapest"} data-active={offerSort === "cheapest"} onClick={() => setOfferSort("cheapest")}>Mais baratas</button>
        <button type="button" aria-pressed={offerSort === "expensive"} data-active={offerSort === "expensive"} onClick={() => setOfferSort("expensive")}>Maior valor</button>
      </div>
    </div>}
    {!validBudget ? <p className={styles.offerNotice}>Confira o orçamento informado.</p> :
     loading ? <p className={styles.offerNotice} role="status">Carregando sugestões do cardápio…</p> :
     !catalogReady ? <p className={styles.offerNotice} role="status">Cardápio online indisponível. Você ainda pode pesquisar ou falar com a equipe; não vou apresentar preços sem confirmação.</p> :
     offers.length ? <><ul className={styles.offerList}>{visibleOffers.map(({product,reason})=><li key={product.id}>
        <div className={styles.offerImage}>{product.image ? <CatalogImage src={product.image} alt={product.name} sizes="72px" /> : <span aria-hidden="true">DFL</span>}</div>
        <div className={styles.offerCopy}><strong>{product.name}</strong><small className={styles.r94AssistProductType}>{product.bundleItems?.length ? "Combo com componentes cadastrados" : "Produto do cardápio"}</small><b className={styles.offerPrice}>{currency(product.price)}</b><small>{product.bundleItems?.length ? "Confira os itens e a composição do combo" : reason}</small>
          {effectiveBudget != null && Number.isFinite(effectiveBudget) && effectiveBudget >= product.price && <small className={styles.r89BudgetRemaining}>Dentro do limite · sobra {currency(Math.max(0, effectiveBudget - product.price))}</small>}
          {/* DFL-R91-GESTAO-COMERCIAL: desconto apenas quando preco anterior valido. */}
          {typeof product.oldPrice === "number" && Number.isFinite(product.oldPrice) && product.oldPrice > product.price &&
            <small className={styles.r91AssistDiscount}>De {currency(product.oldPrice)} · economia de {currency(product.oldPrice - product.price)}</small>}
          {/* DFL-R90-COMBO-AUDIT: nunca apresentar componente ausente como confirmado. */}
          {Boolean(product.bundleItems?.length) && product.bundleItems!.every((component) => Number.isInteger(component.quantity) && component.quantity > 0 && (productLookup.get(component.productId)?.disponivel !== false && productLookup.has(component.productId))) &&
            <small className={styles.r90AssistComposition}>
              Composição cadastrada: {product.bundleItems!.slice(0, 3).map((component) => `${component.quantity}× ${productLookup.get(component.productId)?.name ?? ""}`).join(" · ")}{product.bundleItems!.length > 3 ? ` · +${product.bundleItems!.length - 3} item(ns)` : ""}. Confira os ingredientes na página do produto.
            </small>}</div>
        <button type="button" onClick={()=>onOpenProduct(product)} aria-label={`Abrir detalhes de ${product.name}`}>Ver <span className={styles.offerButtonLabel}>produto</span></button>
      </li>)}</ul>{offers.length > 2 && <button type="button" aria-expanded={showAllOffers}
        onClick={()=>setShowAllOffers(value=>!value)}
        style={{width:"100%",minHeight:44,marginTop:8,border:"1px solid #ddcba9",borderRadius:12,background:"#fffaf0",color:"#45331c",fontSize:13,fontWeight:850,cursor:"pointer"}}>
        {showAllOffers ? "Mostrar menos sugestões" : `Ver mais ${offers.length-2} sugestões`}
      </button>}</> :
     <div className={styles.offerRecovery}>
       <p className={styles.offerNotice}>Não encontrei opções confirmadas. Ajuste os filtros para explorar o cardápio real.</p>
       <div className={styles.r74RecoveryActions} role="group" aria-label="Ajustar busca sem resultados">
         {onlyCombos && <button type="button" onClick={() => setOnlyCombos(false)}>Ver também avulsos</button>}
         {budgetInput && <button type="button" onClick={() => setBudgetInput("")}>Retirar limite de preço</button>}
         {query.trim() && <button type="button" onClick={() => setQuery("")}>Limpar texto da busca</button>}
         <button type="button" onClick={clearFilters}>Recomeçar sugestões</button>
       </div>
       {discoveryHints.length > 0 && <div className={styles.offerDiscovery} aria-label="Alternativas para explorar no cardápio">
         <small>Produtos com nomes parecidos — confira preço e filtros:</small>
         {discoveryHints.map(name => <button type="button" key={name} onClick={() => onFindProduct(name)}>{name}</button>)}
       </div>}
     </div>}
    {/* DFL-R72-ASSIST-INTELIGENTE: transparencia sobre restricoes e resultados. */}
    {catalogReady && validBudget && <p className={styles.offerCount} role="status">{offers.length} {offers.length===1 ? "sugestão" : "sugestões"} do catálogo confirmado</p>}
    <p className={styles.offerNotice}>Sugestões não reservam itens. Confira os ingredientes, o preço e a disponibilidade na finalização.</p>
  </section>;
}
// DFL-R33-ASSIST-RECOVERY
