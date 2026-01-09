"use client";

import { useState } from "react";
import { ModalBase } from "./ModalBase";
import { useUIStore } from "@/store/ui";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "@/lib/firebase"; // Importando a conexão que você criou

export function LoginModal() {
  const closeModal = useUIStore((s) => s.closeModal);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");

    try {
      // 1. Configura o provedor do Google
      const provider = new GoogleAuthProvider();
      
      // 2. Abre o Popup de Login
      await signInWithPopup(auth, provider);
      
      // 3. Se deu certo: fecha o modal e avisa
      closeModal();
      alert("Login realizado com sucesso! 🚀");
      
    } catch (err: any) {
      console.error("Erro no login:", err);
      setError("Erro ao conectar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalBase title="Acesse sua conta 👤" onClose={closeModal}>
      <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
        
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: "15px", color: "#555", margin: "0 0 8px 0" }}>
            Faça login para salvar seus pedidos e endereços.
          </p>
          <p style={{ fontSize: "13px", color: "#888", margin: 0 }}>
            É rápido e seguro.
          </p>
        </div>

        {error && (
          <div style={{ 
            background: "#ffebee", 
            color: "#c62828", 
            padding: "10px", 
            borderRadius: "8px", 
            fontSize: "14px",
            textAlign: "center"
          }}>
            {error}
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            width: "100%",
            padding: "14px",
            border: "1px solid #ddd",
            borderRadius: "12px",
            background: loading ? "#f5f5f5" : "#fff",
            fontWeight: "bold",
            color: "#333",
            cursor: loading ? "wait" : "pointer",
            fontSize: "16px",
            boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
            transition: "all 0.2s"
          }}
        >
            {loading ? (
              <span>⏳ Conectando...</span>
            ) : (
              <>
                <span style={{ fontSize: "18px", fontWeight: 900, color: "#4285F4" }}>G</span> 
                <span>Entrar com Google</span>
              </>
            )}
        </button>

        <p style={{ fontSize: "12px", color: "#aaa", textAlign: "center", marginTop: "10px" }}>
          Ao continuar, você concorda com nossos termos.
        </p>
      </div>
    </ModalBase>
  );
}