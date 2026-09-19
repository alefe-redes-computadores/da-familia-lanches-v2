"use client";

import { useMemo, useState } from "react";
import { normalizarStatus } from "@/lib/orderUtils";
import { normalizePaymentMethod, orderDateToDate, paymentLabel } from "@/lib/orderCompat";
import styles from "./RelatoriosAdmin.module.css";
import { projectOrdersV2 } from "@/lib/analytics/orderProjection";

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function RelatoriosAdmin({ pedidos }: { pedidos: any[] }) {
  const [filtroDias, setFiltroDias] = useState(0);

  const pedidosFiltrados = useMemo(() => pedidos.filter((pedido) => {
    if (normalizarStatus(pedido.status) !== "Finalizado") return false;
    const date = orderDateToDate(pedido.data);
    if (!date) return false;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const orderDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const diff = Math.floor((today - orderDay) / 86400000);
    if (filtroDias === 0) return diff === 0;
    if (filtroDias === 1) return diff === 1;
    return diff >= 0 && diff < filtroDias;
  }), [pedidos, filtroDias]);

  const analyticsV2 = useMemo(() => projectOrdersV2(pedidos, filtroDias), [pedidos, filtroDias]);
  const totalVendido = analyticsV2.revenue;
  const totalPedidos = analyticsV2.totalSales;
  const ticketMedio = totalPedidos ? totalVendido / totalPedidos : 0;

  const porMetodo = useMemo(() => pedidosFiltrados.reduce<Record<string, number>>((acc, pedido) => {
    const method = normalizePaymentMethod(pedido.metodoPagamento);
    acc[method] = (acc[method] || 0) + Number(pedido.total || 0);
    return acc;
  }, {}), [pedidosFiltrados]);

  const entregas = pedidosFiltrados.filter((pedido) => pedido.tipoEntrega !== "pickup").length;
  const retiradas = pedidosFiltrados.filter((pedido) => pedido.tipoEntrega === "pickup").length;

  return (
    <div className={styles.root}>
      <div className={styles.filters}>
        {[
          { label: "Hoje", value: 0 },
          { label: "Ontem", value: 1 },
          { label: "7 dias", value: 7 },
          { label: "30 dias", value: 30 },
        ].map((filter) => (
          <button key={filter.label} data-active={filtroDias === filter.value} onClick={() => setFiltroDias(filter.value)}>
            {filter.label}
          </button>
        ))}
      </div>

      <div className={styles.kpis}>
        <article><span>Faturamento finalizado</span><strong>{money(totalVendido)}</strong></article>
        <article><span>Pedidos finalizados</span><strong>{totalPedidos}</strong></article>
        <article><span>Ticket medio</span><strong>{money(ticketMedio)}</strong></article>
        <article><span>Atendimento</span><strong>{entregas} entrega{entregas === 1 ? "" : "s"} · {retiradas} retirada{retiradas === 1 ? "" : "s"}</strong></article>
      </div>

      <section className={styles.panel}>
        <div className={styles.panelTitle}>
          <div><span>PAGAMENTOS</span><h3>Vendas por metodo</h3></div>
          <small>{totalPedidos ? "Base: pedidos finalizados" : "Sem vendas no periodo"}</small>
        </div>

        <div className={styles.methods}>
          {Object.entries(porMetodo).length === 0 ? (
            <div className={styles.noData}>Sem dados de pagamento neste periodo.</div>
          ) : Object.entries(porMetodo)
            .sort(([, a], [, b]) => b - a)
            .map(([method, value]) => {
              const percentage = totalVendido > 0 ? (value / totalVendido) * 100 : 0;
              return (
                <div className={styles.method} key={method}>
                  <div><span>{paymentLabel(method)}</span><b>{money(value)} · {percentage.toFixed(0)}%</b></div>
                  <div className={styles.bar}><i style={{ width: `${Math.min(100, percentage)}%` }} /></div>
                </div>
              );
            })}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelTitle}>
          <div><span>HISTORICO</span><h3>Pedidos finalizados no periodo</h3></div>
          <small>{totalPedidos} registro{totalPedidos === 1 ? "" : "s"}</small>
        </div>
        <div className={styles.history}>
          {pedidosFiltrados.length === 0 ? <div className={styles.noData}>Nenhum pedido finalizado neste periodo.</div> :
            pedidosFiltrados.slice(0, 30).map((pedido) => (
              <div className={styles.historyRow} key={pedido.id}>
                <div><b>#{String(pedido.id).slice(-6).toUpperCase()}</b><span>{pedido.userName || "Cliente"}</span></div>
                <div><b>{money(Number(pedido.total || 0))}</b><span>{pedido.tipoEntrega === "pickup" ? "Retirada" : "Entrega"}</span></div>
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}
