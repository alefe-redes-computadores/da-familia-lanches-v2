"use client";

import { useUIStore } from "@/store/ui";
import { ModalBase } from "./ModalBase";

// Imports dos componentes de Modal
import { LoginModal } from "./LoginModal";
import { CartModal } from "./CartModal";
import { PixModal } from "./PixModal"; 
import { TermsModal } from "./TermsModal"; 

export function ModalRoot() {
  // Agora o seletor busca exatamente o que existe na Store
  const activeModal = useUIStore((s) => s.activeModal);
  const closeModal = useUIStore((s) => s.closeModal);

  if (!activeModal) return null;

  // 1. Login
  if (activeModal === "login") return <LoginModal />;

  // 2. Carrinho
  if (activeModal === "cart") return <CartModal />;

  // 3. PIX
  if (activeModal === "pix") return <PixModal />;

  // 4. Termos de Privacidade
  if (activeModal === "terms") return <TermsModal />;

  // 5. Menu Lateral (Caso seja chamado como modal)
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
            <span style={{ fontSize: "20px" }}>📦</span>
            <div>
              <div style={{ fontWeight: "800", color: "#333" }}>Meus Pedidos</div>
              <div style={{ fontSize: "12px", color: "#666" }}>Histórico</div>
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
};