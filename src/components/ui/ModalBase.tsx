"use client";

import { useEffect, useId, useRef } from "react";
import styles from "./ModalBase.module.css";

type Props = {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
};

export function ModalBase({ title, children, onClose }: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const priorOverflow = document.body.style.overflow;
    const dialog = dialogRef.current;
    document.body.style.overflow = "hidden";
    dialog?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      } else if (event.key === "Tab" && dialog) {
        const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
        )).filter(el => el.getClientRects().length > 0);
        if (!focusables.length) { event.preventDefault(); dialog.focus(); return; }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (!dialog.contains(document.activeElement)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        } else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = priorOverflow;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return (
    <div className={styles.root}>
      <button
        className={styles.backdrop}
        type="button"
        aria-label="Fechar"
        onClick={onClose}
      />
      <section ref={dialogRef} tabIndex={-1} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className={styles.header}>
          <strong className={styles.title} id={titleId}>{title}</strong>
          <button className={styles.close} type="button" onClick={onClose} aria-label="Fechar janela">
            ✕
          </button>
        </header>
        <div className={styles.body}>{children}</div>
      </section>
    </div>
  );
}

// DFL-R29-MODAL-A11Y

// DFL-R30-MODAL-FOCUS
