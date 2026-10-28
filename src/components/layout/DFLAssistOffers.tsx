"use client";
import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { CatalogImage } from "@/components/ui/CatalogImage";
import { useCatalog } from "@/hooks/useCatalog";
import { extractDFLIntent, recommendDFLProducts } from "@/lib/dflAssistRecommendations";
import { suggestCatalogQueries } from "@/lib/catalogSearchRecovery";
import styles from "./DFLAssist.module.css";

type Props = { onFindProduct: (name: string) => void };
const currency = (value: number) => value.toLocaleString("pt-BR", {style:"currency", currency:"BRL"});
/** Recomenda apenas itens do catalogo atual; nunca cria ou altera pedido. */
export function DFLAssistOffers({ onFindProduct }: Props) {
  const { products, loading, error, source } = useCatalog();
  const [people, setPeople] = useState(2);
  const [query, setQuery] = useState("");
  const [budgetInput, setBudgetInput] = useState("");
  const [onlyCombos, setOnlyCombos] = useState(false);
  // DFL-R45-ASSIST: exibicao progressiva, sem remover resultados.
  const [showAllOffers, setShowAllOffers] = useState(false);
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
  const clearFilters = () => { setQuery(""); setPeople(2); setBudgetInput(""); setOnlyCombos(false); setShowAllOffers(false); };
  const visibleOffers = showAllOffers ? offers : offers.slice(0, 2);
  return <section className={styles.offers} aria-label="Sugestões do DFL Assist">
    <h3 className={styles.offerTitle}>Encontre seu lanche</h3>
    <div className={styles.quickSearch} role="group" aria-label="Buscas rápidas">
      <button type="button" aria-pressed={query === "frango"} onClick={()=>{setQuery("frango");setOnlyCombos(false);}}>Frango</button>
      <button type="button" aria-pressed={query === "bacon"} onClick={()=>{setQuery("bacon");setOnlyCombos(false);}}>Bacon</button>
      <button type="button" aria-pressed={onlyCombos} onClick={()=>{setQuery("combo");setOnlyCombos(true);}}>Combos</button>
      <button type="button" aria-pressed={budgetInput === "5000"} onClick={()=>{setQuery("");setBudgetInput("5000");setOnlyCombos(false);}}>Até R$ 50</button>
    </div>
    <label className={styles.offerQueryLabel} htmlFor="dfl-assist-ingredients">Descreva seu pedido ou procure um ingrediente</label>
    <div className={styles.offerSearchRow}>
      <input id="dfl-assist-ingredients" className={styles.offerQuery} type="search" autoComplete="off" maxLength={100}
        placeholder="Ex.: combo com frango até R$ 50" value={query}
        onChange={e=>setQuery(e.target.value)}
        onKeyDown={e=>{if(e.key==="Enter" && query.trim()){e.preventDefault();onFindProduct(query);}}}/>
      <button type="button" className={styles.offerSearchAction} disabled={!query.trim()} onClick={()=>onFindProduct(query)}>Ver no cardápio</button>
    </div>
    {(intent.budget !== null || intent.people !== null) && <p className={styles.offerIntent} role="status">
      Entendi na frase: {intent.people !== null ? `${intent.people} pessoa(s)` : ""}{intent.people !== null && intent.budget !== null ? " · " : ""}{intent.budget !== null ? `até ${currency(intent.budget)}` : ""}. A frase tem prioridade sobre esses filtros.
    </p>}
    {intent.hasExclusion && <p className={styles.offerSafety}>Restrições ou ingredientes que deseja evitar: confira a composição com a equipe antes de pedir. A busca não comprova ausência de ingredientes.</p>}
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
    <div className={styles.offerFilterFooter}>
      <label className={styles.offerToggle}><input type="checkbox" checked={onlyCombos} onChange={e=>setOnlyCombos(e.target.checked)}/> Mostrar somente combos</label>
      <button type="button" className={styles.offerClearFilters} onClick={clearFilters} disabled={!query && !budgetInput && !onlyCombos && people === 2}>Limpar filtros</button>
    </div>
    {!validBudget ? <p className={styles.offerNotice}>Confira o orçamento informado.</p> :
     loading ? <p className={styles.offerNotice} role="status">Carregando sugestões do cardápio…</p> :
     !catalogReady ? <p className={styles.offerNotice} role="status">Cardápio online indisponível. Você ainda pode pesquisar ou falar com a equipe; não vou apresentar preços sem confirmação.</p> :
     offers.length ? <><ul className={styles.offerList}>{visibleOffers.map(({product,reason})=><li key={product.id}>
        <div className={styles.offerImage}>{product.image ? <CatalogImage src={product.image} alt={product.name} sizes="72px" /> : <span aria-hidden="true">DFL</span>}</div>
        <div className={styles.offerCopy}><strong>{product.name}</strong><b className={styles.offerPrice}>{currency(product.price)}</b><small>{product.bundleItems?.length ? "Confira os itens e a composição do combo" : reason}</small></div>
        <button type="button" onClick={()=>onFindProduct(product.name)} aria-label={`Encontrar ${product.name} no cardápio`}>Ver <span className={styles.offerButtonLabel}>produto</span></button>
      </li>)}</ul>{offers.length > 2 && <button type="button" aria-expanded={showAllOffers}
        onClick={()=>setShowAllOffers(value=>!value)}
        style={{width:"100%",minHeight:44,marginTop:8,border:"1px solid #ddcba9",borderRadius:12,background:"#fffaf0",color:"#45331c",fontSize:13,fontWeight:850,cursor:"pointer"}}>
        {showAllOffers ? "Mostrar menos sugestões" : `Ver mais ${offers.length-2} sugestões`}
      </button>}</> :
     <div className={styles.offerRecovery}>
       <p className={styles.offerNotice}>Não encontrei opções confirmadas para esses filtros. Experimente outra busca, aumente o orçamento ou desmarque combos.</p>
       {discoveryHints.length > 0 && <div className={styles.offerDiscovery} aria-label="Alternativas para explorar no cardápio">
         <small>Produtos com nomes parecidos — confira preço e filtros:</small>
         {discoveryHints.map(name => <button type="button" key={name} onClick={() => onFindProduct(name)}>{name}</button>)}
       </div>}
     </div>}
    {catalogReady && validBudget && <p className={styles.offerCount} role="status">{offers.length} {offers.length===1 ? "sugestão" : "sugestões"} do catálogo confirmado</p>}
    <p className={styles.offerNotice}>Sugestões não reservam itens. Confira os ingredientes, o preço e a disponibilidade na finalização.</p>
  </section>;
}
// DFL-R33-ASSIST-RECOVERY
