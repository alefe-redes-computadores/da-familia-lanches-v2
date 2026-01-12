"use client";

import { useUIStore } from "@/store/ui";

// Imports dos componentes de Modal
import { LoginModal } from "./LoginModal";
import { CartModal } from "./CartModal";
import { PixModal } from "./PixModal"; 
import { TermsModal } from "./TermsModal"; 

export function ModalRoot() {
  const activeModal = useUIStore((s) => s.activeModal);

  if (!activeModal) return null;

  // 1. Login
  if (activeModal === "login") return <LoginModal />;

  // 2. Carrinho
  if (activeModal === "cart") return <CartModal />;

  // 3. PIX
  if (activeModal === "pix") return <PixModal />;

  // 4. Termos de Privacidade
  if (activeModal === "terms") return <TermsModal />;

  // NOTA: O "menu" não entra aqui porque o AppShell já carrega o MobileDrawerMenu
  
  return null;
}
