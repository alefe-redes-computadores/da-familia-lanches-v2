"use client";

import { useMemo, useState } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useUIStore } from "@/store/ui";
import { useCartStore } from "@/store/cart.store";
import { availableAddonsForProduct } from "@/lib/catalog";
import { getOrderItems, normalizeText } from "@/lib/orderCompat";
import { useCustomerOrders } from "@/hooks/useCustomerOrders";
import { useLastCustomerOrder } from "@/hooks/useLastCustomerOrder";
import { useCatalog } from "@/hooks/useCatalog";
import { haptic } from "@/lib/haptics";
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
  const { addItem, clearCart } = useCartStore();
  const [repeatError, setRepeatError] = useState("");

  const {
    activeOrders,
    loading: activeLoading,
  } = useCustomerOrders(user);
  const { lastOrder: order, loading: lastOrderLoading } = useLastCustomerOrder(user);

  const { products, addons } = useCatalog();

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
        // Para exibição usamos primeiro a imagem atual do catálogo.
        // O snapshot antigo continua preservado no pedido, mas não deve
        // manter foto desatualizada para sempre.
        image: String(
          product?.image ??
          item?.image ??
          item?.imagem ??
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

    const pickup = order.tipoEntrega === "pickup";

    const deliverySnapshot =
      order.deliverySnapshot &&
      typeof order.deliverySnapshot === "object"
        ? order.deliverySnapshot
        : null;

    const snapshotAddress = deliverySnapshot
      ? [
          deliverySnapshot.street,
          deliverySnapshot.number,
          deliverySnapshot.district,
        ].filter(Boolean).join(", ")
      : "";

    const rawAddress =
      pickup
        ? ""
        : snapshotAddress ||
          order.endereco ||
          order.address ||
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

    const safeAddress =
      /retirada|balc[aã]o|local/i.test(address)
        ? ""
        : address;

    return {
      items,
      total,
      address: safeAddress,
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
    activeLoading ||
    lastOrderLoading ||
    activeOrders.length > 0 ||
    !order ||
    !data
  ) {
    return null;
  }

  const images = data.items.filter((item) => item.image).slice(0, 3);

  const repeatLastOrder = () => {
    setRepeatError("");
    const previous = getOrderItems(order);
    const resolved = previous.flatMap((item) => {
      const product = products.find((candidate) => candidate.id === item.id) ?? products.find((candidate) => normalizeText(candidate.name) === normalizeText(item.name));
      if (!product || product.disponivel === false) return [];
      const allowed = availableAddonsForProduct(product, addons);
      const selected = item.selectedAddons.flatMap((oldAddon) => {
        const addon = allowed.find((candidate) => candidate.id === oldAddon.id) ?? allowed.find((candidate) => normalizeText(candidate.name) === normalizeText(oldAddon.name));
        return addon ? [addon] : [];
      });
      return [{ item, product, selected }];
    });
    if (!resolved.length) {
      haptic("error");
      setRepeatError("Esse pedido usa itens que não estão disponíveis agora. Abra os detalhes para escolher novamente.");
      return;
    }

    const changedItems = previous.length - resolved.length;
    const changedAddons = resolved.reduce(
      (sum, entry) =>
        sum + Math.max(0, entry.item.selectedAddons.length - entry.selected.length),
      0,
    );

    if (changedItems > 0 || changedAddons > 0) {
      setRepeatError(
        "O cardápio mudou desde esse pedido. Recriamos apenas o que continua disponível; revise o carrinho antes de finalizar.",
      );
    }

    clearCart();
    resolved.forEach(({ item, product, selected }) =>
      addItem(product, item.quantity, selected, item.observation)
    );
    haptic("restore");
    openModal("cart");
  };

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
        {repeatError && <small className={styles.error}>{repeatError}</small>}
      </div>

      <div className={styles.actions}>
        <button
          className={styles.primary}
          type="button"
          onClick={repeatLastOrder}
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
