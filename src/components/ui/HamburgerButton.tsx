"use client";

import styles from "./HamburgerButton.module.css";

type Props = {
  onClick: () => void;
  ariaLabel?: string;
};

export function HamburgerButton({ onClick, ariaLabel = "Menu" }: Props) {
  return (
    <button
      type="button"
      className={styles.btn}
      aria-label={ariaLabel}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
    >
      <span className={styles.line} />
      <span className={styles.line} />
      <span className={styles.line} />
    </button>
  );
}