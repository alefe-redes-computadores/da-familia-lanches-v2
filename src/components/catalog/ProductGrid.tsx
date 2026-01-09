"use client";

import type { Product } from "@/domains/catalog/types";
import styles from "./ProductGrid.module.css";
import { ProductCard } from "./ProductCard";

type Props = {
  products: Product[];
};

export function ProductGrid({ products }: Props) {
  if (!products?.length) {
    return (
      <div className={styles.empty}>
        Nenhum item encontrado. Tente outra busca.
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}