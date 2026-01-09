"use client";

import { useEffect, useState } from "react";
import { useUIStore } from "@/store/ui";

export function PrivacyBanner() {
  const [visible, setVisible] = useState(false);
  const openModal = useUIStore((s) => s.openModal);

  useEffect(() => {
    // Verifica se já aceitou antes
    const accepted = localStorage.getItem("dfl-privacy-accepted");
    if (!accepted) {
      // Pequeno delay para animação suave
      setTimeout(() => setVisible(true), 1000);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("dfl-privacy-accepted", "true");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: "20px",
      left: "20px",
      right: "20px",
      background: "#fff",
      borderRadius: "16px",
      padding: "20px",
      boxShadow: "0 10px 40px rgba(0,0,0,0.15)",
      border: "1px solid #eee",
      zIndex: 200,
      display: "flex",
      flexDirection: "column", // Mobile first
      gap: "15px",
      maxWidth: "1200px",
      margin: "0 auto",
      animation: "slideUp 0.5s ease-out"
    }}>
      <div style={{ flex: 1 }}>
        <strong style={{ fontSize: "15px", display: "block", marginBottom: "5px" }}>🍪 Privacidade e Cookies</strong>
        <p style={{ margin: 0, fontSize: "13px", color: "#666", lineHeight: "1.5" }}>
          Usamos cookies para garantir que você tenha a melhor experiência. 
          Ao continuar, você concorda com nossa <button onClick={() => openModal("terms")} style={{ background: "none", border: "none", padding: 0, color: "#4caf50", textDecoration: "underline", cursor: "pointer", fontWeight: "bold" }}>Política de Privacidade</button>.
        </p>
      </div>

      <div style={{ display: "flex", gap: "10px" }}>
        <button
          onClick={handleAccept}
          style={{
            flex: 1,
            background: "#ffca28",
            color: "#000",
            border: "none",
            padding: "12px 20px",
            borderRadius: "8px",
            fontWeight: "800",
            cursor: "pointer",
            fontSize: "14px"
          }}
        >
          Aceitar e Fechar
        </button>
      </div>
      
      <style jsx>{`
        @keyframes slideUp {
          from { transform: translateY(100px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @media (min-width: 768px) {
           div[style*="flex-direction: column"] {
             flex-direction: row !important;
             align-items: center;
           }
           button {
             width: auto;
             flex: initial;
           }
        }
      `}</style>
    </div>
  );
}