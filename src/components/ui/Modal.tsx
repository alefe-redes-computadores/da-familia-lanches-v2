"use client";

import { ReactNode } from "react";
import { useUIStore } from "@/store/ui";
import { ModalBase } from "./ModalBase";

type ModalProps = {
  title?: string;
  children: ReactNode;
};

// Este componente agora é apenas um "wrapper" inteligente
// Ele pega a função de fechar do sistema e passa para o visual
export function Modal({ title, children }: ModalProps) {
  const closeModal = useUIStore((s) => s.closeModal);

  return (
    <ModalBase title={title || ""} onClose={closeModal}>
      {children}
    </ModalBase>
  );
}