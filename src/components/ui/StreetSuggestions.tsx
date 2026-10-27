"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./StreetSuggestions.module.css";

type Suggestion = { name: string; city: string; state: string };
type ResponseBody = { ok?: boolean; suggestions?: Suggestion[]; code?: string };
// R28: somente nomes publicos das ruas, cache de sessao limitado; nunca persiste enderecos.
const STREET_CACHE_TTL = 120_000;
const streetMemory = new Map<string, { at: number; items: Suggestion[] }>();

/** Sugestao opcional. Digitar a rua manualmente continua funcionando. */
export function StreetSuggestions({ street, district, onSelect }: {
  street: string; district: string; onSelect: (street: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const lastPickedRef = useRef("");
  const enabled = process.env.NEXT_PUBLIC_DFL_STREET_SUGGEST_ENABLED === "true";
  useEffect(() => {
    setSuggestions([]);
    setNotice("");
    if (!enabled || street.trim().length < 3 || district.trim().length < 3) {
      setBusy(false);
      return;
    }
    const cacheKey = `${district.trim().toLocaleLowerCase("pt-BR")}|${street.trim().toLocaleLowerCase("pt-BR")}`;
    if (lastPickedRef.current === cacheKey) { setBusy(false); return; }
    const cached = streetMemory.get(cacheKey);
    if (cached && Date.now() - cached.at < STREET_CACHE_TTL) {
      setSuggestions(cached.items);
      setBusy(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setBusy(true);
      try {
        const response = await fetch("/api/address/street-suggest", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ street: street.trim(), district: district.trim() }),
          signal: controller.signal,
        });
        if (!response.ok) {
          if (!controller.signal.aborted) setNotice("Não foi possível buscar ruas. Você pode digitar manualmente.");
          return;
        }
        const data = await response.json() as ResponseBody;
        if (!controller.signal.aborted && data.ok && Array.isArray(data.suggestions)) {
          const filtered = data.suggestions.filter(item =>
            item && typeof item.name === "string" && item.name.length > 2 &&
            item.city === "Patos de Minas" && item.state === "MG",
          ).slice(0, 5);
          streetMemory.set(cacheKey, { at: Date.now(), items: filtered });
          if (streetMemory.size > 32) streetMemory.delete(streetMemory.keys().next().value!);
          setSuggestions(filtered);
        }
      } catch (error) {
        if (!controller.signal.aborted) setNotice("Busca indisponível. Informe a rua manualmente.");
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    }, 380);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [enabled, street, district]);
  if (!enabled) return null;
  return (
    <div className={styles.wrap} aria-live="polite">
      {busy && <small>Procurando ruas…</small>}
      {notice && <small>{notice}</small>}
      {suggestions.length > 0 && <div className={styles.suggestions} aria-label="Sugestões de ruas">
        <small>Encontramos estas ruas. Confira antes de selecionar:</small>
        {suggestions.map(item => <button type="button" key={item.name} onClick={() => {
          lastPickedRef.current = `${district.trim().toLocaleLowerCase("pt-BR")}|${item.name.trim().toLocaleLowerCase("pt-BR")}`;
          onSelect(item.name); setSuggestions([]); setNotice("");
        }}>{item.name}</button>)}
      </div>}
    </div>
  );
}
