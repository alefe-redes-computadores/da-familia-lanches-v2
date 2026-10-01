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
  rescueMessage?: string;
};

const money = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

export function OrderSuccessModal() {
  const { modalData, closeModal, openModal } = useUIStore();
  const clearCart = useCartStore((state) => state.clearCart);

  const data = (modalData ?? {}) as SuccessData;

  const [copied, setCopied] = useState(false);
  const [cartCleared, setCartCleared] = useState(false);

  const ref = data.orderId
    ? `#${data.orderId.slice(-8).toUpperCase()}`
    : "Pedido";

  const isPix =
    data.paymentMethod === "pix" &&
    Boolean(data.pixKey);

  const copyPix = async () => {
    if (!data.pixKey) return;

    await navigator.clipboard.writeText(data.pixKey);
    setCopied(true);
    haptic("step");

    window.setTimeout(
      () => setCopied(false),
      1800,
    );
  };

  const openWhatsAppSupport = () => {
    if (!data.whatsappUrl) return;

    haptic("step");

    const opened = window.open(
      data.whatsappUrl,
      "_blank",
      "noopener,noreferrer",
    );

    if (!opened) {
      window.location.href = data.whatsappUrl;
    }
  };

  const confirmClear = () => {
    clearCart();
    setCartCleared(true);
    haptic("success");
  };

  const openOrders = () => {
    haptic("step");
    openModal("orders");
  };

  return (
    <ModalBase
      title={
        data.isScheduled
          ? "Pedido agendado"
          : "Pedido recebido"
      }
      onClose={closeModal}
    >
      <div className={styles.body}>
        <div
          className={styles.icon}
          aria-hidden="true"
        >
          ✓
        </div>

        <span className={styles.eyebrow}>
          {data.isScheduled
            ? "TUDO CERTO · PEDIDO AGENDADO"
            : "TUDO CERTO · PEDIDO RECEBIDO"}
        </span>

        <h2>
          {isPix
            ? "Seu pedido foi recebido."
            : "Agora é com a gente."}
        </h2>

        <p>
          {isPix
            ? "Finalize o PIX abaixo. Você pode acompanhar o andamento em Meus pedidos."
            : "Seu pedido já está salvo. Você pode acompanhar cada etapa em Meus pedidos."}
        </p>

        <div
          className={styles.receipt}
          aria-label="Resumo do pedido"
        >
          <div>
            <span>Referência</span>
            <strong>{ref}</strong>
          </div>

          {typeof data.total === "number" && (
            <div>
              <span>Total</span>
              <strong>{money(data.total)}</strong>
            </div>
          )}

          <div>
            <span>Recebimento</span>
            <strong>
              {data.deliveryMode === "pickup"
                ? "Retirada"
                : "Entrega"}
            </strong>
          </div>
        </div>

        {isPix && (
          <section className={styles.pixFlow}>
            <span>ETAPA FINAL · PAGAMENTO</span>

            <strong>
              Faça o PIX de{" "}
              {typeof data.total === "number"
                ? money(data.total)
                : "valor do pedido"}
            </strong>

            <p>
              Copie a chave abaixo no aplicativo do banco.
              Depois, se necessário, envie o comprovante
              pelo WhatsApp.
            </p>

            <div>
              <input
                readOnly
                value={data.pixKey}
                aria-label="Chave PIX"
              />

              <button
                type="button"
                onClick={() => void copyPix()}
              >
                {copied
                  ? "Copiado"
                  : "Copiar chave"}
              </button>
            </div>

            {data.whatsappUrl && (
              <button
                className={styles.proof}
                type="button"
                onClick={openWhatsAppSupport}
              >
                Enviar comprovante pelo WhatsApp
              </button>
            )}

            <small>
              O pagamento ainda não é confirmado
              automaticamente.
            </small>
          </section>
        )}

        <button
          className={styles.primary}
          type="button"
          onClick={openOrders}
        >
          Acompanhar meu pedido
        </button>

        {data.whatsappUrl && !isPix && (
          <button
            className={styles.support}
            type="button"
            onClick={openWhatsAppSupport}
          >
            <span>Precisa falar com a gente?</span>
            <strong>Chamar no WhatsApp</strong>
          </button>
        )}

        {data.cartPreserved &&
          !cartCleared && (
            <section className={styles.cartDecision}>
              <div>
                <span>CARRINHO</span>
                <strong>
                  Seu pedido já está seguro.
                </strong>
                <p>
                  Se terminou por aqui, você pode
                  limpar os itens. Isso não altera
                  o pedido que acabou de fazer.
                </p>
              </div>

              <div className={styles.cartActions}>
                <button
                  type="button"
                  className={styles.clearConfirmed}
                  onClick={confirmClear}
                >
                  Limpar carrinho
                </button>

                <button
                  type="button"
                  className={styles.keepCart}
                  onClick={closeModal}
                >
                  Manter itens
                </button>
              </div>
            </section>
          )}

        {cartCleared && (
          <div
            className={styles.clearedNotice}
            role="status"
          >
            Carrinho limpo. Seu pedido continua
            salvo normalmente.
          </div>
        )}

        <button
          className={styles.link}
          type="button"
          onClick={closeModal}
        >
          Voltar ao cardápio
        </button>

        <small className={styles.deliveryNote}>
          As atualizações importantes também podem
          chegar pelo WhatsApp.
        </small>
      </div>
    </ModalBase>
  );
}
