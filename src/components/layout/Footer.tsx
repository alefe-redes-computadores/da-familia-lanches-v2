"use client";

import { useUIStore } from "@/store/ui";
import { BUSINESS_CONTACT } from "@/lib/businessContact";
import styles from "./Footer.module.css";

export function Footer() {
  const openModal = useUIStore((state) => state.openModal);
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}><span>DA FAMÍLIA LANCHES</span><strong>Feito para matar a fome de verdade.</strong><p>Rua Lázaro Martins Marciel (Rua 7), 164 - Jardim Quebec, Patos de Minas/MG</p></div>
        <div className={styles.links}>
          <a href={BUSINESS_CONTACT.whatsappUrl} target="_blank" rel="noopener noreferrer">WhatsApp</a>
          <a href="https://www.instagram.com/dafamilia_patos?igsh=MTdxdDczNno4ZHRrZw==" target="_blank" rel="noopener noreferrer">Instagram</a>
          <a href="https://www.ifood.com.br/delivery/patos-de-minas-mg/da-familia-lanches-caramuru/9aadff75-b014-4e7f-a9b4-b3e478e38af8?UTM_Medium=share" target="_blank" rel="noopener noreferrer">iFood</a>
          <a href="https://www.google.com/maps/search/?api=1&query=Da+Fam%C3%ADlia+Lanches+Patos+de+Minas" target="_blank" rel="noopener noreferrer">Como chegar</a>
        </div>
        <div className={styles.legal}><span>© {new Date().getFullYear()} Da Família Lanches</span><button type="button" onClick={() => openModal("terms")}>Termos e privacidade</button></div>
      </div>
    <p className={styles.developer}>Desenvolvido com carinho por Álefe Jôhsefe ❤️</p></footer>
  );
}
