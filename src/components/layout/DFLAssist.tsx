"use client";
import { useEffect, useRef, useState } from "react";
import { Bot, BookOpen, Search, ShoppingCart, MessageCircle, X } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { CATALOG_SEARCH_EVENT } from "@/lib/catalogSearch";
import { useUIStore } from "@/store/ui";
import { businessWhatsAppUrl } from "@/lib/businessContact";
import styles from "./DFLAssist.module.css";
import { DFLAssistOffers } from "./DFLAssistOffers";
import { DFLAssistWalkthrough } from "./DFLAssistWalkthrough";
import { DFLAssistHelpDesk } from "./DFLAssistHelpDesk";
import type { Product } from "@/data/products";

const tourKey = "dfl:assist-tour-v1";
/** Assistente comercial de leitura: nao e IA generativa e nao registra pedidos. */
export function DFLAssist() {
  const [visible, setVisible] = useState(false);
  const [tour, setTour] = useState(false);
  const tourRef = useRef(tour);
  tourRef.current = tour;
  const panelRef = useRef<HTMLElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const openModal = useUIStore((s) => s.openModal);
  const activeModal = useUIStore((s) => s.activeModal);
  useEffect(() => {
    const show = (event: Event) => {
      let shouldTour = false;
      try { shouldTour = !window.localStorage.getItem(tourKey); } catch { /* storage bloqueado */ }
      if (event instanceof CustomEvent && event.detail?.mode === "guide") shouldTour = true;
      setTour(shouldTour);
      setVisible(true);
    };
    window.addEventListener("dfl:assist-open", show);
    return () => window.removeEventListener("dfl:assist-open", show);
  }, []);
  useEffect(() => { if (activeModal) setVisible(false); }, [activeModal]);
  // R28: dialog acessivel sem prender o cliente fora da janela de compra.
  useEffect(() => {
    if (!visible) return;
    const prior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }));
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeAssist(); return; }
      if (event.key !== "Tab") return;
      const nodes = panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),summary,[tabindex]:not([tabindex="-1"])');
      if (!nodes?.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panelRef.current)) {
        event.preventDefault(); first.focus();
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
      if (prior?.isConnected && (document.activeElement === document.body || panelRef.current?.contains(document.activeElement))) prior.focus({ preventScroll: true });
    };
  }, [visible]);
  const finishTour = () => {
    try { window.localStorage.setItem(tourKey, "1"); } catch { /* storage opcional */ }
    setTour(false);
  };
  const closeAssist = () => {
    // Fechar uma apresentação já exibida não deve reiniciá-la na próxima abertura.
    if (tourRef.current) {
      try { window.localStorage.setItem(tourKey, "1"); } catch { /* storage opcional */ }
      setTour(false);
    }
    setVisible(false);
  };
  const search = (value: string) => {
    const term = value.trim().slice(0,100);
    if (!term) return;
    // R102: somente paginas internas precisam transferir a busca pelo sessionStorage.
    // Na Home a busca chega diretamente ao input; nao deixar termo fantasma para outra visita.
    if (pathname === "/") {
      try { window.sessionStorage.removeItem("dfl:pending-catalog-search"); } catch {}
      window.dispatchEvent(new CustomEvent(CATALOG_SEARCH_EVENT,{detail:term}));
    } else {
      try { window.sessionStorage.setItem("dfl:pending-catalog-search", term); } catch {}
      router.push("/");
    }
    setVisible(false);
  };
  if (!visible) return null;
  return <div className={styles.backdrop} role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)closeAssist()}}>
    <section ref={panelRef} tabIndex={-1} className={styles.panel} role="dialog" aria-modal="true" aria-label="DFL Assist">
      <header className={styles.header}><span className={styles.avatar}><Bot size={23} aria-hidden="true"/></span><div><strong>DFL Assist</strong><small>{tour ? "Conheça nosso guia de compra" : "Seu ajudante de compras"}</small></div><button type="button" className={styles.close} onClick={closeAssist} aria-label="Fechar DFL Assist"><X size={20}/></button></header>
      {tour ? <DFLAssistWalkthrough onDone={finishTour} onSkip={finishTour} /> : <>
        <p className={styles.message}>Encontre seu lanche usando ingredientes, orçamento ou sugestões do cardápio.</p>
        <DFLAssistOffers onFindProduct={search} onOpenProduct={(product: Product) => {
          // DFL-R64-DIRECT-PRODUCT: o produto vem do catalogo real confirmado.
          setVisible(false);
          openModal("product-details", product);
        }} />
        <details className={styles.assistMore}>
          <summary>Ajuda e passo a passo</summary>
          <div className={styles.assistMoreBody}>
            <p className={styles.assistHint}>Sugestões do cardápio real. Não é atendimento por IA generativa e não cria pedidos. {/* DFL-R43-ASSIST */}</p>
            <button type="button" className={styles.openTour} onClick={()=>setTour(true)}><BookOpen size={17} aria-hidden="true"/> Como fazer meu pedido? Ver passo a passo</button>
            <DFLAssistHelpDesk onTour={() => setTour(true)} onOpenCart={() => { setVisible(false); openModal("cart"); }} onOpenOrders={() => { setVisible(false); openModal("orders"); }} />
          </div>
        </details>
        <details className={styles.assistMore}>
          <summary>Outras ações</summary>
          <div className={styles.assistMoreBody}>
            <div className={styles.actions}><button type="button" onClick={()=>{setVisible(false);openModal("cart")}}><ShoppingCart size={19}/> Ver carrinho</button><button type="button" onClick={()=>search("combo")}><Search size={19}/> Ver combos</button><a href={businessWhatsAppUrl("Olá! Preciso de ajuda para escolher ou finalizar meu pedido no site da Da Família Lanches.")} target="_blank" rel="noopener noreferrer"><MessageCircle size={19}/> Falar com a equipe</a></div>
            <p className={styles.note}>O WhatsApp é atendimento, não confirma nem cria um pedido. Seus dados e carrinho não são enviados automaticamente.</p>
          </div>
        </details>
      </>}
    </section>
  </div>;
}
