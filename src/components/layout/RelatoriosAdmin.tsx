"use client";

import { useState } from "react";
import { normalizarStatus } from "@/lib/orderUtils";
import { normalizePaymentMethod, orderDateToDate } from "@/lib/orderCompat";

export function RelatoriosAdmin({ pedidos }: { pedidos: any[] }) {
  const [filtroDias, setFiltroDias] = useState(0); // 0 = Hoje, 1 = Ontem, 7 = Semana

  // Lógica de Filtro de Data
    const filtrarPorData = (pedidoData: any) => {
    if (!pedidoData) return false;
    
    const dataDoPedido = orderDateToDate(pedidoData);
    if (!dataDoPedido) return false;
      
    const agora = new Date();
    const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime();
    const dataPedidoZerada = new Date(dataDoPedido.getFullYear(), dataDoPedido.getMonth(), dataDoPedido.getDate()).getTime();
    
    const diffEmDias = Math.floor((hoje - dataPedidoZerada) / (1000 * 60 * 60 * 24));
    
    if (filtroDias === 0) return diffEmDias === 0; 
    if (filtroDias === 1) return diffEmDias === 1; 
    return diffEmDias <= filtroDias && diffEmDias >= 0; 
  };

  const pedidosFiltrados = pedidos.filter(p => 
    normalizarStatus(p.status) === "Finalizado" && filtrarPorData(p.data)
  );

  const totalVendido = pedidosFiltrados.reduce((acc, p) => acc + (p.total || 0), 0);
  const totalPedidos = pedidosFiltrados.length;
  const ticketMedio = totalPedidos > 0 ? totalVendido / totalPedidos : 0;

  // Separação por método com TRADUÇÃO VISUAL
  const porMetodo = pedidosFiltrados.reduce((acc: any, p) => {
    const m = normalizePaymentMethod(p.metodoPagamento);
    acc[m] = (acc[m] || 0) + Number(p.total || 0);
    return acc;
  }, {});

  // Função para deixar o nome do método bonito no gráfico
  const formatMetodo = (m: string) => {
    const labels: any = {
      dinheiro: "💵 Dinheiro",
      cash: "💵 Dinheiro",
      cartao: "💳 Cartão",
      pix: "💠 Pix",
      outro: "Outro"
    };
    return labels[m] || m;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", color: "#111" }}>
      
      {/* SELETOR DE PERÍODO */}
      <div style={{ display: "flex", gap: "10px", overflowX: "auto", paddingBottom: "5px" }}>
        {[
          { label: "Hoje", valor: 0 },
          { label: "Ontem", valor: 1 },
          { label: "7 Dias", valor: 7 },
          { label: "30 Dias", valor: 30 }
        ].map(f => (
          <button 
            key={f.label}
            onClick={() => setFiltroDias(f.valor)}
            style={{ 
              padding: "8px 20px", borderRadius: "20px", border: "1px solid #ddd",
              background: filtroDias === f.valor ? "#111" : "#fff",
              color: filtroDias === f.valor ? "#fff" : "#111",
              fontWeight: "bold", cursor: "pointer", whiteSpace: "nowrap"
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* CARDS DE KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "15px" }}>
        <div style={{ background: "#fff", padding: "15px", borderRadius: "15px", border: "2px solid #eee" }}>
          <span style={{ fontSize: "11px", color: "#666", fontWeight: "bold" }}>FATURAMENTO</span>
          <h3 style={{ margin: "5px 0", color: "#2e7d32", fontSize: "20px" }}>R$ {totalVendido.toFixed(2)}</h3>
        </div>
        <div style={{ background: "#fff", padding: "15px", borderRadius: "15px", border: "1px solid #eee" }}>
          <span style={{ fontSize: "11px", color: "#666", fontWeight: "bold" }}>PEDIDOS</span>
          <h3 style={{ margin: "5px 0", fontSize: "20px" }}>{totalPedidos}</h3>
        </div>
        <div style={{ background: "#fff", padding: "15px", borderRadius: "15px", border: "1px solid #eee" }}>
          <span style={{ fontSize: "11px", color: "#666", fontWeight: "bold" }}>TICKET MÉDIO</span>
          <h3 style={{ margin: "5px 0", fontSize: "20px" }}>R$ {ticketMedio.toFixed(2)}</h3>
        </div>
      </div>

      {/* MINI GRÁFICO DE MÉTODOS */}
      <div style={{ background: "#fff", padding: "20px", borderRadius: "15px", border: "1px solid #eee" }}>
        <h4 style={{ margin: "0 0 15px 0", fontSize: "14px", fontWeight: "900" }}>💰 Vendas por Método</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          {Object.entries(porMetodo).length === 0 ? (
            <p style={{ color: "#999", fontSize: "12px" }}>Sem dados de pagamento no período.</p>
          ) : (
            Object.entries(porMetodo).map(([metodo, valor]: any) => {
              const porcentagem = totalVendido > 0 ? (valor / totalVendido) * 100 : 0;
              return (
                <div key={metodo}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "6px" }}>
                    <span style={{ fontWeight: "500" }}>{formatMetodo(metodo)}</span>
                    <span style={{ fontWeight: "bold" }}>R$ {valor.toFixed(2)} ({porcentagem.toFixed(0)}%)</span>
                  </div>
                  <div style={{ width: "100%", height: "10px", background: "#f0f0f0", borderRadius: "5px", overflow: "hidden" }}>
                    <div style={{ 
                        width: `${porcentagem}%`, 
                        height: "100%", 
                        background: metodo.includes("pix") ? "#00bcd4" : "#111",
                        borderRadius: "5px" 
                    }}></div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* HISTÓRICO DE LOGÍSTICA */}
      <div style={{ background: "#fff", padding: "20px", borderRadius: "15px", border: "1px solid #eee" }}>
        <h4 style={{ margin: "0 0 15px 0", fontSize: "14px", fontWeight: "900" }}>🛵 Entregas do Rodrigo ({pedidosFiltrados.filter(p => p.entregador === "rodrigo").length})</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {pedidosFiltrados.filter(p => p.entregador === "rodrigo").length === 0 ? (
            <p style={{ color: "#999", fontSize: "12px" }}>Nenhuma entrega registrada.</p>
          ) : (
            pedidosFiltrados.filter(p => p.entregador === "rodrigo").map(p => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px", background: "#f9f9f9", borderRadius: "8px", fontSize: "12px" }}>
                <span style={{ fontWeight: "bold" }}>#{p.id.slice(-4)} - {p.userName}</span>
                <span style={{ color: "#666" }}>{p.total?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
