"use client";

import { create } from "zustand";

type UIStore = {
  // Modais atuais (se você já usa)
  activeModal: null | "cart" | "login" | "orders" | "rewards";
  openModal: (modal: UIStore["activeModal"]) => void;
  closeModal: () => void;

  // Drawer menu
  isMenuOpen: boolean;
  openMenu: () => void;
  closeMenu: () => void;
  toggleMenu: () => void;
};

export const useUIStore = create<UIStore>((set) => ({
  // Modais
  activeModal: null,
  openModal: (modal) => set({ activeModal: modal }),
  closeModal: () => set({ activeModal: null }),

  // Drawer
  isMenuOpen: false,
  openMenu: () => set({ isMenuOpen: true }),
  closeMenu: () => set({ isMenuOpen: false }),
  toggleMenu: () => set((s) => ({ isMenuOpen: !s.isMenuOpen })),
}));