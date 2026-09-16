"use client";

import { create } from "zustand";

export type ModalType =
  | "cart"
  | "checkout"
  | "product-details"
  | "login"
  | "login-prompt"
  | "orders"
  | "order-success"
  | "rewards"
  | "account"
  | "terms"
  | "menu"
  | "pix"
  | "outros"
  | null;

export type CartToastState = {
  title: string;
  message?: string;
  kind?: "add" | "remove" | "restore";
  actionLabel?: string;
  onAction?: () => void;
};

interface UIStore {
  cartToast: CartToastState | null;
  showCartToast: (toast: CartToastState) => void;
  hideCartToast: () => void;
  isMobileMenuOpen: boolean;
  toggleMobileMenu: () => void;
  closeMobileMenu: () => void;
  activeModal: ModalType;
  modalData: unknown;
  openModal: (type: ModalType, data?: unknown) => void;
  closeModal: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  cartToast: null,
  showCartToast: (toast) => set({ cartToast: toast }),
  hideCartToast: () => set({ cartToast: null }),
  isMobileMenuOpen: false,
  toggleMobileMenu: () => set((state) => ({ isMobileMenuOpen: !state.isMobileMenuOpen })),
  closeMobileMenu: () => set({ isMobileMenuOpen: false }),
  activeModal: null,
  modalData: null,
  openModal: (type, data = null) => set({ activeModal: type, modalData: data }),
  closeModal: () => set({ activeModal: null, modalData: null }),
}));
