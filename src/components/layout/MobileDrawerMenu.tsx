"use client";

import { useUIStore } from "@/store/ui";
import { useState } from "react";

export function MobileDrawerMenu() {
  // --- CORREÇÃO AQUI: Agora ele escuta o sistema de Modais ---
  const activeModal = useUIStore((s) => s.activeModal);
  const closeModal = useUIStore((s) => s.closeModal);
  const openModal = useUIStore((s) => s.openModal); 

  const isOpen = activeModal === "menu"; // Só aparece se o modal ativo for "menu"

  const categories = [
    { id: "promocoes", label: "Promoções", icon: "🔥" },
    { id: "combos", label: "Combos", icon: "🧡" },
    { id: "tradicionais", label: "Tradicionais", icon: "🍔" },
    { id: "artesanais", label: "Artesanais", icon: "🍔" },
    { id: "hotdogs", label: "Hot Dogs", icon: "🌭" },
    { id: "bebidas", label: "Bebidas", icon: "🥤" },
  ];

  const scrollToSection = (id: string) => {
    closeModal(); // Fecha usando o sistema novo
    
    setTimeout(() => {
      const element = document.getElementById(id);
      if (element) {
        const headerOffset = 104; 
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
  
        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth"
        });
      }
    }, 300);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop Escuro */}
      <div 
        onClick={closeModal}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 140,
        }} 
      />

      {/* Gaveta Lateral */}
      <aside style={{
        position: "fixed", top: 0, left: 0, bottom: 0, width: "280px",
        background: "#fff", zIndex: 150, padding: "20px",
        display: "flex", flexDirection: "column",
        boxShadow: "4px 0 20px rgba(0,0,0,0.1)",
      }}>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px", borderBottom: "1px solid #eee", paddingBottom: "15px" }}>
          <span style={{ fontWeight: 900, fontSize: "18px", color: "#111" }}>MENU FAMÍLIA</span>
          <button onClick={closeModal} style={{ background: "none", border: "none", fontSize: "24px", cursor: "pointer" }}>✕</button>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ fontSize: "12px", color: "#888", fontWeight: "bold", marginBottom: "5px", textTransform: "uppercase" }}>Cardápio</div>
          
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => scrollToSection(cat.id)}
              style={{
                display: "flex", alignItems: "center", gap: "12px",
                padding: "12px", borderRadius: "8px",
                background: "#f8f9fa", border: "none",
                fontSize: "15px", fontWeight: "600", color: "#333",
                cursor: "pointer", textAlign: "left"
              }}
            >
              <span>{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </nav>

        <div style={{ marginTop: "auto", borderTop: "1px solid #eee", paddingTop: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
           <button 
             onClick={() => { closeModal(); (openModal as any)("orders"); }}
             style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "10px", background: "none", border: "none", cursor: "pointer", color: "#333", fontWeight: "600" }}
           >
             <span>📦</span> Meus Pedidos
           </button>

           <button 
             onClick={() => { closeModal(); (openModal as any)("login"); }}
             style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "10px", background: "none", border: "none", cursor: "pointer", color: "#666" }}
           >
             <span>👤</span> Minha Conta
           </button>
        </div>
      </aside>
    </>
  );
}
