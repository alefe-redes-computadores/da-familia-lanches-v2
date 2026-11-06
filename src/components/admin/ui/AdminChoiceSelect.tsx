"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, X } from "lucide-react";
import styles from "./AdminChoiceSelect.module.css";

export type AdminChoiceOption<T extends string = string> = Readonly<{
  value: T;
  label: string;
  group?: string;
  disabled?: boolean;
}>;

type Props<T extends string> = {
  label: string;
  value: T;
  options: ReadonlyArray<AdminChoiceOption<T>>;
  onChange: (value: T) => void;
  disabled?: boolean;
};

/** DFL R292: escolha acessivel via bottom sheet; nao altera dados ate o onChange. */
export function AdminChoiceSelect<T extends string>({ label, value, options, onChange, disabled = false }: Props<T>) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLElement>(null);
  const chosen = useRef<HTMLButtonElement>(null);
  const active = options.find(option => option.value === value);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => {
      (chosen.current ?? sheet.current?.querySelector<HTMLButtonElement>('[data-choice-option="true"]') ?? sheet.current)?.focus({ preventScroll: true });
    });
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      trigger.current?.focus({ preventScroll: true });
    };
  }, [open]);

  const keys = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") { event.preventDefault(); setOpen(false); return; }
    const buttons = Array.from(sheet.current?.querySelectorAll<HTMLButtonElement>('[data-choice-option="true"]:not(:disabled)') ?? []);
    if ((event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") && buttons.length) {
      event.preventDefault();
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const target = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : event.key === "ArrowDown" ? (index + 1) % buttons.length : (index - 1 + buttons.length) % buttons.length;
      buttons[target]?.focus();
      buttons[target]?.scrollIntoView({ block: "nearest" });
    }
    if (event.key === "Tab" && sheet.current) {
      const focusable = Array.from(sheet.current.querySelectorAll<HTMLElement>('button:not([disabled])'));
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  };

  return <div className={styles.root}>
    <button ref={trigger} type="button" className={styles.trigger} disabled={disabled} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(true)}>
      <span>{label}</span><strong>{active?.label ?? (value || "Selecione")}</strong><ChevronDown size={17} aria-hidden="true"/>
    </button>
    {open && createPortal(<div className={styles.overlay} onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section ref={sheet} id={id} className={styles.sheet} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} onKeyDown={keys}>
        <header className={styles.head}><div><span>SELECIONAR</span><h3>{label}</h3></div><button type="button" onClick={() => setOpen(false)} aria-label="Fechar opções"><X size={20}/></button></header>
        <div className={styles.options} role="listbox" aria-label={label}>
          {options.map((option, index) => <div key={`${option.group ?? ''}:${option.value}`}>
            {option.group && (index === 0 || options[index - 1]?.group !== option.group) && <p className={styles.group}>{option.group}</p>}
            <button ref={option.value === value ? chosen : undefined} data-choice-option="true" className={styles.option} role="option" aria-selected={option.value === value} type="button" disabled={option.disabled} onClick={() => { onChange(option.value); setOpen(false); }}>
              <span>{option.label}</span>{option.value === value && <Check size={19} aria-hidden="true"/>}
            </button>
          </div>)}
          {!options.length && <p className={styles.empty}>Nenhuma opção disponível.</p>}
        </div>
      </section>
    </div>, document.body)}
  </div>;
}
