"use client";

import { useState } from "react";
import { db } from "@/lib/firebase";
import { updateDoc, doc } from "firebase/firestore";

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
  const [editando, setEditando] = useState(false);
  const [novoSaldo, setNovoSaldo] = useState(saldoAcumulado);

  // Sugestão de cálculo (apenas visual, não grava automático)
  const sugerirDiaria = () => {
    if (totalEntregas === 0) return 0;
    if (totalEntregas <= 10) return garantiaMinima;
    return garantiaMinima + (totalEntregas - 10) * taxaBase;
  };

  const diariaSugerida = sugerirDiaria();

  const salvarSaldoManual = async () => {
    try {
      await updateDoc(doc(db, "Entregadores", "rodrigo"), {
        saldoAcumulado: Number(novoSaldo)
      });
      setEditando(false);
      alert("Saldo atualizado!");
    } catch (e) { alert("Erro ao salvar"); }
  };

  const lancarDiariaManual = async () => {
    if (!confirm(`Lançar R$ ${diariaSugerida} ao saldo acumulado?`)) return;
    try {
      await updateDoc(doc(db, "Entregadores", "rodrigo"), {
        saldoAcumulado: saldoAcumulado + diariaSugerida
      });
      alert("Diária lançada com sucesso!");
    } catch (e) { alert("Erro ao lançar"); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      
      {/* CARD DE SALDO EDITÁVEL */}
      <div style={{ 
        background: "#fff", padding: "25px", borderRadius: "20px", 
        border: "2px solid #111", textAlign: "center", boxShadow: "0 10px 20px rgba(0,0,0,0.05)" 
      }}>
        <span style={{ fontSize: "12px", fontWeight: "bold", color: "#666" }}>SALDO ATUAL (DÍVIDA)</span>
        
        {editando ? (
          <div style={{ marginTop: "10px" }}>
            <input 
              type="number" 
              value={novoSaldo} 
              onChange={(e) => setNovoSaldo(Number(e.target.value))}
              style={{ fontSize: "24px", width: "150px", textAlign: "center", padding: "5px", borderRadius: "8px" }}
            />
            <div style={{ marginTop: "10px", display: "flex", gap: "5px", justifyContent: "center" }}>
              <button onClick={salvarSaldoManual} style={{ background: "#4caf50", color: "#fff", border: "none", padding: "5px 15px", borderRadius: "5px" }}>Salvar</button>
              <button onClick={() => setEditando(false)} style={{ background: "#f44336", color: "#fff", border: "none", padding: "5px 15px", borderRadius: "5px" }}>X</button>
            </div>
          </div>
        ) : (
          <h2 onClick={() => { setNovoSaldo(saldoAcumulado); setEditando(true); }} style={{ margin: "10px 0", fontSize: "36px", fontWeight: "900", cursor: "pointer" }}>
            R$ {saldoAcumulado.toFixed(2)} ✏️
          </h2>
        )}
        <p style={{ fontSize: "11px", color: "#888" }}>Clique no valor para ajustar manualmente</p>
      </div>

      {/* SUGESTÃO DE HOJE */}
      <div style={{ background: "#e3f2fd", padding: "15px", borderRadius: "15px", border: "1px solid #bbdefb", textAlign: "center" }}>
        <span style={{ fontSize: "12px", color: "#1976d2", fontWeight: "bold" }}>ENTREGAS DE HOJE: {totalEntregas}</span>
        <h3 style={{ margin: "5px 0" }}>Sugestão Diária: R$ {diariaSugerida.toFixed(2)}</h3>
        <button 
          onClick={lancarDiariaManual}
          style={{ background: "#1976d2", color: "#fff", border: "none", padding: "8px 15px", borderRadius: "8px", fontWeight: "bold", marginTop: "5px", cursor: "pointer" }}
        >
          ADICIONAR ESTA DIÁRIA AO SALDO
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        <button 
          onClick={() => onRegistrarPagamento(saldoAcumulado)}
          style={{ padding: "15px", borderRadius: "12px", border: "none", background: "#111", color: "#fff", fontWeight: "bold", cursor: "pointer" }}
        >
          PAGAR TUDO (ZERAR)
        </button>
        <button 
          onClick={() => {
            const valor = Number(prompt("Valor do adiantamento/lanche:"));
            if (valor) updateDoc(doc(db, "Entregadores", "rodrigo"), { saldoAcumulado: saldoAcumulado - valor });
          }}
          style={{ padding: "15px", borderRadius: "12px", border: "1px solid #ddd", background: "#fff", color: "#333", fontWeight: "bold", cursor: "pointer" }}
        >
          DESCONTAR VALOR
        </button>
      </div>
    </div>
  );
}
