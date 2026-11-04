"use client";

import { useId, useState } from "react";
import { BookOpen, ChevronDown, MessageCircle, ShieldAlert } from "lucide-react";
import { businessWhatsAppUrl } from "@/lib/businessContact";
import styles from "./CheckoutAssistHelp.module.css";

/** Ajuda apenas informativa: nao submete, nao modifica carrinho nem altera a tentativa de pedido. */
export function CheckoutAssistHelp({ checkoutStep, hasError, uncertain }: {
  checkoutStep: 1 | 2;
  hasError: boolean;
  uncertain: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const helpId = useId();
  return (
    <section className={styles.help} data-attention={hasError} aria-label="Ajuda para finalizar pedido">
      <button type="button" className={styles.trigger} aria-controls={helpId} aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
        <BookOpen size={18} aria-hidden="true"/>
        <span><strong>{hasError ? "Teve dificuldade? Podemos ajudar" : "Precisa de ajuda para finalizar?"}</strong><small>Veja o passo a passo, sem sair do pedido</small></span>
        <ChevronDown size={18} className={expanded ? styles.rotated : ""} aria-hidden="true"/>
      </button>
      {expanded && <div id={helpId} className={styles.content}>
        <ol>
          <li data-current={checkoutStep === 1}><b>Entrega ou retirada</b><span>Escolha como prefere receber e informe nome e WhatsApp. Para entrega, confira bairro, rua e número.</span></li>
          <li data-current={checkoutStep === 2}><b>Revise os valores</b><span>Confira seu endereço, itens, descontos, taxa e valor total. Escolha a forma de pagamento.</span></li>
          <li><b>Confirme apenas uma vez</b><span>Toque em confirmar e aguarde. Se a resposta demorar ou a conexão cair, confira Meus Pedidos antes de repetir.</span></li>
        </ol>
        {uncertain && <p className={styles.caution}><ShieldAlert size={17} aria-hidden="true"/> O pedido pode ter chegado à loja. Confira Meus Pedidos antes de tentar outra compra ou finalizar pelo WhatsApp.</p>}
        <a href={businessWhatsAppUrl("Olá! Preciso de ajuda para finalizar um pedido no site da Da Família Lanches.")} target="_blank" rel="noopener noreferrer" className={styles.contact}><MessageCircle size={17} aria-hidden="true"/> Falar com a nossa equipe</a>
        <small>O atendimento não confirma automaticamente seu pedido nem envia seu carrinho.</small>
      </div>}
    </section>
  );
}
