"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { ModalBase } from "./ModalBase";
import { useUIStore } from "@/store/ui";
import { useAuthStore } from "@/store/auth.store";
import { useCartStore } from "@/store/cart.store";
import { db } from "@/lib/firebase";
import { ADDONS } from "@/data/addons";
import { products } from "@/data/products";
import { getOrderItems, normalizeText, orderDateToMillis } from "@/lib/orderCompat";
import { formatarData, normalizarStatus } from "@/lib/orderUtils";
import styles from "./OrdersModal.module.css";

function formatMoney(value: unknown) {
  const amount = Number(value);
  return (Number.isFinite(amount) ? amount : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function OrdersModal() {
  const { closeModal, openModal } = useUIStore();
  const { currentUser } = useAuthStore();
  const { addItem, clearCart } = useCartStore();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function fetchOrders() {
      if (!currentUser) {
        setLoading(false);
        return;
      }
      try {
        const snapshot = await getDocs(query(collection(db, "Pedidos"), where("userId", "==", currentUser.uid)));
        const list: Array<Record<string, any> & { id: string }> = snapshot.docs
          .map<Record<string, any> & { id: string }>((document) => ({ id: document.id, ...document.data() }))
          .sort((a, b) => orderDateToMillis(b.data) - orderDateToMillis(a.data));
        if (!cancelled) setOrders(list);
      } catch (cause) {
        console.error("Erro ao buscar pedidos:", cause);
        if (!cancelled) setError("Não foi possível carregar seu histórico agora.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void fetchOrders();
    return () => { cancelled = true; };
  }, [currentUser]);

  const handleRepeatOrder = (order: any) => {
    const historicalItems = getOrderItems(order);
    if (!historicalItems.length) {
      setError("Esse pedido antigo não possui itens reconhecíveis para repetir.");
      return;
    }

    const resolved = historicalItems.flatMap((item) => {
      const currentProduct = products.find((product) => product.id === item.id)
        ?? products.find((product) => normalizeText(product.name) === normalizeText(item.name));
      if (!currentProduct || !currentProduct.disponivel) return [];

      const currentAddons = item.selectedAddons.flatMap((oldAddon) => {
        const addon = ADDONS.find((candidate) => candidate.id === oldAddon.id)
          ?? ADDONS.find((candidate) => normalizeText(candidate.name) === normalizeText(oldAddon.name));
        return addon ? [addon] : [];
      });

      return [{ item, product: currentProduct, addons: currentAddons }];
    });

    if (!resolved.length) {
      setError("Os produtos desse pedido não estão disponíveis no cardápio atual.");
      return;
    }

    const skipped = historicalItems.length - resolved.length;
    if (!window.confirm(`Repetir ${resolved.length} item(ns) com os preços atuais do cardápio? O carrinho atual será substituído.${skipped ? `\n\n${skipped} item(ns) indisponível(is) não serão adicionados.` : ""}`)) return;

    clearCart();
    resolved.forEach(({ item, product, addons }) => {
      addItem(product, item.quantity, addons, item.observation);
    });

    if (skipped) setNotice(`${skipped} item(ns) antigo(s) não estavam disponíveis e foram ignorados.`);
    closeModal();
    openModal("cart");
  };

  return (
    <ModalBase title="Meus pedidos" onClose={closeModal}>
      <div className={styles.body}>
        {error && <div className={styles.error}>{error}</div>}
        {notice && <div className={styles.notice}>{notice}</div>}
        {loading && <div className={styles.loading}>Carregando histórico...</div>}
        {!loading && !error && orders.length === 0 && (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>□</div>
            <p>Você ainda não fez nenhum pedido.</p>
            <button className={styles.primaryGhost} onClick={closeModal}>Ver cardápio</button>
          </div>
        )}
        {!loading && orders.length > 0 && <div className={styles.summary}>{orders.length} pedido(s) encontrado(s)</div>}
        <div className={styles.list}>
          {orders.map((order) => {
            const items = getOrderItems(order);
            return (
              <article className={styles.card} key={order.id}>
                <div className={styles.head}>
                  <span className={styles.date}>{formatarData(order.data)}</span>
                  <span className={styles.total}>{formatMoney(order.total)}</span>
                </div>
                <div className={styles.status}>{normalizarStatus(order.status)}</div>
                <div className={styles.items}>
                  {items.length ? items.map((item, index) => (
                    <div key={`${item.name}-${index}`}>
                      <div>{item.quantity}x {item.name}</div>
                      {item.selectedAddons.map((addon) => <div className={styles.addon} key={`${addon.id}-${addon.name}`}>+ {addon.name}</div>)}
                    </div>
                  )) : <div>Itens não disponíveis neste registro antigo.</div>}
                </div>
                <button className={styles.repeat} disabled={!items.length} onClick={() => handleRepeatOrder(order)}>Repetir com preços atuais</button>
                <div className={styles.warning}>Produtos e adicionais são recalculados pelo cardápio atual.</div>
              </article>
            );
          })}
        </div>
      </div>
    </ModalBase>
  );
}
