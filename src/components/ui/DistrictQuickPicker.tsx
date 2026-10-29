"use client";

import { useMemo, useState } from "react";
import { searchDistrictCatalog } from "@/lib/districtCatalog";
import styles from "./DistrictQuickPicker.module.css";

/** R38: escolha assistida. Nao valida cobertura nem calcula frete; isso continua no checkout. */
export function DistrictQuickPicker({ query, configured, onSelect, onOpen }: {
  query: string;
  configured: readonly string[];
  onSelect: (name: string) => void;
  onOpen: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  // DFL-R43-AUTOCOMPLETE: exibe sugestoes ao digitar sem exigir abrir a lista.
  const [dismissedQuery, setDismissedQuery] = useState("");
  const [limit, setLimit] = useState(8);
  const catalog = useMemo(
    () => searchDistrictCatalog(query, configured, limit),
    [query, configured, limit],
  );
  const selectedInConfigured = configured.some(name =>
    name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim() ===
    query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim(),
  );
  const typed = query.trim();
  const automatic = typed.length >= 2 && typed !== dismissedQuery && !expanded && !selectedInConfigured;
  const showResults = expanded || automatic;
  const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
  const isDirectMatch = (name: string) => {
    const candidate = normalized(name);
    const search = normalized(query);
    return candidate.startsWith(search) || (search.length >= 3 && (candidate.includes(search) || candidate.split(" ").some(word => word.startsWith(search))));
  };
  const titleCase = (name: string) => name.toLocaleLowerCase("pt-BR").replace(/(^|[\s-])([\p{L}])/gu, (_all, before: string, letter: string) => before + letter.toLocaleUpperCase("pt-BR"));
  return (
    <section className={styles.picker} data-source={catalog.source} aria-label="Escolher bairro da entrega">
      {/* DFL-R44-DISTRICT-CLARITY: evidencia quando o texto bate com bairro configurado. */}
      {selectedInConfigured && query.trim().length > 1 && <p role="status" style={{margin:"0 0 8px",padding:"8px 11px",borderRadius:10,background:"#effaf1",color:"#256b36",fontSize:12,fontWeight:800}}>
        ✓ Bairro encontrado na lista da loja. O frete sera confirmado no checkout.
      </p>}
      {automatic && !selectedInConfigured && <p role="status" style={{fontSize:12,margin:"0 0 8px",fontWeight:750,color:"#5f503a"}}>
        {catalog.total ? `Escolha uma sugestão abaixo (${catalog.total} resultado${catalog.total === 1 ? "" : "s"}).` : "Nenhum bairro correspondente. Tente outra escrita ou abra a lista."}
      </p>}
      <button type="button" className={styles.toggle} aria-expanded={expanded} aria-controls="dfl-r38-district-results"
        onClick={() => { if (!expanded) onOpen(); setDismissedQuery(query.trim()); setExpanded(value => !value); setLimit(8); }}>
        <span><strong>{expanded ? "Ocultar lista de bairros" : "Ver todos os bairros"}</strong>
          <small>{catalog.source === "configured" ? "Bairros cadastrados pela loja" : "Lista de referência — confirmar disponibilidade"}</small></span>
        <span className={styles.chevron} aria-hidden="true">{expanded ? "−" : "+"}</span>
      </button>
      {showResults && <div className={styles.results} id="dfl-r38-district-results">
        <p className={styles.notice}>
          {catalog.source === "configured"
            ? "Escolha um bairro cadastrado. O frete será consultado na tabela da loja."
            : "Não foi possível obter a lista cadastrada. Estes nomes são apenas sugestões; a loja confirmará a entrega e a taxa."}
        </p>
        <small className={styles.counter}>{query.trim() ? "Resultados para o que você digitou" : "Escolha um bairro ou digite para filtrar"} · {catalog.total} encontrado(s)</small>
        {catalog.results.length > 0 ? <div className={styles.list} aria-label="Bairros sugeridos">
          {catalog.results.map(name => <button type="button" key={name} data-selected={selectedInConfigured && normalized(name) === normalized(query)} onClick={() => {
            onSelect(name);
            setExpanded(false);
            setDismissedQuery(name);
            setLimit(8);
          }} aria-label={`Selecionar bairro ${titleCase(name)}`}><span>{titleCase(name)}{typed.length >= 4 && !isDirectMatch(name) && <small style={{display:"block",fontWeight:600,opacity:.75}}>Você quis dizer este bairro?</small>}</span><span aria-hidden="true">›</span></button>)}
        </div> : <p className={styles.empty}>Não encontramos um bairro parecido. Tente apenas parte do nome, confira a escrita ou peça ajuda pelo WhatsApp.</p>}
        {catalog.total > catalog.results.length && <button type="button" className={styles.more}
          onClick={() => setLimit(value => Math.min(80, value + 12))}>Mostrar mais bairros ({catalog.total - catalog.results.length})</button>}
        {catalog.total > 80 && catalog.results.length === 80 && <small>Digite parte do bairro para filtrar a lista completa.</small>}
      </div>}
    </section>
  );
}
// DFL-R38-DISTRICT-PICKER
