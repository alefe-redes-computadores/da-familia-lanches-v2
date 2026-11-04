"use client";

import { useState } from "react";
import { BookOpen, ChevronDown, ClipboardList, HelpCircle, MessageCircle, ShoppingCart } from "lucide-react";
import { businessWhatsAppUrl } from "@/lib/businessContact";
import { getDFLHelpAnswer } from "@/lib/dflAssistGuidance";
import styles from "./DFLAssistHelpDesk.module.css";

const quickHelp = [
  { label: "Como finalizar?", query: "como finalizar meu pedido" },
  { label: "Bairro e endereço", query: "bairro e endereco" },
  { label: "Pagamento ou cupom", query: "pagamento cupom" },
  { label: "Meu pedido chegou?", query: "acompanhar meus pedidos" },
] as const;

export function DFLAssistHelpDesk({ onTour, onOpenCart, onOpenOrders }: {
  onTour: () => void;
  onOpenCart: () => void;
  onOpenOrders: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const answer = submitted ? getDFLHelpAnswer(submitted) : null;
  const choose = (value: string) => { setQuery(value); setSubmitted(value); setExpanded(true); };

  return (
    <section className={styles.help} aria-label="Orientação do DFL Assist">
      <button type="button" className={styles.heading} aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
        <HelpCircle size={19} aria-hidden="true" />
        <span><strong>Está com alguma dificuldade?</strong><small>Encontre uma orientação antes de chamar a equipe</small></span>
        <ChevronDown size={18} className={expanded ? styles.up : ""} aria-hidden="true" />
      </button>
      {expanded && <div className={styles.content}>
        <div className={styles.quick} role="group" aria-label="Dúvidas frequentes">
          {quickHelp.map(item => <button type="button" key={item.label} onClick={() => choose(item.query)}>{item.label}</button>)}
        </div>
        <form className={styles.search} onSubmit={event => { event.preventDefault(); setSubmitted(query.trim()); }}>
          <label htmlFor="dfl-r251-help-question">Descreva sua dúvida</label>
          <div><input id="dfl-r251-help-question" type="search" autoComplete="off" maxLength={150} value={query} onChange={event => setQuery(event.target.value)} placeholder="Ex.: não consigo finalizar" />
            <button type="submit" disabled={!query.trim()}>Entender</button></div>
        </form>
        {answer && <div className={styles.answer} role="status">
          <strong>{answer.title}</strong>
          <p>{answer.guidance}</p>
          {answer.caution && <small className={styles.caution}>{answer.caution}</small>}
          {answer.action === "orders" && <button type="button" onClick={onOpenOrders}><ClipboardList size={16} />{answer.actionLabel}</button>}
          {answer.action === "cart" && <button type="button" onClick={onOpenCart}><ShoppingCart size={16} />{answer.actionLabel}</button>}
          {answer.action === "tour" && <div className={styles.row}><button type="button" onClick={onTour}><BookOpen size={16} />{answer.actionLabel}</button><button type="button" onClick={onOpenOrders}><ClipboardList size={16} />Conferir Meus Pedidos</button></div>}
          {answer.action === "human" && <a href={businessWhatsAppUrl("Olá! Preciso de ajuda para realizar um pedido no site da Da Família Lanches.")} rel="noopener noreferrer" target="_blank"><MessageCircle size={16} />{answer.actionLabel}</a>}
          {answer.action === "catalog" && <small>Use a pesquisa de ingredientes e orçamento logo abaixo.</small>}
        </div>}
      </div>}
    </section>
  );
}
