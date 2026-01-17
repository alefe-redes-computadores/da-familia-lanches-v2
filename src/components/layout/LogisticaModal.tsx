"use client";

import { useState } from "react";

interface LogisticaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (motoboy: "rodrigo" | "avulso") => void;
}

export function LogisticaModal({ isOpen, onClose, onConfirm }: LogisticaModalProps) {
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async (motoboy: "rodrigo" | "avulso") => {
    setLoading(true);
    try {
      await onConfirm(motoboy);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      backgroundColor: "rgba(0,0,0,0.85)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 9999,
      padding: "20px",
      backdropFilter: "blur(4px)"
    }}>
      <div style={{
        background: "#fff",
        padding: "25px",
        borderRadius: "24px",
        width: "100%",
        maxWidth: "350px",
        textAlign: "center",
        boxShadow: "0 20px 40px rgba(0,0,0,0.4)"
      }}>
        <div style={{ fontSize: "40px", marginBottom: "10px" }}>🛵</div>
        <h2 style={{ margin: "0 0 5px 0", fontSize: "22px", fontWeight: "800", color: "#111" }}>
          Despachar Pedido
        </h2>
        <p style={{ color: "#666", fontSize: "14px", marginBottom: "25px" }}>
          Quem vai fazer esta entrega?
        </p>

        <div style={{ display: "grid", gap: "12px" }}>
          <button
            disabled={loading}
            onClick={() => handleConfirm("rodrigo")}
            style={{
              padding: "18px",
              borderRadius: "15px",
              border: "none",
              background: loading ? "#ccc" : "#673ab7",
              color: "#fff",
              fontWeight: "bold",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: "16px",
              transition: "all 0.2s"
            }}
          >
            {loading ? "Processando..." : "👤 Rodrigo (Fixo)"}
          </button>

          <button
            disabled={loading}
            onClick={() => handleConfirm("avulso")}
            style={{
              padding: "18px",
              borderRadius: "15px",
              border: "2px solid #eee",
              background: "#f9f9f9",
              color: "#333",
              fontWeight: "bold",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: "16px"
            }}
          >
            🏃 Outro / iFood
          </button>

          <button 
            disabled={loading}
            onClick={onClose} 
            style={{ 
              marginTop: "10px", 
              background: "none", 
              border: "none", 
              color: "#999", 
              cursor: "pointer",
              fontSize: "14px",
              textDecoration: "underline"
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
