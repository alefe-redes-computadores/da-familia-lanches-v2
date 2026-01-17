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
  const [loading, setLoading] = useState(false);

  // Sugestão de cálculo (agora com proteção contra valores nulos)
  const sugerirDiaria = () => {
    if (totalEntregas === 0) return 0;
    if (totalEntregas <= 10) return garantiaMinima;
    return garantiaMinima + (totalEntregas - 10) * taxaBase;
  };

  const diariaSugerida = sugerirDiaria();

  const salvarSaldoManual = async () => {
    setLoading(true);
    try {
      await updateDoc(doc(db, "Entregadores", "rodrigo"), {
        saldoAcumulado: Number(novoSaldo)
      });
      setEditando(false);
      alert("✅ Saldo ajustado com sucesso!");
    } catch (e) { 
      alert("❌ Erro ao salvar saldo."); 
    } finally { setLoading(false); }
  };

  const lancarDiariaManual = async () => {
    if (!confirm(`Lançar R$ ${diariaSugerida.toFixed(2)} ao saldo acumulado?`)) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, "Entregadores", "rodrigo"), {
        saldoAcumulado: saldoAcumulado + diariaSugerida
      });
      alert("✅ Diária integrada ao saldo!");
    } catch (e) { 
      alert("❌ Erro ao lançar diária."); 
    } finally { setLoading(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      
      {/* CARD DE SALDO EDITÁVEL */}
      <div style={{ 
        background: "#fff", padding: "25px", borderRadius: "20px", 
        border: "2px solid #111", textAlign: "center", boxShadow: "0 10px 20px rgba(0,0,0,0.05)" 
      }}>
        <span style={{ fontSize: "12px", fontWeight: "bold", color: "#666" }}>SALDO ATUAL (DÍVIDA COM ENTREGADOR)</span>
        
        {editando ? (
          <div style={{ marginTop: "10px" }}>
            <input 
              type="number" 
              value={novoSaldo} 
              onChange={(e) => setNovoSaldo(Number(e.target.value))}
              style={{ fontSize: "24px", width: "150px", textAlign: "center", padding: "5px", borderRadius: "8px", border: "1px solid #ddd" }}
            />
            <div style={{ marginTop: "10px", display: "flex", gap: "5px", justifyContent: "center" }}>
              <button onClick={salvarSaldoManual} disabled={loading} style={{ background: "#4caf50", color: "#fff", border: "none", padding: "10px 15px", borderRadius: "8px", fontWeight: "bold" }}>
                {loading ? "..." : "Salvar"}
              </button>
              <button onClick={() => setEditando(false)} style={{ background: "#f44336", color: "#fff", border: "none", padding: "10px 15px", borderRadius: "8px", fontWeight: "bold" }}>Cancelar</button>
            </div>
          </div>
        ) : (
          <h2 onClick={() => { setNovoSaldo(saldoAcumulado); setEditando(true); }} style={{ margin: "10px 0", fontSize: "36px", fontWeight: "900", cursor: "pointer", color: saldoAcumulado > 0 ? "#d32f2f" : "#2e7d32" }}>
            R$ {saldoAcumulado.toFixed(2)} ✏️
          </h2>
        )}
        <p style={{ fontSize: "11px", color: "#888" }}>Toque no valor para ajuste rápido</p>
      </div>

      {/* SUGESTÃO DE HOJE */}
      <div style={{ background: "#e3f2fd", padding: "15px", borderRadius: "15px", border: "1px solid #bbdefb", textAlign: "center" }}>
        <span style={{ fontSize: "12px", color: "#1976d2", fontWeight: "bold" }}>ENTREGAS HOJE: {totalEntregas}</span>
        <h3 style={{ margin: "5px 0", color: "#111" }}>Sugestão Diária: R$ {diariaSugerida.toFixed(2)}</h3>
        <button 
          onClick={lancarDiariaManual}
          disabled={loading || diariaSugerida === 0}
          style={{ 
            background: diariaSugerida === 0 ? "#ccc" : "#1976d2", 
            color: "#fff", border: "none", padding: "12px 15px", 
            borderRadius: "10px", fontWeight: "bold", marginTop: "5px", 
            cursor: diariaSugerida === 0 ? "not-allowed" : "pointer",
            width: "100%"
          }}
        >
          {loading ? "Processando..." : "LANÇAR DIÁRIA NO SALDO"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        <button 
          onClick={() => onRegistrarPagamento(saldoAcumulado)}
          style={{ padding: "15px", borderRadius: "12px", border: "none", background: "#111", color: "#fff", fontWeight: "bold", cursor: "pointer" }}
        >
          ZERAR SALDO (PAGO)
        </button>
        <button 
          onClick={async () => {
            const valor = Number(prompt("Valor do adiantamento ou lanche:"));
            if (valor && !isNaN(valor)) {
                try {
                    await updateDoc(doc(db, "Entregadores", "rodrigo"), { saldoAcumulado: saldoAcumulado - valor });
                    alert("✅ Desconto aplicado!");
                } catch (e) { alert("❌ Erro ao descontar."); }
            }
          }}
          style={{ padding: "15px", borderRadius: "12px", border: "1px solid #ddd", background: "#fff", color: "#333", fontWeight: "bold", cursor: "pointer" }}
        >
          DESCONTAR VALOR
        </button>
      </div>
    </div>
  );
}
