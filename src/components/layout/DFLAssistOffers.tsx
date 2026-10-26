"use client";
import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { CatalogImage } from "@/components/ui/CatalogImage";
import { useCatalog } from "@/hooks/useCatalog";
import { recommendDFLProducts } from "@/lib/dflAssistRecommendations";
import styles from "./DFLAssist.module.css";

type Props = { onFindProduct: (name: string) => void };
const currency = (value: number) => value.toLocaleString("pt-BR", {style:"currency", currency:"BRL"});
/** Recomenda apenas itens do catalogo atual; nunca cria ou altera pedido. */
export function DFLAssistOffers({ onFindProduct }: Props) {
  const { products, loading, error, source } = useCatalog();
  const [people, setPeople] = useState(2);
  const [query, setQuery] = useState("");
  const [budgetInput, setBudgetInput] = useState("");
  const [onlyCombos, setOnlyCombos] = useState(true);
  // Centavos inteiros: formato previsível no teclado Android, sem input numérico nativo.
  const budget = budgetInput ? Number(budgetInput) / 100 : undefined;
  const formatBudget = (cents: string) => cents ? currency(Number(cents) / 100) : "";
  const validBudget = budget === undefined || (Number.isFinite(budget) && budget >= 0);
  const catalogReady = !loading && !error && source === "hybrid";
  const offers = useMemo(() => catalogReady && validBudget
    ? recommendDFLProducts(products, { people, budget, onlyCombos, query }, 4)
    : [], [catalogReady, validBudget, products, people, budget, onlyCombos, query]);
  return <section className={styles.offers} aria-label="Sugestões do DFL Assist">
    <h3 className={styles.offerTitle}>Vamos encontrar seu lanche?</h3>
    <label className={styles.offerQueryLabel} htmlFor="dfl-assist-ingredients">O que você está com vontade de comer?</label>
    <input id="dfl-assist-ingredients" className={styles.offerQuery} type="search" autoComplete="off" maxLength={100} placeholder="Ex.: frango, bacon, sanduíche" value={query} onChange={e=>setQuery(e.target.value)} />
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
    <label className={styles.offerToggle}><input type="checkbox" checked={onlyCombos} onChange={e=>setOnlyCombos(e.target.checked)}/> Priorizar combos</label>
    {!validBudget ? <p className={styles.offerNotice}>Confira o orçamento informado.</p> :
     !catalogReady ? <p className={styles.offerNotice} role="status">Não foi possível confirmar o cardápio atualizado. Você ainda pode pesquisar ou falar com a equipe.</p> :
     offers.length ? <ul className={styles.offerList}>{offers.map(({product,reason,estimatedServings})=><li key={product.id}>
        <div className={styles.offerImage}>{product.image ? <CatalogImage src={product.image} alt={product.name} sizes="72px" /> : <span aria-hidden="true">DFL</span>}</div>
        <div className={styles.offerCopy}><strong>{product.name}</strong><b className={styles.offerPrice}>{currency(product.price)}</b><small>{estimatedServings!==null ? `${estimatedServings} lanche(s) · confira a composição` : reason}</small></div>
        <button type="button" onClick={()=>onFindProduct(product.name)} aria-label={`Encontrar ${product.name} no cardápio`}>Ver <span className={styles.offerButtonLabel}>produto</span></button>
      </li>)}</ul> :
     <p className={styles.offerNotice}>Não encontrei opções confirmadas para esses filtros. Experimente outra busca, aumente o orçamento ou desmarque combos.</p>}
    <p className={styles.offerNotice}>Sugestões não reservam itens. Preço e disponibilidade são conferidos novamente na finalização.</p>
  </section>;
}
