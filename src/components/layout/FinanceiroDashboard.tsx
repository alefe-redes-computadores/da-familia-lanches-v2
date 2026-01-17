"use client";

import { useState } from "react";

interface FinanceiroDashboardProps {
  dados: {
    totalEntregas: number;
    saldoAcumulado: number;
    taxaBase: number;
    garantiaMinima: number;
  };
  onRegistrarPagamento: (valor: number) => void;
}

export function FinanceiroDashboard({ dados, onRegistrarPagamento }: FinanceiroDashboardProps) {
  const { totalEntregas = 0, saldoAcumulado = 0, taxaBase = 7, garantiaMinima = 100 } = dados;

  // CÁLCULO DA REGRA: 100 fixos até 10 entregas, depois +7 por entrega.
  const calcularDiaria = () => {
    if (totalEntregas === 0) return 0;
    if (totalEntregas <= 10) return garantiaMinima;
    return garantiaMinima + (totalEntregas - 10) * taxaBase;
  };

  const diariaHoje = calcularDiaria();
  const saldoTotalComHoje = saldoAcumulado + diariaHoje;

  // Lógica de Cores: Se o saldo é > 0, a lanchonete DEVE (Vermelho).
  const corSaldo = saldoTotalComHoje > 0 ? "#d32f2f" : "#2e7d32";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      
      {/* CARD PRINCIPAL: SALDO TOTAL ACUMULADO */}
      <div style={{ 
        background: "#fff", padding: "25px", borderRadius: "20px", 
        border: `2px solid ${corSaldo}`, textAlign: "center",
        boxShadow: "0 10px 20px rgba(0,0,0,0.05)" 
      }}>
        <span style={{ fontSize: "12px", fontWeight: "bold", color: "#666", textTransform: "uppercase" }}>
          Dívida Total da Lanchonete (Acumulado)
        </span>
        <h2 style={{ margin: "10px 0", fontSize: "36px", fontWeight: "900", color: corSaldo }}>
          R$ {saldoTotalComHoje.toFixed(2)}
        </h2>
        <p style={{ fontSize: "12px", color: "#888", margin: 0 }}>
          {saldoTotalComHoje > 0 ? "⚠️ Valor a ser pago ao Rodrigo" : "✅ Acerto em dia"}
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
        {/* RESUMO DO TURNO ATUAL */}
        <div style={{ background: "#f8f9fa", padding: "15px", borderRadius: "15px", border: "1px solid #eee" }}>
          <span style={{ fontSize: "10px", color: "#666", fontWeight: "bold" }}>DIÁRIA DE HOJE</span>
          <h4 style={{ margin: "5px 0", fontSize: "20px" }}>R$ {diariaHoje.toFixed(2)}</h4>
          <span style={{ fontSize: "10px", color: "#999" }}>{totalEntregas} entregas realizadas</span>
        </div>

        {/* TAXA EXTRA */}
        <div style={{ background: "#f8f9fa", padding: "15px", borderRadius: "15px", border: "1px solid #eee" }}>
          <span style={{ fontSize: "10px", color: "#666", fontWeight: "bold" }}>EXTRAS ({totalEntregas > 10 ? totalEntregas - 10 : 0})</span>
          <h4 style={{ margin: "5px 0", fontSize: "20px" }}>
            R$ {totalEntregas > 10 ? ((totalEntregas - 10) * taxaBase).toFixed(2) : "0,00"}
          </h4>
          <span style={{ fontSize: "10px", color: "#999" }}>Acima de 10 entregas</span>
        </div>
      </div>

      {/* BOTÕES DE AÇÃO RÁPIDA */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        <button 
          onClick={() => onRegistrarPagamento(saldoTotalComHoje)}
          style={{ 
            padding: "15px", borderRadius: "12px", border: "none", 
            background: "#111", color: "#fff", fontWeight: "bold", cursor: "pointer" 
          }}
        >
          PAGAR TUDO (PIX)
        </button>
        <button 
          onClick={() => alert("Função: Descontar Consumo/Adiantamento")}
          style={{ 
            padding: "15px", borderRadius: "12px", border: "1px solid #ddd", 
            background: "#fff", color: "#333", fontWeight: "bold", cursor: "pointer" 
          }}
        >
          DESCONTAR...
        </button>
      </div>

    </div>
  );
}
