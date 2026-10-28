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
  const [limit, setLimit] = useState(8);
  const catalog = useMemo(
    () => searchDistrictCatalog(query, configured, limit),
    [query, configured, limit],
  );
  const selectedInConfigured = configured.some(name =>
    name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim() ===
    query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim(),
  );
  return (
    <section className={styles.picker} data-source={catalog.source} aria-label="Escolher bairro da entrega">
      <button type="button" className={styles.toggle} aria-expanded={expanded} aria-controls="dfl-r38-district-results"
        onClick={() => { if (!expanded) onOpen(); setExpanded(value => !value); setLimit(8); }}>
        <span><strong>{expanded ? "Ocultar lista de bairros" : "Prefiro escolher o bairro na lista"}</strong>
          <small>{catalog.source === "configured" ? "Bairros cadastrados pela loja" : "Lista de referência — confirmar disponibilidade"}</small></span>
        <span className={styles.chevron} aria-hidden="true">{expanded ? "−" : "+"}</span>
      </button>
      {expanded && <div className={styles.results} id="dfl-r38-district-results">
        <p className={styles.notice}>
          {catalog.source === "configured"
            ? "Escolha um bairro cadastrado. O frete será consultado na tabela da loja."
            : "Não foi possível obter a lista cadastrada. Estes nomes são apenas sugestões; a loja confirmará a entrega e a taxa."}
        </p>
        <small className={styles.counter}>{query.trim() ? "Resultados para o que você digitou" : "Escolha um bairro ou digite para filtrar"} · {catalog.total} encontrado(s)</small>
        {catalog.results.length > 0 ? <div className={styles.list} aria-label="Bairros sugeridos">
          {catalog.results.map(name => <button type="button" key={name} data-selected={selectedInConfigured && name === query} onClick={() => {
            onSelect(name);
            setExpanded(false);
            setLimit(8);
          }}>{name}<span aria-hidden="true">›</span></button>)}
        </div> : <p className={styles.empty}>Nenhuma correspondência. Confira a escrita ou peça ajuda pelo WhatsApp. Você pode informar o bairro manualmente.</p>}
        {catalog.total > catalog.results.length && <button type="button" className={styles.more}
          onClick={() => setLimit(value => Math.min(80, value + 12))}>Mostrar mais bairros ({catalog.total - catalog.results.length})</button>}
        {catalog.total > 80 && catalog.results.length === 80 && <small>Digite parte do bairro para filtrar a lista completa.</small>}
      </div>}
    </section>
  );
}
// DFL-R38-DISTRICT-PICKER
