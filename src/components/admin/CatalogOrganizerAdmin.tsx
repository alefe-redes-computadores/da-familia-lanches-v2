"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, RotateCcw, Save, SlidersHorizontal, EyeOff } from "lucide-react";
import { useCatalog } from "@/hooks/useCatalog";
import { useCatalogCategories } from "@/hooks/useCatalogCategories";
import { mutateCatalog } from "@/lib/adminCatalogClient";
import { readPublicCatalog } from "@/lib/publicCatalogClient";
import { CatalogImage } from "@/components/ui/CatalogImage";
import { haptic } from "@/lib/haptics";
import { buildCatalogSortPlan, moveCatalogItem, sortCatalogIds, type CatalogSortMode } from "@/lib/catalogOrderPlan";
import styles from "./CatalogOrganizerAdmin.module.css";

type Draft = { category: string; ids: string[] };
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function CatalogOrganizerAdmin() {
  const { products, loading: catalogLoading } = useCatalog();
  const { categories } = useCatalogCategories();
  const [category, setCategory] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showPaused, setShowPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [message, setMessage] = useState("");
  const visibleCategories = useMemo(() => categories.filter(item => item.active), [categories]);
  const active = category && visibleCategories.some(item => item.id === category)
    ? category : visibleCategories[0]?.id ?? "";
  const productsInCategory = useMemo(() => products.filter(item => item.category === active), [products, active]);
  const published = useMemo(() => [...productsInCategory].filter(item => item.disponivel !== false)
    .sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name, "pt-BR")), [productsInCategory]);
  const paused = useMemo(() => [...productsInCategory].filter(item => item.disponivel === false)
    .sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name, "pt-BR")), [productsInCategory]);
  const publishedIds = published.map(item => item.id);
  const effective = draft?.category === active ? draft.ids : publishedIds;
  const validOrder = effective.length === published.length &&
    new Set(effective).size === published.length &&
    effective.every(id => publishedIds.includes(id));
  const dirty = validOrder && effective.some((id, index) => id !== publishedIds[index]);
  const byId = new Map(published.map(item => [item.id, item]));
  const rows = validOrder ? effective.flatMap(id => { const item = byId.get(id); return item ? [item] : []; }) : published;

  const changeCategory = (next: string) => {
    if (next === active || busyRef.current) return;
    if (dirty && !window.confirm("Descartar a ordenação ainda não salva e trocar de categoria?")) return;
    setCategory(next);
    setDraft(null);
    setMessage("");
  };
  const move = (id: string, direction: -1 | 1) => {
    if (busyRef.current || catalogLoading) return;
    const next = moveCatalogItem(rows.map(item => item.id), id, direction);
    setDraft({ category: active, ids: next });
    setMessage("Nova ordem em revisão. Salve para atualizar o cardápio público.");
    haptic("step");
  };
  const sortBy = (mode: CatalogSortMode) => {
    if (busyRef.current || catalogLoading) return;
    const ids = sortCatalogIds(rows, mode);
    setDraft({ category: active, ids });
    setMessage("Prévia aplicada apenas no Admin. Confira e salve quando estiver certo.");
    haptic("step");
  };
  const restore = () => {
    if (busyRef.current) return;
    setDraft(null);
    setMessage("Prévia descartada. A ordem pública continua como estava.");
    haptic("step");
  };
  const save = async () => {
    if (busyRef.current || !dirty || !validOrder || catalogLoading || !active) return;
    const submitted = rows.map(item => item.id);
    const plan = buildCatalogSortPlan(submitted, paused.map(item => item.id));
    // Evita gerar documento parcial (somente sortOrder) para item que só
    // existe no fallback local e ainda não foi publicado no catálogo remoto.
    const remoteIds = new Set((readPublicCatalog().payload?.products ?? []).map(item => String(item.id ?? "")));
    const unpublished = plan.filter(item => !remoteIds.has(item.id));
    if (unpublished.length > 0) {
      setMessage(`${unpublished.length} produto(s) ainda não estão no catálogo remoto. Salve esses produtos no editor antes de reorganizar; nenhuma alteração foi enviada.`);
      return;
    }
    if (plan.length > 200) {
      setMessage("Esta categoria ultrapassou o limite seguro de itens por operação. Nenhuma mudança enviada.");
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setMessage("");
    try {
      await mutateCatalog({ action: "reorderProducts", items: plan });
      setDraft(null);
      setMessage("Ordem salva. Produtos pausados mantidos no final da fila, sem reativação.");
      haptic("success");
    } catch (error) {
      console.error("[catalog/organizer]", error);
      setMessage("Não foi possível salvar. Sua prévia foi mantida para tentar novamente.");
      haptic("error");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return <section className={styles.root} aria-label="Organizador do cardápio">
    <header className={styles.header}>
      <div><span>VITRINE PÚBLICA</span><h3><SlidersHorizontal size={18}/> Organizar produtos</h3>
        <p>Faça a sequência, revise e salve de uma vez. Mover um item não grava imediatamente no banco.</p></div>
      <b>{published.length} visíveis</b>
    </header>
    {visibleCategories.length === 0 ? <p className={styles.empty}>Nenhuma categoria ativa para organizar.</p> : <>
      <div className={styles.categoryChips} role="group" aria-label="Selecionar categoria">
        {visibleCategories.map(item => <button type="button" key={item.id} data-active={item.id === active} aria-pressed={item.id === active} disabled={busy} onClick={() => changeCategory(item.id)}>{item.label}</button>)}
      </div>
      <div className={styles.tools}>
        <div><strong>Organização rápida</strong><small>Experimente sem alterar a vitrine</small></div>
        <div className={styles.sortActions}>
          <button type="button" disabled={busy || catalogLoading || rows.length < 2} onClick={() => sortBy("price-asc")}>Menor preço</button>
          <button type="button" disabled={busy || catalogLoading || rows.length < 2} onClick={() => sortBy("price-desc")}>Maior preço</button>
          <button type="button" disabled={busy || catalogLoading || rows.length < 2} onClick={() => sortBy("alpha")}>A–Z</button>
        </div>
      </div>
      <div className={styles.orderFeedback} data-dirty={dirty} role="status">
        <span>{dirty ? "Alterações ainda não publicadas" : "Vitrine sincronizada com a ordem atual"}</span>
        <strong>{rows.length} item(ns) · {paused.length} pausado(s)</strong>
      </div>
      <div className={styles.list} aria-label="Prévia da sequência dos produtos">
        {rows.map((item, index) => <article key={item.id}>
          <b>{index + 1}</b><CatalogImage src={item.image} alt="" sizes="50px" quality={65}/>
          <div><strong>{item.name}</strong><span>{money(item.price)}</span></div>
          <nav aria-label={`Posição de ${item.name}`}>
            <button type="button" disabled={busy || catalogLoading || index === 0} onClick={() => move(item.id, -1)} aria-label={`Subir ${item.name}`}><ArrowUp size={17}/></button>
            <button type="button" disabled={busy || catalogLoading || index === rows.length - 1} onClick={() => move(item.id, 1)} aria-label={`Descer ${item.name}`}><ArrowDown size={17}/></button>
          </nav>
        </article>)}
        {!rows.length && <p className={styles.empty}>Nenhum produto disponível nesta categoria.</p>}
      </div>
      <div className={styles.pausedToggle}>
        <button type="button" aria-expanded={showPaused} aria-controls="dfl-catalog-paused" onClick={() => setShowPaused(v => !v)}><EyeOff size={15}/> {showPaused ? "Ocultar pausados" : "Ver pausados"} ({paused.length})</button>
        <span>Quando reativados, aparecem após os itens já organizados.</span>
      </div>
      {showPaused && <div id="dfl-catalog-paused" className={styles.pausedList}>
        {paused.length ? paused.map(item => <article key={item.id}><CatalogImage src={item.image} alt="" sizes="48px" quality={60}/><div><strong>{item.name}</strong><span>Pausado · {money(item.price)}</span></div></article>) : <p>Nenhum produto pausado nesta categoria.</p>}
      </div>}
      {message && <div className={styles.msg} role="status">{message}</div>}
      <div className={styles.actions}>
        <button type="button" disabled={busy || !dirty} onClick={restore}><RotateCcw size={16}/> Desfazer prévia</button>
        <button type="button" className={styles.saveButton} disabled={busy || catalogLoading || !dirty || !validOrder} onClick={() => void save()}><Save size={16}/> {busy ? "Salvando..." : "Salvar ordem"}</button>
      </div>
    </>}
  </section>;
}
