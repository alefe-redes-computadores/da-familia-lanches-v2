"use client";

import { useState } from "react";
import { ModalBase } from "./ModalBase";
import { useUIStore } from "@/store/ui";
import { useCartStore } from "@/store/cart.store";
import { haptic } from "@/lib/haptics";
import styles from "./OrderSuccessModal.module.css";

type SuccessData = {
  orderId?: string;
  isScheduled?: boolean;
  deliveryMode?: "delivery" | "pickup";
  total?: number;
  whatsappUrl?: string;
  paymentMethod?: "pix" | "cartao" | "dinheiro";
  pixKey?: string;
  cartPreserved?: boolean;
};

const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function OrderSuccessModal() {
  const { modalData, closeModal, openModal } = useUIStore();
  const clearCart = useCartStore((state) => state.clearCart);
  const data = (modalData ?? {}) as SuccessData;
  const [copied, setCopied] = useState(false);
  const [whatsappOpened, setWhatsappOpened] = useState(false);
  const [cartCleared, setCartCleared] = useState(false);

  const ref = data.orderId ? `#${data.orderId.slice(-8).toUpperCase()}` : "Pedido";
  const isPix = data.paymentMethod === "pix" && Boolean(data.pixKey);

  const copyPix = async () => {
    if (!data.pixKey) return;
    await navigator.clipboard.writeText(data.pixKey);
    setCopied(true);
    haptic("step");
    window.setTimeout(() => setCopied(false), 1800);
  };

  const openWhatsApp = () => {
    if (!data.whatsappUrl) return;
    haptic("success");
    const opened = window.open(data.whatsappUrl, "_blank", "noopener,noreferrer");
    if (!opened) window.location.href = data.whatsappUrl;
    setWhatsappOpened(true);
  };

  const confirmClear = () => {
    clearCart();
    setCartCleared(true);
    haptic("remove");
  };

  return (
    <ModalBase title="Pedido registrado" onClose={closeModal}>
      <div className={styles.body}>
        <div className={styles.icon}>✓</div>
        <span className={styles.eyebrow}>{data.isScheduled ? "PEDIDO AGENDADO" : "PEDIDO RECEBIDO"}</span>
        <h2>{isPix ? "Pedido salvo. Agora finalize o PIX." : "Pronto. Seu pedido já está salvo."}</h2>
        <p>As mudanças de status aparecem em <b>Meus pedidos</b>. O WhatsApp é um canal adicional e não cria outro pedido.</p>

        <div className={styles.receipt}>
          <div><span>Referência</span><strong>{ref}</strong></div>
          {typeof data.total === "number" && <div><span>Total</span><strong>{money(data.total)}</strong></div>}
          <div><span>Recebimento</span><strong>{data.deliveryMode === "pickup" ? "Retirada" : "Entrega"}</strong></div>
        </div>

        {isPix && (
          <section className={styles.pixFlow}>
            <span>ETAPA FINAL · PAGAMENTO</span>
            <strong>Faça o PIX de {typeof data.total === "number" ? money(data.total) : "valor do pedido"}</strong>
            <p>Copie a chave abaixo no aplicativo do banco. Depois abra o WhatsApp e anexe o comprovante.</p>
            <div><input readOnly value={data.pixKey}/><button type="button" onClick={() => void copyPix()}>{copied ? "Copiado" : "Copiar chave"}</button></div>
            {data.whatsappUrl && <button className={styles.proof} type="button" onClick={openWhatsApp}>Já paguei · abrir WhatsApp</button>}
            <small>O pagamento ainda não é confirmado automaticamente.</small>
          </section>
        )}

        <button className={styles.primary} type="button" onClick={() => openModal("orders")}>Acompanhar meu pedido</button>
        {!isPix && data.whatsappUrl && <button className={styles.whatsapp} type="button" onClick={openWhatsApp}>Enviar resumo no WhatsApp</button>}

        {data.cartPreserved && !cartCleared && (
          <section className={styles.cartDecision} data-opened={whatsappOpened}>
            <span>{whatsappOpened ? "WHATSAPP ABERTO" : "CARRINHO PRESERVADO"}</span>
            <strong>{whatsappOpened ? "Conseguiu enviar a mensagem?" : "Nada foi apagado ainda."}</strong>
            <p>{whatsappOpened
              ? "Se você já enviou, pode limpar o carrinho. Se só abriu o WhatsApp e ainda não enviou, mantenha por enquanto."
              : "O pedido já está salvo no sistema. Mantivemos o carrinho para você não perder nada antes de decidir."}</p>
            <div>
              <button type="button" className={styles.clearConfirmed} onClick={confirmClear}>
                {whatsappOpened ? "Já enviei · limpar carrinho" : "Pedido conferido · limpar carrinho"}
              </button>
              <button type="button" className={styles.keepCart} onClick={closeModal}>Manter por enquanto</button>
            </div>
          </section>
        )}

        {cartCleared && <div className={styles.clearedNotice}>Carrinho limpo. Seu pedido continua salvo e pode ser acompanhado normalmente.</div>}

        <button className={styles.link} type="button" onClick={closeModal}>Voltar ao cardápio</button>
        <small>Se fechar esta tela sem limpar, o carrinho permanece salvo neste aparelho.</small>
      </div>
    </ModalBase>
  );
}
