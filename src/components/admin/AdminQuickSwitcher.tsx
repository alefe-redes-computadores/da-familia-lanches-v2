"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Keyboard, Search, X } from "lucide-react";
import styles from "./AdminQuickSwitcher.module.css";

export type AdminQuickTarget =
  | "cozinha" | "agendados" | "expedicao" | "concluidos" | "cancelados"
  | "catalogo" | "operacao" | "agendamentos" | "frete" | "cupons"
  | "fidelidade" | "gestao";

type QuickAction = "attention" | "notifications" | "store";
type Entry = {
  id: AdminQuickTarget | QuickAction;
  name: string;
  hint: string;
  group: "Pedidos" | "Loja e catálogo" | "Ferramentas";
  terms: string;
  target?: AdminQuickTarget;
  action?: QuickAction;
};

const ENTRIES: ReadonlyArray<Entry> = [
  { id:"cozinha", name:"Cozinha", hint:"Novos pedidos e produção", group:"Pedidos", terms:"pendente preparo fila", target:"cozinha" },
  { id:"attention", name:"Pedidos que precisam de atenção", hint:"Ir direto às prioridades da cozinha", group:"Pedidos", terms:"urgentes atrasados problemas alerta", action:"attention" },
  { id:"agendados", name:"Agendados", hint:"Pedidos futuros e horários", group:"Pedidos", terms:"agenda calendário programação", target:"agendados" },
  { id:"expedicao", name:"Expedição", hint:"Prontos e saídas para entrega", group:"Pedidos", terms:"motoboy rota retirada entrega", target:"expedicao" },
  { id:"concluidos", name:"Histórico", hint:"Pedidos concluídos", group:"Pedidos", terms:"finalizados fechados consulta", target:"concluidos" },
  { id:"cancelados", name:"Cancelados", hint:"Pedidos cancelados", group:"Pedidos", terms:"cancelamento motivos", target:"cancelados" },
  { id:"catalogo", name:"Catálogo", hint:"Produtos, combos e disponibilidade", group:"Loja e catálogo", terms:"lanche cardápio editor pausar adicionais preços", target:"catalogo" },
  { id:"operacao", name:"Funcionamento da loja", hint:"Horários e abertura", group:"Loja e catálogo", terms:"abrir fechar manutenção status", target:"operacao" },
  { id:"store", name:"Controle rápido da loja", hint:"Abrir painel de operação rápida", group:"Loja e catálogo", terms:"abertura fechar manutenção agora", action:"store" },
  { id:"agendamentos", name:"Configurar agendamentos", hint:"Capacidade e horários futuros", group:"Loja e catálogo", terms:"dias horas capacidade", target:"agendamentos" },
  { id:"frete", name:"Entrega e frete", hint:"Bairros, taxas e frete grátis", group:"Loja e catálogo", terms:"preço taxa bairros delivery", target:"frete" },
  { id:"cupons", name:"Cupons e promoções", hint:"Campanhas e descontos", group:"Ferramentas", terms:"cupom promoção oferta campanhas", target:"cupons" },
  { id:"fidelidade", name:"Fidelidade", hint:"Recompensas dos clientes", group:"Ferramentas", terms:"pontos vantagens recompensas", target:"fidelidade" },
  { id:"gestao", name:"Saúde e diagnóstico", hint:"Operação, leituras e relatórios", group:"Ferramentas", terms:"saúde desempenho diagnóstico firestore monitoramento", target:"gestao" },
  { id:"notifications", name:"Notificações", hint:"Permissões e status do push", group:"Ferramentas", terms:"avisos alerta celular som vibração", action:"notifications" },
];

const simplify = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function AdminQuickSwitcher({
  open, onClose, currentTab, onNavigate, onAttention, onNotifications, onStore,
  counts,
}: {
  open: boolean;
  onClose: () => void;
  currentTab: AdminQuickTarget;
  onNavigate: (target: AdminQuickTarget) => void;
  onAttention: () => void;
  onNotifications: () => void;
  onStore: () => void;
  counts: { cozinha: number; agendados: number; expedicao: number; attention: number };
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const matches = useMemo(() => {
    const tokens = simplify(query).split(/\s+/).filter(Boolean);
    if (!tokens.length) return ENTRIES;
    return ENTRIES.filter((entry) => {
      const haystack = simplify(`${entry.name} ${entry.hint} ${entry.terms}`);
      return tokens.every((token) => haystack.includes(token));
    });
  }, [query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelected(0);
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus.current?.focus();
    };
  }, [open]);

  const choose = (entry: Entry) => {
    onClose();
    if (entry.target) onNavigate(entry.target);
    if (entry.action === "attention") onAttention();
    if (entry.action === "notifications") onNotifications();
    if (entry.action === "store") onStore();
  };

  const handleKeyboard = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
    if (event.key === "ArrowDown") { event.preventDefault(); setSelected((value) => (value + 1) % Math.max(1, matches.length)); }
    if (event.key === "ArrowUp") { event.preventDefault(); setSelected((value) => (value + matches.length - 1) % Math.max(1, matches.length)); }
    if (event.key === "Enter" && matches.length) { event.preventDefault(); choose(matches[Math.min(selected, matches.length - 1)]); }
  };

  if (!open) return null;
  const badgeCount = (id: Entry["id"]) => {
    if (id === "cozinha") return counts.cozinha;
    if (id === "agendados") return counts.agendados;
    if (id === "expedicao") return counts.expedicao;
    if (id === "attention") return counts.attention;
    return 0;
  };

  return (
    <div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={styles.panel} role="dialog" aria-modal="true" aria-labelledby="dfl-quick-title">
        <div className={styles.head}>
          <div><small>CENTRAL DE ACESSO RÁPIDO</small><h2 id="dfl-quick-title">Para onde vamos?</h2><p>Encontre qualquer ferramenta sem navegar por várias telas.</p></div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Fechar acesso rápido"><X size={20} /></button>
        </div>
        <label className={styles.search}>
          <Search size={19} aria-hidden="true" />
          <input ref={inputRef} type="search" value={query} onChange={(event) => { setQuery(event.target.value); setSelected(0); }}
            onKeyDown={handleKeyboard} placeholder="Buscar pedidos, catálogo, frete..." aria-label="Buscar ferramentas do Admin"
            role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="dfl-quick-results"
            aria-activedescendant={matches.length ? `dfl-quick-${matches[Math.min(selected, matches.length - 1)].id}` : undefined}/>
          <kbd>Esc</kbd>
        </label>
        <div id="dfl-quick-results" role="listbox" aria-label="Ferramentas disponíveis" className={styles.results}>
          {matches.length ? matches.map((entry, index) => {
            const count = badgeCount(entry.id);
            return <button type="button" key={entry.id} id={`dfl-quick-${entry.id}`} role="option" aria-selected={index === selected}
              className={styles.option} data-active={index === selected} data-current={entry.target === currentTab}
              onMouseEnter={() => setSelected(index)} onClick={() => choose(entry)}>
              <span className={styles.optionBody}><small>{entry.group}</small><strong>{entry.name}</strong><em>{entry.hint}</em></span>
              {count > 0 && <b className={styles.count}>{count}</b>}
              <ArrowRight size={16} aria-hidden="true" />
            </button>;
          }) : <div className={styles.empty}><strong>Nenhum atalho encontrado</strong><span>Tente “catálogo”, “frete”, “cozinha” ou “cupom”.</span></div>}
        </div>
        <footer className={styles.footer}><Keyboard size={16} /><span>↑ ↓ para navegar · Enter para abrir · Esc para fechar</span><b>DFL Admin</b></footer>
      </section>
    </div>
  );
}
