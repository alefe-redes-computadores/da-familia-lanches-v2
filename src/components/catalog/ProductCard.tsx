"use client";

import type { Product } from "@/domains/catalog/types";
import styles from "./ProductCard.module.css";

type Props = {
  product: Product;
};

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function ProductCard({ product }: Props) {
  const hasOldPrice =
    typeof product.oldPrice === "number" &&
    product.oldPrice > product.price;

  return (
    <article className={styles.card}>
      {product.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className={styles.image}
          src={`/${product.image}`}
          alt={product.name}
        />
      ) : null}

      <div className={styles.content}>
        <h3 className={styles.title}>{product.name}</h3>

        {product.description ? (
          <p className={styles.description}>{product.description}</p>
        ) : null}

        <div className={styles.footer}>
          <div className={styles.prices}>
            <span className={styles.price}>
              {formatBRL(product.price)}
            </span>

            {hasOldPrice ? (
              <span className={styles.oldPrice}>
                {formatBRL(product.oldPrice!)}
              </span>
            ) : null}
          </div>

          <button className={styles.addBtn}>
            Adicionar
          </button>
        </div>
      </div>
    </article>
  );
}