"use client";

import { create } from "zustand";

type UIStore = {
  // Modais atualizados para incluir 'terms'
  activeModal: null | "cart" | "login" | "orders" | "rewards" | "terms";
  openModal: (modal: UIStore["activeModal"]) => void;
  closeModal: () => void;

  // Drawer menu
  isMenuOpen: boolean;
  openMenu: () => void;
  closeMenu: () => void;
  toggleMenu: () => void;
};

export const useUIStore = create<UIStore>((set) => ({
  activeModal: null,
  openModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: null }),

  isMenuOpen: false,
  openMenu: () => set({ isMenuOpen: true }),
  closeMenu: () => set({ isMenuOpen: false }),
  toggleMenu: () => set((s) => ({ isMenuOpen: !s.isMenuOpen })),
}));