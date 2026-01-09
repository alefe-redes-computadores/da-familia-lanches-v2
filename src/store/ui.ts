"use client";

import { create } from "zustand";

// Unificação de todos os tipos de modais encontrados nos logs de erro
export type ModalType = 
  | "cart" 
  | "checkout" 
  | "product-details" 
  | "login" 
  | "orders" 
  | "rewards" 
  | "terms" 
  | "menu" 
  | "pix" 
  | "outros" // Adicionado para evitar erro no OrdersModal
  | null;

interface UIStore {
  // --- Estado do Menu Lateral (Mobile) ---
  isMobileMenuOpen: boolean;
  toggleMobileMenu: () => void;
  closeMobileMenu: () => void;

  // --- Estado dos Modais (Unificado) ---
  activeModal: ModalType;
  modalData: any; 
  
  openModal: (type: ModalType, data?: any) => void;
  closeModal: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  // Estado Inicial do Menu Mobile
  isMobileMenuOpen: false,
  toggleMobileMenu: () => set((state) => ({ isMobileMenuOpen: !state.isMobileMenuOpen })),
  closeMobileMenu: () => set({ isMobileMenuOpen: false }),

  // Estado Inicial dos Modais
  activeModal: null,
  modalData: null,

  openModal: (type, data = null) => set({ 
    activeModal: type,
    modalData: data 
  }),
  
  closeModal: () => set({ 
    activeModal: null, 
    modalData: null 
  }),
}));