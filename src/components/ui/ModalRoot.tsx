"use client";

import { useUIStore } from "@/store/ui";
import { ModalBase } from "./ModalBase";

// Imports dos componentes de Modal
import { LoginModal } from "./LoginModal";
import { CartModal } from "./CartModal";
import { PixModal } from "./PixModal"; 
// ATUALIZADO: Importando o modal de termos
import { TermsModal } from "./TermsModal"; 

export function ModalRoot() {
  const activeModal = useUIStore((s) => s.activeModal);
  const closeModal = useUIStore((s) => s.closeModal);

  if (!activeModal) return null;

  // 1. Login
  if (activeModal === "login") {
    return <LoginModal />;
  }

  // 2. Carrinho
  if (activeModal === "cart") {
    return <CartModal />;
  }

  // 3. PIX
  if (activeModal === "pix") {
    return <PixModal />;
  }

  // 4. Termos de Privacidade (NOVO)
  if (activeModal === "terms") {
    return <TermsModal />;
  }

  // 5. Menu (Fallback Bonito)
  if (activeModal === "menu") {
    return (
      <ModalBase title="Navegação" onClose={closeModal}>
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
          
          <button onClick={closeModal} style={menuBtnStyle}>
            <span style={{ fontSize: "20px" }}>🏠</span>
            <div>
              <div style={{ fontWeight: "800", color: "#333" }}>Início</div>
              <div style={{ fontSize: "12px", color: "#666" }}>Página inicial</div>
            </div>
          </button>

          <button onClick={closeModal} style={menuBtnStyle}>
            <span style={{ fontSize: "20px" }}>🍔</span>
            <div>
              <div style={{ fontWeight: "800", color: "#333" }}>Cardápio</div>
              <div style={{ fontSize: "12px", color: "#666" }}>Ver delícias</div>
            </div>
          </button>

          <button onClick={closeModal} style={menuBtnStyle}>
            <span style={{ fontSize: "20px" }}>📦</span>
            <div>
              <div style={{ fontWeight: "800", color: "#333" }}>Meus Pedidos</div>
              <div style={{ fontSize: "12px", color: "#666" }}>Histórico</div>
            </div>
          </button>

          <button onClick={closeModal} style={menuBtnStyle}>
            <span style={{ fontSize: "20px" }}>📞</span>
            <div>
              <div style={{ fontWeight: "800", color: "#333" }}>Contato</div>
              <div style={{ fontSize: "12px", color: "#666" }}>Fale conosco</div>
            </div>
          </button>

        </div>
      </ModalBase>
    );
  }

  return null;
}

const menuBtnStyle = {
  display: "flex",
  alignItems: "center",
  gap: "16px",
  width: "100%",
  padding: "16px",
  background: "#f8f9fa",
  border: "1px solid #eee",
  borderRadius: "12px",
  textAlign: "left" as const,
  cursor: "pointer",
  transition: "transform 0.1s",
};