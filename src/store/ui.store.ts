"use client";

import { create } from "zustand";

type UIStore = {
  // Lista completa de todos os modais do site
  activeModal: null | "cart" | "login" | "orders" | "rewards" | "menu" | "terms" | "checkout" | "product-details";
  openModal: (modal: UIStore["activeModal"]) => void;
  closeModal: () => void;

  // Controle do Menu Lateral (Drawer)
  isMenuOpen: boolean;
  openMenu: () => void;
  closeMenu: () => void;
  toggleMenu: () => void;
};

export const useUIStore = create<UIStore>((set) => ({
  // Estado inicial dos modais
  activeModal: null,
  openModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: null }),

  // Estado inicial do Menu
  isMenuOpen: false,
  openMenu: () => set({ isMenuOpen: true }),
  closeMenu: () => set({ isMenuOpen: false }),
  toggleMenu: () => set((s) => ({ isMenuOpen: !s.isMenuOpen })),
}));