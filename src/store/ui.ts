import { create } from "zustand";

type ModalType = "cart" | "checkout" | "product-details" | "login" | "orders" | null;

interface UIStore {
  // Estado do Menu Lateral (Mobile)
  isMobileMenuOpen: boolean;
  toggleMobileMenu: () => void;
  closeMobileMenu: () => void;

  // Estado dos Modais
  isModalOpen: boolean;
  modalType: ModalType;
  modalData: any; // Para passar dados pro modal (ex: produto clicado)
  
  openModal: (type: ModalType, data?: any) => void;
  closeModal: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  // --- Lógica do Menu Mobile ---
  isMobileMenuOpen: false,
  
  toggleMobileMenu: () => set((state) => ({ 
    isMobileMenuOpen: !state.isMobileMenuOpen 
  })),
  
  closeMobileMenu: () => set({ isMobileMenuOpen: false }),

  // --- Lógica dos Modais ---
  isModalOpen: false,
  modalType: null,
  modalData: null,

  openModal: (type, data = null) => set({ 
    isModalOpen: true, 
    modalType: type,
    modalData: data 
  }),
  
  closeModal: () => set({ 
    isModalOpen: false, 
    modalType: null, 
    modalData: null 
  }),
}));