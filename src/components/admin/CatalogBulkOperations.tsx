"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Layers3, PauseCircle, PlayCircle, ShieldCheck } from "lucide-react";
import type { Product } from "@/data/products";
import type { CatalogCategory } from "@/lib/catalogCategories";
import { mutateCatalog } from "@/lib/adminCatalogClient";
import { buildBulkAvailabilityPlan, BULK_MAX_ITEMS } from "@/lib/catalogBulkAvailability";
import styles from "./CatalogBulkOperations.module.css";

type Props = { products: Product[]; categories: CatalogCategory[]; source: string };
type Mode = "pause" | "resume";

export function CatalogBulkOperations({ products, categories, source }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("pause");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [includeLinked, setIncludeLinked] = useState(true);
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const nextAvailable = mode === "resume";
  const ready = source === "hybrid";
  const normalizedQuery = search.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  const eligible = useMemo(() => products.filter(product => product.disponivel !== nextAvailable &&
    (category === "all" || product.category === category) &&
    (!normalizedQuery || `${product.name} ${product.id}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(normalizedQuery))),
    [products, nextAvailable, category, normalizedQuery]);
  const selectedValid = useMemo(() => selected.filter(id => products.some(product => product.id === id && product.disponivel !== nextAvailable)), [products, selected, nextAvailable]);
  const plan = useMemo(() => buildBulkAvailabilityPlan(products, selectedValid, nextAvailable, includeLinked),
    [products, selectedValid, nextAvailable, includeLinked]);
  const affectedNames = plan.uncoveredCombos.map(product => product.name).join(", ");
  useEffect(() => { if (review) setReview(false); }, [products, source]);
  const reset = (nextMode: Mode) => { setMode(nextMode); setSelected([]); setReview(false); setFeedback(""); setSearch(""); };
  const toggle = (id: string) => {
    if (busy) return;
    setReview(false); setFeedback("");
    setSelected(current => current.includes(id) ? current.filter(value => value !== id) : current.length < BULK_MAX_ITEMS ? [...current, id] : current);
  };
  const selectVisible = () => {
    if (busy) return;
    setReview(false); setFeedback("");
    setSelected(current => [...new Set([...current, ...eligible.map(item => item.id)])].slice(0, BULK_MAX_ITEMS));
  };
  const save = async () => {
    if (!ready || !review || !plan.valid || busy) return;
    setBusy(true); setFeedback("");
    try {
      await mutateCatalog({ action: "bulkAvailability", enabled: nextAvailable, items: plan.changes });
      setSelected([]); setReview(false);
      setFeedback(`${plan.changes.length} produto(s) ${nextAvailable ? "reativado(s)" : "pausado(s)"}. Catálogo atualizado.`);
    } catch (error) {
      setReview(false);
      setFeedback(error instanceof Error ? error.message : "Não foi possível aplicar o lote. Nenhum ajuste parcial foi confirmado.");
    } finally { setBusy(false); }
  };
  return <section className={styles.root} aria-label="Central de disponibilidade em massa">
    <button type="button" className={styles.heading} aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <span className={styles.emblem}><Layers3 size={20}/></span>
      <span className={styles.title}><strong>Disponibilidade em massa</strong><small>Pause ou reative produtos com prévia e confirmação</small></span>
      <span className={styles.metric}>{products.filter(p => !p.disponivel).length} pausados</span><ChevronDown className={styles.chevron} data-open={open} size={17}/>
    </button>
    {open && <div className={styles.content}>
      {!ready && <div className={styles.warning}><AlertTriangle size={17}/><span>O catálogo remoto ainda não foi confirmado. Operações em lote bloqueadas para não criar documentos incompletos.</span></div>}
      <div className={styles.mode} role="group" aria-label="Tipo de alteração">
        <button type="button" data-active={mode === "pause"} disabled={busy} onClick={() => reset("pause")}><PauseCircle size={16}/> Pausar produtos</button>
        <button type="button" data-active={mode === "resume"} disabled={busy} onClick={() => reset("resume")}><PlayCircle size={16}/> Reativar produtos</button>
      </div>
      <label className={styles.searchLabel}>Encontrar produto<input type="search" autoComplete="off" placeholder="Busque por nome ou código" value={search} onChange={event => { setSearch(event.target.value); setReview(false); }}/></label>
      <div className={styles.categories} aria-label="Filtrar por categoria"><button type="button" data-active={category === "all"} onClick={() => {setCategory("all");setReview(false);}}>Todas</button>
        {categories.map(item => <button type="button" key={item.id} data-active={category === item.id} onClick={() => {setCategory(item.id);setReview(false);}}>{item.label}</button>)}
      </div>
      <div className={styles.toolbar}><strong>{eligible.length} elegíveis · {selectedValid.length} selecionados</strong><div><button type="button" disabled={busy || !ready || !eligible.length} onClick={selectVisible}>Selecionar exibidos</button><button type="button" disabled={busy || !selected.length} onClick={() => {setSelected([]);setReview(false);}}>Limpar</button></div></div>
      <div className={styles.list} role="group" aria-label="Selecionar produtos">
        {eligible.slice(0, 80).map(item => <label className={styles.item} key={item.id}>
          <input type="checkbox" checked={selectedValid.includes(item.id)} disabled={!ready || busy || (!selectedValid.includes(item.id) && selectedValid.length >= BULK_MAX_ITEMS)} onChange={() => toggle(item.id)}/>
          <span><strong>{item.name}</strong><small>{categories.find(c => c.id === item.category)?.label ?? item.category}</small></span>
          {item.bundleItems?.length ? <em>Combo</em> : null}
        </label>)}
        {!eligible.length && <div className={styles.empty}>Nenhum produto para {mode === "pause" ? "pausar" : "reativar"} neste filtro.</div>}
        {eligible.length > 80 && <p className={styles.caption}>Mostrando os primeiros 80 itens. Refine a busca para encontrar outros produtos.</p>}
      </div>
      {mode === "pause" && <label className={styles.related}><input type="checkbox" checked={includeLinked} disabled={busy} onChange={event => {setIncludeLinked(event.target.checked);setReview(false);}}/><span><strong>Incluir combos dependentes</strong><small>Se um produto faz parte de um combo, recomendamos pausar também esse combo. Nunca altera itens sem sua confirmação.</small></span></label>}
      {plan.affectedCombos.length > 0 && <div className={styles.warning}><AlertTriangle size={18}/><span>{plan.affectedCombos.length} combo(s) dependem dos produtos selecionados. {plan.automaticallyIncluded.length} incluído(s) na prévia. {plan.uncoveredCombos.length ? `Continuariam disponíveis: ${affectedNames}.` : "Nenhum desses combos ficará ativo após o lote planejado."}</span></div>}
      {plan.message && selected.length > 0 && <div className={styles.warning}><AlertTriangle size={17}/><span>{plan.message}</span></div>}
      {feedback && <div role="status" className={styles.feedback}><CheckCircle2 size={17}/><span>{feedback}</span></div>}
      {review && plan.valid && <div className={styles.review} role="region" aria-label="Prévia do lote"><div><ShieldCheck size={21}/><strong>Revisão obrigatória</strong></div><p>Você vai {nextAvailable ? "reativar" : "pausar"} <b>{plan.changes.length} produto(s)</b> em uma única operação. A API confirmará novamente a disponibilidade antes da gravação.</p><ul>{plan.changes.slice(0, 10).map(change => <li key={change.id}>{products.find(p => p.id === change.id)?.name ?? change.id}</li>)}</ul>{plan.changes.length > 10 && <small>+ {plan.changes.length - 10} outros itens</small>}</div>}
      <div className={styles.footer}><small>Até {BULK_MAX_ITEMS} alterações por lote. Nenhuma ação ocorre sem confirmar.</small><div><button type="button" disabled={busy || !review} onClick={() => setReview(false)}>Voltar</button><button type="button" className={styles.main} disabled={!ready || busy || !plan.valid} onClick={() => {if(!review){setReview(true);setFeedback("");}else void save();}}>{busy ? "Aplicando..." : review ? `Confirmar ${plan.changes.length} alterações` : `Revisar ${plan.changes.length} alterações`}</button></div></div>
    </div>}
  </section>;
}
