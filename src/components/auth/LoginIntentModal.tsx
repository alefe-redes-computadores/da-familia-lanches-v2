"use client";

import { useUIStore } from "@/store/ui";
import { ModalBase } from "@/components/ui/ModalBase";
import styles from "./LoginIntentModal.module.css";
import { useEffect, useState } from "react";
import { dismissGooglePrompt, readGuestIdentity, readGuestOrders, type GuestIdentity } from "@/lib/guestContinuity";

export function LoginIntentModal() {
  const closeModal = useUIStore((s) => s.closeModal);
  const openModal = useUIStore((s) => s.openModal);
  const [guest,setGuest]=useState<GuestIdentity|null>(null);
  const [localOrders,setLocalOrders]=useState(0);
  useEffect(()=>{const sync=()=>{setGuest(readGuestIdentity());setLocalOrders(readGuestOrders().length)};sync();window.addEventListener("dfl:guest-continuity",sync);return()=>window.removeEventListener("dfl:guest-continuity",sync)},[]);

  return (
    <ModalBase title={guest ? `Olá, ${guest.name.split(" ")[0]}` : "Seu pedido já começou"} onClose={closeModal}>
      <div className={styles.wrap}>
        <div className={styles.brand} aria-label="Da Família Lanches">DFL</div>
        <div className={styles.copy}>
          <span className={styles.eyebrow}>{guest ? "PERFIL NESTE APARELHO" : "ITEM ADICIONADO"}</span>
          <h3>{guest ? `${localOrders} ${localOrders===1?"pedido salvo":"pedidos salvos"} neste aparelho.` : "Seu pedido, do seu jeito."}</h3>
          <p>{guest ? "Seus dados e pedidos deste navegador agilizam as próximas compras. Sincronize com Google para levar seu histórico a outros aparelhos." : "Entre com Google para histórico e praticidade, ou continue como convidado e finalize pelo WhatsApp."}</p>
        </div>

        <button className={styles.primary} type="button" onClick={() => openModal("login")}>
          <span className={styles.googleMark} aria-hidden="true"><svg viewBox="0 0 24 24"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.36l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.06v2.62A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.41 13.94A6.02 6.02 0 0 1 6.1 12c0-.67.12-1.33.31-1.94V7.44H3.06A10 10 0 0 0 2 12c0 1.61.38 3.14 1.06 4.56l3.35-2.62Z"/><path fill="#EA4335" d="M12 5.94c1.47 0 2.78.5 3.82 1.5l2.87-2.87A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.94 5.44l3.35 2.62C7.2 7.7 9.4 5.94 12 5.94Z"/></svg></span><span>{guest ? "Sincronizar com Google" : "Entrar com Google"}</span>
        </button>
        <button className={styles.secondary} type="button" onClick={() => { if(guest) dismissGooglePrompt(); closeModal(); }}>
          {guest ? "Continuar somente neste aparelho" : "Continuar como convidado · WhatsApp"}
        </button>
      </div>
    </ModalBase>
  );
}
