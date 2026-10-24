"use client";

import { useMemo, useState } from "react";
import { Activity, AlertCircle, RefreshCw, ThumbsUp, MessageSquareText } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import styles from "./CustomerExperienceAdmin.module.css";

type Rating = "muito_facil" | "tranquilo" | "melhorar";
type Feedback = { id: string; rating: Rating; reason: string; comment: string };
type View = "all" | "positive" | "improve";

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function parseFeedback(value: unknown): Feedback[] {
  if (!Array.isArray(value)) return [];
  const used = new Set<string>();
  const results: Feedback[] = [];
  for (const entry of value.slice(0, 100)) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const id = clean(item.id, 130);
    const rating = item.rating;
    if (!id || used.has(id) || (rating !== "muito_facil" && rating !== "tranquilo" && rating !== "melhorar")) continue;
    used.add(id);
    results.push({id, rating, reason: clean(item.reason, 80), comment: clean(item.comment, 500)});
  }
  return results;
}
function ratingName(value: Rating) {
  return value === "melhorar" ? "Pode melhorar" : value === "muito_facil" ? "Muito fácil" : "Tranquilo";
}

/** Usa somente GET autenticado sob demanda; a API já limita a 100 respostas. */
export function CustomerExperienceAdmin() {
  const user = useAuthStore((state) => state.currentUser);
  const [items, setItems] = useState<Feedback[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("all");
  const [showAll, setShowAll] = useState(false);

  const positives = useMemo(() => items.filter((item) => item.rating !== "melhorar").length, [items]);
  const percentage = items.length ? Math.round(positives / items.length * 100) : 0;
  const reasons = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) if (item.reason) counts.set(item.reason, (counts.get(item.reason) || 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR")).slice(0, 5);
  }, [items]);
  const selected = useMemo(() => items.filter((item) => view === "all" || (view === "positive" ? item.rating !== "melhorar" : item.rating === "melhorar")), [items, view]);
  const commented = selected.filter((item) => item.comment);
  const displayed = showAll ? commented : commented.slice(0, 8);

  async function load() {
    if (busy) return;
    if (!user) { setError("Entre como administrador para consultar avaliações."); return; }
    setBusy(true);
    setError("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/experience-feedback", {
        headers: {authorization: `Bearer ${token}`},
        cache: "no-store",
        signal: controller.signal,
      });
      const payload: unknown = await response.json();
      if (!response.ok || !payload || typeof payload !== "object" || !("ok" in payload) || (payload as {ok?: unknown}).ok !== true) {
        throw new Error("Não foi possível consultar as avaliações agora.");
      }
      const data = payload as {items?: unknown};
      if (!Array.isArray(data.items)) throw new Error("O servidor retornou avaliações em formato inesperado.");
      setItems(parseFeedback(data.items));
      setLoaded(true);
      setShowAll(false);
    } catch (cause) {
      const interrupted = cause instanceof Error && cause.name === "AbortError";
      setError(interrupted ? "A consulta demorou demais. Confira a conexão e tente novamente." : "Falha ao carregar avaliações. Os dados anteriores foram preservados.");
    } finally {
      window.clearTimeout(timeout);
      setBusy(false);
    }
  }

  return <section className={styles.root} aria-label="Experiência dos clientes">
    <header className={styles.head}>
      <div className={styles.heading}><span><Activity size={15} /> EXPERIÊNCIA DOS CLIENTES</span><h3>{loaded ? "Voz do cliente" : "Feedback da jornada"}</h3><small>Consulta sob demanda · até 100 respostas recentes · sem novas escutas</small></div>
      <button type="button" className={styles.refresh} disabled={busy} onClick={() => void load()}><RefreshCw size={16} className={busy ? styles.spin : ""}/>{busy ? "Consultando…" : loaded ? "Atualizar" : "Ver feedback"}</button>
    </header>
    {error && <p className={styles.error} role="alert"><AlertCircle size={16} />{error}</p>}
    {loaded && <>
      <div className={styles.metrics}>
        <div><ThumbsUp size={16}/><b>{percentage}%</b><span>avaliações positivas</span></div>
        <div><MessageSquareText size={16}/><b>{items.length}</b><span>respostas recentes</span></div>
        <div><AlertCircle size={16}/><b>{items.length - positives}</b><span>pedidos de melhoria</span></div>
      </div>
      <small className={styles.scope}>Percentual baseado apenas nas {items.length} avaliações consultadas, não em todos os clientes ou pedidos.</small>
      {reasons.length > 0 && <div className={styles.reasons}><strong>Motivos mais citados</strong><div>{reasons.map(([reason, count]) => <span key={reason}>{reason} <b>{count}</b></span>)}</div></div>}
      <div className={styles.filters} role="group" aria-label="Filtrar avaliações">
        {([ ["all", "Todas"], ["positive", "Positivas"], ["improve", "A melhorar"] ] as const).map(([key, title]) => <button type="button" key={key} aria-pressed={view === key} onClick={() => {setView(key);setShowAll(false)}}>{title}</button>)}
      </div>
      <p className={styles.count} role="status">{selected.length} {selected.length === 1 ? "avaliação" : "avaliações"} neste filtro · {commented.length} com comentário</p>
      {displayed.length ? <div className={styles.comments}>{displayed.map((item) => <article key={item.id}><b data-negative={item.rating === "melhorar"}>{ratingName(item.rating)}</b>{item.reason && <small>{item.reason}</small>}<p>{item.comment}</p></article>)}</div> : <div className={styles.empty}>Nenhum comentário escrito neste filtro.</div>}
      {commented.length > displayed.length && <button type="button" className={styles.more} onClick={() => setShowAll(true)}>Exibir mais {commented.length - displayed.length} comentários</button>}
      {showAll && commented.length > 8 && <button type="button" className={styles.more} onClick={() => setShowAll(false)}>Mostrar menos</button>}
    </>}
  </section>;
}
