"use client";

import { useState } from "react";
import { BUSINESS_CONTACT } from "@/lib/businessContact";
import { haptic } from "@/lib/haptics";
import styles from "./OrderRescueActions.module.css";

type Props = {
  message: string;
  whatsappUrl?: string;
  compact?: boolean;
  title?: string;
};

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const el = document.createElement("textarea");
  el.value = value;
  el.style.position = "fixed";
  el.style.opacity = "0";
  document.body.appendChild(el);
  el.select();
  document.execCommand("copy");
  el.remove();
}

export function OrderRescueActions({
  message,
  whatsappUrl,
  compact = false,
  title = "Seu pedido continua com você",
}: Props) {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  const copy = async () => {
    try {
      await copyText(message);
      setCopied(true);
      haptic("success");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      haptic("error");
    }
  };

  const share = async () => {
    if (!navigator.share) {
      await copy();
      return;
    }

    try {
      await navigator.share({
        title: "Pedido · Da Família Lanches",
        text: message,
      });
      setShared(true);
      haptic("success");
      window.setTimeout(() => setShared(false), 1800);
    } catch {
      // Cancelar o compartilhamento não é erro operacional.
    }
  };

  const openWhatsApp = () => {
    if (!whatsappUrl) return;
    haptic("success");
    const opened = window.open(
      whatsappUrl,
      "_blank",
      "noopener,noreferrer",
    );
    if (!opened) window.location.href = whatsappUrl;
  };

  return (
    <section
      className={`${styles.rescue} ${compact ? styles.compact : ""}`}
      aria-label="Opções para salvar ou enviar o pedido"
    >
      <div className={styles.heading}>
        <span>PLANO B</span>
        <strong>{title}</strong>
        <p>
          Se algum canal falhar, você pode copiar ou compartilhar todos os
          dados do pedido sem preencher tudo novamente.
        </p>
      </div>

      <div className={styles.actions}>
        {whatsappUrl && (
          <button
            type="button"
            className={styles.whatsapp}
            onClick={openWhatsApp}
          >
            <b>WhatsApp</b>
            <small>Enviar pedido</small>
          </button>
        )}

        <button type="button" onClick={copy}>
          <b>{copied ? "Copiado!" : "Copiar"}</b>
          <small>Pedido completo</small>
        </button>

        <button type="button" onClick={share}>
          <b>{shared ? "Compartilhado" : "Compartilhar"}</b>
          <small>Outros aplicativos</small>
        </button>
      </div>

      <a
        className={styles.instagram}
        href={BUSINESS_CONTACT.instagramUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        <span>
          Não conseguiu falar pelo WhatsApp?
          <b>{BUSINESS_CONTACT.instagramHandle}</b>
        </span>
        <strong>Instagram →</strong>
      </a>
    </section>
  );
}
