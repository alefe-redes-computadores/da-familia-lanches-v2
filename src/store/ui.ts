"use client";

import { create } from "zustand";

// Aqui estão TODOS os tipos de modais do seu projeto antigo e do novo
export type ModalType = "cart" | "checkout" | "product-details" | "login" | "orders" | "rewards" | "terms" | "menu" | "pix" | null;

interface UIStore {
  // --- Vindo do ui.ts (Menu Mobile) ---
  isMobileMenuOpen: boolean;
  toggleMobileMenu: () => void;
  closeMobileMenu: () => void;

  // --- Vindo do ui.store.ts (Modais) ---
  activeModal: ModalType;
  modalData: any; 
  
  openModal: (type: ModalType, data?: any) => void;
  closeModal: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  // Estado Inicial do Menu
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