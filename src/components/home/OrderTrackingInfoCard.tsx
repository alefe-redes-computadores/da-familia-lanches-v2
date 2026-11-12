"use client";

import { ArrowUpRight, ChevronDown, ClipboardList, LockKeyhole, MessageCircle, Route } from "lucide-react";
import { useUIStore } from "@/store/ui";
import styles from "./OrderTrackingInfoCard.module.css";

/**
 * R59: aviso editorial, nunca emissor de token ou ativador de mensageria.
 * Acompanhamento detalhado e WhatsApp dependem de politicas server-side.
 */
export function OrderTrackingInfoCard() {
  const openModal = useUIStore((state) => state.openModal);

  return (
    <section className={styles.card} aria-labelledby="dfl-tracking-benefit-title" data-dfl-tracking-benefit="v1">
      <span className={styles.mark} aria-hidden="true"><Route size={20} strokeWidth={1.8} /></span>
      <div className={styles.content}>
        <p className={styles.eyebrow}>NOVIDADE DA FAMÍLIA</p>
        <h2 id="dfl-tracking-benefit-title">Seu pedido, acompanhado de verdade</h2>
        <p className={styles.description}>
          Veja o andamento em Meus pedidos. Quando disponível para sua entrega, você também pode
          receber avisos autorizados pelo WhatsApp e um link privado de acompanhamento.
        </p>
        <ul className={styles.features} aria-label="Recursos do acompanhamento">
          <li><ClipboardList size={14} aria-hidden="true" /><span>Etapas do pedido</span></li>
          <li><MessageCircle size={14} aria-hidden="true" /><span>Avisos com consentimento</span></li>
          <li><LockKeyhole size={14} aria-hidden="true" /><span>Link privado quando disponível</span></li>
        </ul>
        <button type="button" className={styles.primaryAction} onClick={() => openModal("orders")}>
          <span>Ver meus pedidos</span><ArrowUpRight size={17} strokeWidth={2} aria-hidden="true" />
        </button>
        <details className={styles.disclosure}>
          <summary>Como funciona <ChevronDown size={15} aria-hidden="true" /></summary>
          <div className={styles.explanation}>
            <p>
              Depois de pedir, consulte as etapas registradas em Meus pedidos. O link protegido só
              aparece ou é enviado quando o acompanhamento é liberado para aquele pedido. Os avisos
              no WhatsApp exigem autorização do cliente e ativação do serviço.
            </p>
          </div>
        </details>
      </div>
    </section>
  );
}
