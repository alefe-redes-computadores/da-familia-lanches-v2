"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import { normalizarStatus } from "@/lib/orderUtils";
import { operationalAttention, type AdminOrder } from "@/lib/adminOrders";
import { haptic } from "@/lib/haptics";

type RemoteHealth = {
  checkedAt: string;
  integration: {
    state: "healthy" | "attention" | "quarantine";
    backlog: number;
    quarantine: number;
    outbox: {
      pending: number;
      processing: number;
      failed: number;
      deadLetter: number;
    };
    messaging: {
      pending: number;
      processing: number;
      rawPending: number;
      rawProcessing: number;
      legacyOrIneligible: number;
      quarantined: number;
    };
  };
};

export function OperationHealthAdmin({
  pedidos,
  historyHasMore,
}: {
  pedidos: AdminOrder[];
  historyHasMore: boolean;
}) {
  const [remote, setRemote] = useState<RemoteHealth | null>(null);
  const [checking, setChecking] = useState(false);
  const [remoteError, setRemoteError] = useState("");

  const now = Date.now();
  const active = pedidos.filter((order) =>
    ["Pendente", "Em Produção", "Agendado", "Pronto", "Saiu para Entrega"]
      .includes(normalizarStatus(order.status))
  );
  const attention = active.filter((order) =>
    Boolean(operationalAttention(order, now))
  );
  const tracking = active.filter((order) =>
    Boolean(order.deliveryTrackingEvent || order.deliveryTrackingLastEventAt)
  );
  const deferred = active.filter((order) =>
    order.deliveryCommercialProjectionPending === true
  );

  const checkIntegration = async () => {
    if (checking) return;
    setChecking(true);
    setRemoteError("");
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Sessão administrativa indisponível.");
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/operation-health", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Falha ao consultar integração.");
      }
      setRemote(data);
      haptic(
        data.integration.backlog || data.integration.quarantine
          ? "error"
          : "success"
      );
    } catch (error) {
      setRemoteError(
        error instanceof Error ? error.message : "Falha ao consultar integração."
      );
      haptic("error");
    } finally {
      setChecking(false);
    }
  };

  const remoteLabel = !remote
    ? "não consultada"
    : remote.integration.state === "healthy"
      ? "integração limpa"
      : remote.integration.backlog > 0
        ? `${remote.integration.backlog} pendência${remote.integration.backlog === 1 ? "" : "s"}`
        : `${remote.integration.quarantine} em quarentena`;

  return (
    <section style={{
      marginBottom: 18,
      padding: 16,
      borderRadius: 16,
      border: "1px solid #292e36",
      background: "#111419",
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "flex-start",
      }}>
        <div>
          <span style={{
            fontSize: 9,
            letterSpacing: ".12em",
            fontWeight: 900,
            color: attention.length ? "#f3ba67" : "#69d3a3",
          }}>
            SAÚDE DA OPERAÇÃO
          </span>
          <h3 style={{ margin: "5px 0 4px", fontSize: 18 }}>
            {attention.length
              ? `${attention.length} pedido${attention.length === 1 ? "" : "s"} precisa${attention.length === 1 ? "" : "m"} de atenção`
              : "Fila operacional sem alertas locais"}
          </h3>
          <p style={{ margin: 0, color: "#8e96a3", fontSize: 11, lineHeight: 1.45 }}>
            A fila usa dados já carregados. A integração só é consultada quando você pedir.
          </p>
        </div>
        <strong style={{
          minWidth: 44,
          textAlign: "center",
          padding: "8px 10px",
          borderRadius: 12,
          background: "#1b1f25",
          fontSize: 18,
        }}>
          {active.length}
        </strong>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(2,minmax(0,1fr))",
        gap: 8,
        marginTop: 14,
      }}>
        {[
          [attention.length, "atenção"],
          [tracking.length, "com tracking"],
          [deferred.length, "projeções aguardando etapa"],
          [historyHasMore ? "…" : "OK", historyHasMore ? "histórico paginado" : "histórico carregado"],
        ].map(([value, label]) => (
          <div key={String(label)} style={{ padding: 10, borderRadius: 11, background: "#181c22" }}>
            <b style={{ display: "block", fontSize: 16 }}>{value}</b>
            <small style={{ color: "#8e96a3" }}>{label}</small>
          </div>
        ))}
      </div>

      <div style={{
        marginTop: 10,
        padding: 11,
        borderRadius: 12,
        background: "#181c22",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
      }}>
        <div>
          <b style={{ display: "block", fontSize: 13 }}>Site ↔ integração</b>
          <small style={{ color: remoteError ? "#f08c8c" : "#8e96a3" }}>
            {remoteError || remoteLabel}
          </small>
          {remote && (
            <small style={{ display: "block", color: "#707986", marginTop: 2 }}>
              Outbox: {remote.integration.outbox.pending} pend. ·
              Mensagens enviáveis: {remote.integration.messaging.pending} ·
              Legado/inelegível: {remote.integration.messaging.legacyOrIneligible} ·
              Quarentena: {remote.integration.quarantine}
            </small>
          )}
        </div>
        <button
          type="button"
          disabled={checking}
          onClick={() => void checkIntegration()}
          style={{
            border: "1px solid #303641",
            background: "#20252d",
            color: "inherit",
            borderRadius: 10,
            padding: "8px 10px",
            fontWeight: 800,
            fontSize: 11,
          }}
        >
          {checking ? "Consultando…" : remote ? "Atualizar" : "Verificar"}
        </button>
      </div>
    </section>
  );
}
