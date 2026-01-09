"use client";

import styles from "./ModalBase.module.css";

type Props = {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
};

export function ModalBase({ title, children, onClose }: Props) {
  return (
    <div className={styles.root}>
      <button
        className={styles.backdrop}
        type="button"
        aria-label="Fechar"
        onClick={onClose}
      />
      <section className={styles.modal} role="dialog" aria-modal="true">
        <header className={styles.header}>
          <strong className={styles.title}>{title}</strong>
          <button className={styles.close} type="button" onClick={onClose}>
            ✕
          </button>
        </header>
        <div className={styles.body}>{children}</div>
      </section>
    </div>
  );
}