"use client";

import { useState } from "react";
import { normalizarStatus } from "@/lib/orderUtils";

export function RelatoriosAdmin({ pedidos }: { pedidos: any[] }) {
  const [filtroDias, setFiltroDias] = useState(0); // 0 = Hoje, 1 = Ontem, 7 = Semana

  // Lógica de Filtro de Data
  const filtrarPorData = (pedidoData: any) => {
    const dataPedido = new Date(pedidoData).setHours(0,0,0,0);
    const hoje = new Date().setHours(0,0,0,0);
    const diffEmDias = Math.floor((hoje - dataPedido) / (1000 * 60 * 60 * 24));
    
    if (filtroDias === 0) return diffEmDias === 0;
    if (filtroDias === 1) return diffEmDias === 1;
    return diffEmDias <= filtroDias;
  };

  const pedidosFiltrados = pedidos.filter(p => 
    normalizarStatus(p.status) === "Finalizado" && filtrarPorData(p.data)
  );

  const totalVendido = pedidosFiltrados.reduce((acc, p) => acc + (p.total || 0), 0);
  const totalPedidos = pedidosFiltrados.length;
  const ticketMedio = totalPedidos > 0 ? totalVendido / totalPedidos : 0;

  // Separação por método
  const porMetodo = pedidosFiltrados.reduce((acc: any, p) => {
    const m = p.metodoPagamento || "Outro";
    acc[m] = (acc[m] || 0) + (p.total || 0);
    return acc;
  }, {});

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
        <div style={{ background: "#fff", padding: "15px", borderRadius: "15px", border: "1px solid #eee" }}>
          <span style={{ fontSize: "11px", color: "#666" }}>FATURAMENTO BRUTO</span>
          <h3 style={{ margin: "5px 0", color: "#2e7d32" }}>R$ {totalVendido.toFixed(2)}</h3>
        </div>
        <div style={{ background: "#fff", padding: "15px", borderRadius: "15px", border: "1px solid #eee" }}>
          <span style={{ fontSize: "11px", color: "#666" }}>PEDIDOS CONCLUÍDOS</span>
          <h3 style={{ margin: "5px 0" }}>{totalPedidos}</h3>
        </div>
        <div style={{ background: "#fff", padding: "15px", borderRadius: "15px", border: "1px solid #eee" }}>
          <span style={{ fontSize: "11px", color: "#666" }}>TICKET MÉDIO</span>
          <h3 style={{ margin: "5px 0" }}>R$ {ticketMedio.toFixed(2)}</h3>
        </div>
      </div>

      {/* MINI GRÁFICO DE MÉTODOS */}
      <div style={{ background: "#fff", padding: "20px", borderRadius: "15px", border: "1px solid #eee" }}>
        <h4 style={{ margin: "0 0 15px 0", fontSize: "14px" }}>💰 Vendas por Método</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {Object.entries(porMetodo).map(([metodo, valor]: any) => {
            const porcentagem = (valor / totalVendido) * 100;
            return (
              <div key={metodo}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                  <span>{metodo}</span>
                  <span style={{ fontWeight: "bold" }}>R$ {valor.toFixed(2)}</span>
                </div>
                <div style={{ width: "100%", height: "8px", background: "#f0f0f0", borderRadius: "4px", overflow: "hidden" }}>
                  <div style={{ width: `${porcentagem}%`, height: "100%", background: "#111" }}></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* HISTÓRICO DE LOGÍSTICA (RODRIGO) NO PERÍODO */}
      <div style={{ background: "#fff", padding: "20px", borderRadius: "15px", border: "1px solid #eee" }}>
        <h4 style={{ margin: "0 0 15px 0", fontSize: "14px" }}>🛵 Entregas do Rodrigo no Período</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {pedidosFiltrados.filter(p => p.entregador === "rodrigo").length === 0 ? (
            <p style={{ color: "#999", fontSize: "12px" }}>Nenhuma entrega registrada.</p>
          ) : (
            pedidosFiltrados.filter(p => p.entregador === "rodrigo").map(p => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px", borderBottom: "1px solid #f9f9f9", fontSize: "12px" }}>
                <span>#{p.id.slice(-4)} - {p.userName}</span>
                <span style={{ color: "#666" }}>{new Date(p.data).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
