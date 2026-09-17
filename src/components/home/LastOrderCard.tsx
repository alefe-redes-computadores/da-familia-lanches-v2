"use client";

import { useMemo } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useUIStore } from "@/store/ui";
import { useCustomerOrders } from "@/hooks/useCustomerOrders";
import { useCatalog } from "@/hooks/useCatalog";
import styles from "./LastOrderCard.module.css";

const money = (value: number) =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const normalize = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export function LastOrderCard() {
  const user = useAuthStore((state) => state.currentUser);
  const openModal = useUIStore((state) => state.openModal);

  const {
    pastOrders,
    activeOrders,
    loading,
  } = useCustomerOrders(user);

  const { products } = useCatalog();

  const order = pastOrders[0];

  const data = useMemo(() => {
    if (!order) return null;

    const raw = Array.isArray(order.items)
      ? order.items
      : Array.isArray(order.itens)
        ? order.itens
        : [];

    const items = raw.slice(0, 3).map((item: any) => {
      const id = String(
        item?.id ??
        item?.productId ??
        item?.produtoId ??
        ""
      );

      const name = String(
        item?.name ??
        item?.nome ??
        "Item"
      );

      const product =
        products.find((candidate) => candidate.id === id) ??
        products.find(
          (candidate) =>
            normalize(candidate.name) === normalize(name)
        );

      return {
        name,
        image: String(
          item?.image ??
          item?.imagem ??
          product?.image ??
          ""
        ),
      };
    });

    const total = Number(
      order.total ??
      order.valorTotal ??
      order.totalPrice ??
      0
    );

    const rawAddress =
      order.endereco ??
      order.address ??
      order.customerSnapshot?.address ??
      order.customerSnapshot?.street ??
      "";

    const address =
      typeof rawAddress === "string"
        ? rawAddress
        : String(
            rawAddress?.street ??
            rawAddress?.rua ??
            rawAddress?.address ??
            ""
          );

    return {
      items,
      total,
      address,
    };
  }, [order, products]);

  /*
   * REGRA:
   * - pedido ativo = ActiveOrderBanner ocupa o slot;
   * - portanto este card some;
   * - sem ativo = último pedido finalizado aparece.
   */
  if (
    !user ||
    loading ||
    activeOrders.length > 0 ||
    !order ||
    !data
  ) {
    return null;
  }

  const images = data.items
    .filter((item) => item.image)
    .slice(0, 3);

  return (
    <section
      className={styles.card}
      aria-label="Pedir novamente"
    >
      <div
        className={styles.visuals}
        aria-hidden="true"
      >
        {images.map((item, index) => (
          <img
            key={`${item.name}-${index}`}
            src={item.image}
            alt=""
          />
        ))}

        {!images.length && (
          <span>DFL</span>
        )}
      </div>

      <div className={styles.body}>
        <span className={styles.eyebrow}>
          BATEU VONTADE DE NOVO?
        </span>

        <strong className={styles.title}>
          {data.items
            .map((item) => item.name)
            .filter(Boolean)
            .join(" · ") || "Seu último pedido"}
        </strong>

        <p>
          {money(data.total)}
          {data.address
            ? ` · ${data.address}`
            : ""}
        </p>
      </div>

      <div className={styles.actions}>
        <button
          className={styles.primary}
          type="button"
          onClick={() => openModal("orders")}
        >
          Pedir novamente
        </button>

        <button
          className={styles.secondary}
          type="button"
          onClick={() => openModal("orders")}
        >
          Ver detalhes
        </button>
      </div>
    </section>
  );
}
