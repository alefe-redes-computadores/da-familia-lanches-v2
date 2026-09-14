"use client";

import { useAuthStore } from "@/store/auth.store";
import { useUIStore } from "@/store/ui";
import { useCustomerOrders } from "@/hooks/useCustomerOrders";
import { normalizarStatus } from "@/lib/orderUtils";
import { statusDescription, statusProgress, statusTitle } from "@/lib/orderStatus";
import styles from "./ActiveOrderBanner.module.css";

export function ActiveOrderBanner() {
  const currentUser = useAuthStore((state) => state.currentUser);
  const openModal = useUIStore((state) => state.openModal);
  const { activeOrders, loading } = useCustomerOrders(currentUser);
  if (!currentUser || loading || activeOrders.length === 0) return null;

  const order = activeOrders[0];
  const pickup = order.tipoEntrega === "pickup";
  const status = normalizarStatus(order.status);
  const extra = activeOrders.length - 1;
  return (
    <section className={styles.banner} aria-label="Pedido em andamento">
      <div className={styles.top}>
        <div>
          <span className={styles.eyebrow}>{status === "Agendado" ? "PEDIDO AGENDADO" : "PEDIDO EM ANDAMENTO"}</span>
          <strong>{statusTitle(status, pickup)}</strong>
        </div>
        <span className={styles.id}>#{String(order.id).slice(-8).toUpperCase()}</span>
      </div>
      <p>{statusDescription(status, pickup)}</p>
      {status !== "Agendado" && <div className={styles.progress} aria-hidden="true"><i style={{ width: `${statusProgress(status, pickup)}%` }} /></div>}
      <div className={styles.bottom}>
        <span>{extra > 0 ? `+ ${extra} outro${extra > 1 ? "s" : ""} em andamento` : "Atualiza automaticamente"}</span>
        <button type="button" onClick={() => openModal("orders")}>Acompanhar</button>
      </div>
    </section>
  );
}
