"use client";

import styles from "./CategoryTabs.module.css";

type Category = {
  id: string;
  label: string;
};

type Props = {
  categories: Category[];
  selected: string;
  onSelect: (categoryId: string) => void;
};

export function CategoryTabs({ categories, selected, onSelect }: Props) {
  return (
    <div className={styles.tabs}>
      {categories.map((cat) => (
        <button
          key={cat.id}
          type="button"
          className={`${styles.tab} ${
            selected === cat.id ? styles.active : ""
          }`}
          onClick={() => onSelect(cat.id)}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
}