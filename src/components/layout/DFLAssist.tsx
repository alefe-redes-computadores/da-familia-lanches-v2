"use client";
import { useEffect, useState } from "react";
import { Bot, Search, ShoppingCart, MessageCircle, X } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { CATALOG_SEARCH_EVENT } from "@/lib/catalogSearch";
import { useUIStore } from "@/store/ui";
import { businessWhatsAppUrl } from "@/lib/businessContact";
import styles from "./DFLAssist.module.css";
import { DFLAssistOffers } from "./DFLAssistOffers";

/** Assistente de navegação v1: não é IA generativa e não registra pedidos. */
export function DFLAssist() {
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const openModal = useUIStore((s) => s.openModal);
  const activeModal = useUIStore((s) => s.activeModal);
  useEffect(() => {
    const show = () => setVisible(true);
    window.addEventListener("dfl:assist-open", show);
    return () => window.removeEventListener("dfl:assist-open", show);
  }, []);
  useEffect(() => { if (activeModal) setVisible(false); }, [activeModal]);
  useEffect(() => { if (!visible) return; const key=(event:KeyboardEvent)=>{if(event.key==="Escape")setVisible(false)}; window.addEventListener("keydown",key); return()=>window.removeEventListener("keydown",key); }, [visible]);
  const search = (value: string) => {
    const term = value.trim().slice(0,100);
    if (!term) return;
    try { window.sessionStorage.setItem("dfl:pending-catalog-search", term); } catch {}
    if (pathname === "/") window.dispatchEvent(new CustomEvent(CATALOG_SEARCH_EVENT,{detail:term}));
    else router.push("/");
    setVisible(false);
  };
  if (!visible) return null;
  return <div className={styles.backdrop} role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setVisible(false)}}>
    <section className={styles.panel} role="dialog" aria-modal="true" aria-label="DFL Assist">
      <header className={styles.header}><span className={styles.avatar}><Bot size={23} aria-hidden="true"/></span><div><strong>DFL Assist</strong><small>Seu ajudante de compras</small></div><button type="button" className={styles.close} onClick={()=>setVisible(false)} aria-label="Fechar DFL Assist"><X size={20}/></button></header>
      <p className={styles.message}>Vamos encontrar uma opção gostosa para você? Conte o que procura e eu mostro sugestões do cardápio.</p>
      <p className={styles.assistHint}>Escolha o que gosta e receba sugestões do cardápio. Ou faça uma busca direta: Não é atendimento por IA generativa.</p>
      <form className={styles.search} onSubmit={e=>{e.preventDefault();search(query)}}><div><input aria-label="Buscar diretamente no cardápio" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar no cardápio" maxLength={100}/><button type="submit" disabled={!query.trim()} aria-label="Pesquisar no cardápio"><Search size={19}/></button></div></form>
      <DFLAssistOffers onFindProduct={search} />
      <div className={styles.actions}><button type="button" onClick={()=>{setVisible(false);openModal("cart")}}><ShoppingCart size={19}/> Ver carrinho</button><button type="button" onClick={()=>search("combo")}><Search size={19}/> Ver combos</button><a href={businessWhatsAppUrl("Olá! Preciso de ajuda para escolher ou finalizar meu pedido no site da Da Família Lanches.")} target="_blank" rel="noopener noreferrer"><MessageCircle size={19}/> Falar com a equipe</a></div>
      <p className={styles.note}>O WhatsApp é atendimento, não confirma nem cria um pedido. Seus dados e carrinho não são enviados automaticamente.</p>
    </section>
  </div>;
}
