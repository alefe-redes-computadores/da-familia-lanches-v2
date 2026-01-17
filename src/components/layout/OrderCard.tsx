"use client";

import { useCartStore } from "@/store/cart.store"; 
import { normalizarStatus, getColorByStatus, formatarData } from "@/lib/orderUtils";

export function OrderCard({ pedido, updateStatus, imprimirPedido }: any) {
  const statusAtual = normalizarStatus(pedido.status);
  const itensValidos = Array.isArray(pedido.itens) ? pedido.itens : [];

  const handleZapManual = () => {
    const f = (pedido.userPhone || pedido.phone || "").replace(/\D/g, "");
    const fone = f.startsWith("55") ? f : `55${f}`;
    window.open(`https://api.whatsapp.com/send?phone=${fone}`, "_blank");
  };

  return (
    <div style={{ 
      background: "#fff", border: "1px solid #eee", borderRadius: "18px", padding: "18px",
      boxShadow: "0 6px 15px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column",
      borderLeft: `8px solid ${getColorByStatus(pedido.status)}`
    }}>
      {/* CABEÇALHO E STATUS */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <span style={{ fontSize: "11px", fontWeight: "900", color: getColorByStatus(pedido.status) }}>
          {statusAtual.toUpperCase()}
        </span>
        <div style={{ display: "flex", gap: "8px" }}>
          <span style={{ fontSize: "11px", color: "#aaa" }}>{formatarData(pedido.data)}</span>
          <button onClick={() => imprimirPedido(pedido)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px" }}>🖨️</button>
        </div>
      </div>

      {/* CLIENTE E CONTATO */}
      <div style={{ marginBottom: "12px" }}>
        <h3 style={{ margin: "0", fontSize: "18px", fontWeight: "800" }}>{pedido.userName || "Cliente"}</h3>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "5px" }}>
          <span style={{ background: "#ffca28", padding: "2px 8px", borderRadius: "6px", fontWeight: "bold", fontSize: "12px" }}>
            📞 {pedido.userPhone || pedido.phone || "S/ Tel"}
          </span>
          <button onClick={handleZapManual} style={{ background: "#25D366", border: "none", borderRadius: "50%", width: "26px", height: "26px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          </button>
        </div>
      </div>

      {/* ENTREGA / ENDEREÇO */}
      <div style={{ padding: "10px", borderRadius: "10px", background: pedido.tipoEntrega === "pickup" ? "#e3f2fd" : "#fff3e0", fontSize: "12px", marginBottom: "12px", border: "1px solid #ddd" }}>
        <b>{pedido.tipoEntrega === "pickup" ? "🥡 RETIRADA" : "🛵 ENTREGA"}</b><br/>{pedido.endereco || "No balcão"}
      </div>

      {/* ITENS DO PEDIDO */}
      <div style={{ background: "#f8f9fa", borderRadius: "12px", padding: "12px", marginBottom: "12px", flex: 1 }}>
        {itensValidos.map((item: any, idx: number) => (
          <div key={idx} style={{ marginBottom: "8px", borderBottom: idx !== itensValidos.length - 1 ? "1px dashed #eee" : "none", paddingBottom: "5px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
              <b>{item.quantity}x {item.name}</b>
            </div>
            {item.selectedAddons?.map((a: any, i: number) => (
              <div key={i} style={{ fontSize: "11px", color: "#d32f2f", fontWeight: "bold" }}>+ {a.name.toUpperCase()}</div>
            ))}
          </div>
        ))}

        {/* 📝 OBSERVAÇÕES (v5.0 - Já preparado para quando o cliente enviar) */}
        {pedido.observacao && (
          <div style={{ marginTop: "10px", padding: "8px", background: "#fff9c4", borderRadius: "8px", borderLeft: "4px solid #fbc02d", fontSize: "12px" }}>
            <b>📝 OBS:</b> {pedido.observacao}
          </div>
        )}
      </div>

      {/* 💳 PAGAMENTO E TOTAL (BLINDAGEM DO MONITOR) */}
      <div style={{ background: "#eee", borderRadius: "12px", padding: "10px", marginBottom: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "10px", color: "#666", fontWeight: "bold", textTransform: "uppercase" }}>Pagamento</span>
            <span style={{ fontSize: "14px", fontWeight: "800", color: "#333" }}>
              {pedido.metodoPagamento === "dinheiro" ? "💵 DINHEIRO" : 
               pedido.metodoPagamento === "pix" ? "💎 PIX" : 
               pedido.metodoPagamento === "cartao" ? "💳 CARTÃO" : "⚠️ NÃO INFORMADO"}
            </span>
          </div>
          <div style={{ textAlign: "right" }}>
            <span style={{ fontSize: "10px", color: "#666", fontWeight: "bold", textTransform: "uppercase" }}>Total</span><br/>
            <span style={{ fontSize: "20px", fontWeight: "900", color: "#111" }}>R$ {Number(pedido.total || 0).toFixed(2)}</span>
          </div>
        </div>
        
        {/* EXIBIÇÃO DO TROCO (SE HOUVER) */}
        {pedido.metodoPagamento === "dinheiro" && pedido.trocoPara && (
          <div style={{ marginTop: "5px", paddingTop: "5px", borderTop: "1px solid #ddd", fontSize: "12px", color: "#d32f2f", fontWeight: "bold" }}>
            Troco para: R$ {Number(pedido.trocoPara).toFixed(2)} 
            (R$ {(Number(pedido.trocoPara) - Number(pedido.total)).toFixed(2)})
          </div>
        )}
      </div>

      {/* BOTÕES DE AÇÃO */}
      <div style={{ display: "flex", gap: "8px" }}>
        {statusAtual === "Pendente" && (
          <button onClick={() => updateStatus(pedido.id, "Em Produção")} style={{ flex: 1, padding: "12px", borderRadius: "10px", background: "#ffca28", border: "none", fontWeight: "bold", cursor: "pointer" }}>ACEITAR</button>
        )}
        {statusAtual === "Em Produção" && (
          <button onClick={() => updateStatus(pedido.id, "Pronto", pedido)} style={{ flex: 1, padding: "12px", borderRadius: "10px", background: "#4caf50", color: "#fff", border: "none", fontWeight: "bold", cursor: "pointer" }}>PRONTO</button>
        )}
        {statusAtual === "Pronto" && (
          <button onClick={() => updateStatus(pedido.id, "Saiu para Entrega", pedido)} style={{ flex: 1, padding: "12px", borderRadius: "10px", background: "#2196f3", color: "#fff", border: "none", fontWeight: "bold", cursor: "pointer" }}>DESPACHAR</button>
        )}
        {(statusAtual === "Saiu para Entrega" || (statusAtual === "Pronto" && pedido.tipoEntrega === "pickup")) && (
          <button onClick={() => updateStatus(pedido.id, "Finalizado")} style={{ flex: 1, padding: "12px", borderRadius: "10px", background: "#111", color: "#fff", border: "none", fontWeight: "bold", cursor: "pointer" }}>CONCLUIR</button>
        )}
      </div>
    </div>
  );
}
