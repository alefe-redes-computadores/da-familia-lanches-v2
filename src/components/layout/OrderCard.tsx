"use client";

import { getOrderItems, paymentLabel } from "@/lib/orderCompat";
import { normalizarStatus, getColorByStatus, formatarData } from "@/lib/orderUtils";

export function OrderCard({ pedido, updateStatus, imprimirPedido }: any) {
  const statusAtual = normalizarStatus(pedido.status);
  const itensValidos = getOrderItems(pedido);
  const telefone = String(pedido.userPhone || pedido.phone || "").trim();
  const tipoEntrega = pedido.tipoEntrega === "pickup" ? "pickup" : "delivery";
  const trocoPara = Number(pedido.trocoPara ?? pedido.troco ?? 0);
  const total = Number(pedido.total || 0);

  const handleZapManual = () => {
    let digits = telefone.replace(/\D/g, "");
    if (!digits) return;
    if (!digits.startsWith("55")) digits = `55${digits}`;
    window.open(`https://api.whatsapp.com/send?phone=${digits}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 18, padding: 18, boxShadow: "0 6px 15px rgba(0,0,0,.03)", display: "flex", flexDirection: "column", borderLeft: `8px solid ${getColorByStatus(pedido.status)}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 900, color: getColorByStatus(pedido.status) }}>{statusAtual.toUpperCase()}</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#777" }}>{formatarData(pedido.data)}</span>
          <button aria-label="Imprimir pedido" title="Imprimir pedido" onClick={() => imprimirPedido(pedido)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16 }}>🖨️</button>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{pedido.userName || "Cliente"}</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
          <span style={{ background: "#ffca28", padding: "2px 8px", borderRadius: 6, fontWeight: "bold", fontSize: 12 }}>📞 {telefone || "S/ Tel"}</span>
          {telefone && <button aria-label="Abrir WhatsApp" onClick={handleZapManual} style={{ background: "#25D366", color: "#fff", border: "none", borderRadius: 999, minWidth: 30, height: 30, cursor: "pointer", fontWeight: 900 }}>W</button>}
        </div>
      </div>

      <div style={{ padding: 10, borderRadius: 10, background: tipoEntrega === "pickup" ? "#e3f2fd" : "#fff3e0", fontSize: 12, marginBottom: 12, border: "1px solid #ddd" }}>
        <b>{tipoEntrega === "pickup" ? "🥡 RETIRADA" : "🛵 ENTREGA"}</b><br />{pedido.endereco || (tipoEntrega === "pickup" ? "Retirada no balcão" : "Endereço não informado")}
      </div>

      <div style={{ background: "#f8f9fa", borderRadius: 12, padding: 12, marginBottom: 12, flex: 1 }}>
        {itensValidos.length ? itensValidos.map((item, idx) => (
          <div key={`${item.name}-${idx}`} style={{ marginBottom: 8, borderBottom: idx !== itensValidos.length - 1 ? "1px dashed #ddd" : "none", paddingBottom: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 14 }}><b>{item.quantity}x {item.name}</b></div>
            {item.selectedAddons.map((addon) => <div key={`${addon.id}-${addon.name}`} style={{ fontSize: 11, color: "#b3261e", fontWeight: 700 }}>+ {addon.name}</div>)}
            {item.observation && <div style={{ fontSize: 11, color: "#555", marginTop: 3 }}>Obs.: {item.observation}</div>}
          </div>
        )) : <div style={{ fontSize: 12, color: "#777" }}>Pedido antigo sem itens reconhecíveis.</div>}
        {pedido.observacao && <div style={{ marginTop: 10, padding: 8, background: "#fff9c4", borderRadius: 8, borderLeft: "4px solid #fbc02d", fontSize: 12 }}><b>OBS:</b> {pedido.observacao}</div>}
      </div>

      <div style={{ background: "#eee", borderRadius: 12, padding: 10, marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div><span style={{ fontSize: 10, color: "#666", fontWeight: 700, textTransform: "uppercase" }}>Pagamento</span><div style={{ fontSize: 14, fontWeight: 800 }}>{paymentLabel(pedido.metodoPagamento)}</div></div>
          <div style={{ textAlign: "right" }}><span style={{ fontSize: 10, color: "#666", fontWeight: 700, textTransform: "uppercase" }}>Total</span><br /><span style={{ fontSize: 20, fontWeight: 900 }}>R$ {Number.isFinite(total) ? total.toFixed(2) : "0.00"}</span></div>
        </div>
        {paymentLabel(pedido.metodoPagamento) === "DINHEIRO" && Number.isFinite(trocoPara) && trocoPara > 0 && <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid #ddd", fontSize: 12, color: "#b3261e", fontWeight: 700 }}>Troco para: R$ {trocoPara.toFixed(2)} {trocoPara >= total ? `(troco R$ ${(trocoPara - total).toFixed(2)})` : ""}</div>}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        {(statusAtual === "Pendente" || statusAtual === "Agendado") && <button onClick={() => updateStatus(pedido.id, "Em Produção", pedido)} style={{ flex: 1, padding: 12, borderRadius: 10, background: "#ffca28", border: "none", fontWeight: 800, cursor: "pointer" }}>ACEITAR</button>}
        {statusAtual === "Em Produção" && <button onClick={() => updateStatus(pedido.id, "Pronto", pedido)} style={{ flex: 1, padding: 12, borderRadius: 10, background: "#4caf50", color: "#fff", border: "none", fontWeight: 800, cursor: "pointer" }}>PRONTO</button>}
        {statusAtual === "Pronto" && tipoEntrega !== "pickup" && <button onClick={() => updateStatus(pedido.id, "Saiu para Entrega", pedido)} style={{ flex: 1, padding: 12, borderRadius: 10, background: "#2196f3", color: "#fff", border: "none", fontWeight: 800, cursor: "pointer" }}>DESPACHAR</button>}
        {(statusAtual === "Saiu para Entrega" || (statusAtual === "Pronto" && tipoEntrega === "pickup")) && <button onClick={() => updateStatus(pedido.id, "Finalizado", pedido)} style={{ flex: 1, padding: 12, borderRadius: 10, background: "#111", color: "#fff", border: "none", fontWeight: 800, cursor: "pointer" }}>CONCLUIR</button>}
      </div>
    </div>
  );
}
