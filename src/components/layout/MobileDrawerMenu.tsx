"use client";

import { useUIStore } from "@/store/ui";
import { useState } from "react";

export function MobileDrawerMenu() {
  const isOpen = useUIStore((s) => s.isMobileMenuOpen);
  const closeMenu = useUIStore((s) => s.closeMobileMenu);
  
  // AQUI ESTAVA FALTANDO: Pegamos a função de abrir modais
  const openModal = useUIStore((s) => s.openModal); 

  const [activeCategory, setActiveCategory] = useState("");

  // Categorias do seu cardápio
  const categories = [
    { id: "promocoes", label: "Promoções", icon: "🔥" },
    { id: "combos", label: "Combos", icon: "🧡" },
    { id: "tradicionais", label: "Tradicionais", icon: "🍔" },
    { id: "artesanais", label: "Artesanais", icon: "🍔" },
    { id: "hotdogs", label: "Hot Dogs", icon: "🌭" },
    { id: "bebidas", label: "Bebidas", icon: "🥤" },
  ];

  // Função que faz a mágica do Scroll
  const scrollToSection = (id: string) => {
    closeMenu(); // Fecha o menu primeiro
    
    // Pequeno delay para o menu fechar antes de rolar
    setTimeout(() => {
      const element = document.getElementById(id);
      if (element) {
        // Compensa a altura do cabeçalho fixo (104px)
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
      {/* Backdrop Escuro (clique fora fecha) */}
      <div 
        onClick={closeMenu}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 140,
          animation: "fadeIn 0.2s"
        }} 
      />

      {/* Gaveta Lateral */}
      <aside style={{
        position: "fixed", top: 0, left: 0, bottom: 0, width: "280px",
        background: "#fff", zIndex: 150, padding: "20px",
        display: "flex", flexDirection: "column",
        boxShadow: "4px 0 20px rgba(0,0,0,0.1)",
        transform: isOpen ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
      }}>
        
        {/* Cabeçalho do Menu */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px", borderBottom: "1px solid #eee", paddingBottom: "15px" }}>
          <span style={{ fontWeight: 900, fontSize: "18px", color: "#111" }}>MENU</span>
          <button onClick={closeMenu} style={{ background: "none", border: "none", fontSize: "24px", cursor: "pointer" }}>✕</button>
        </div>

        {/* Lista de Categorias */}
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

        {/* Links Extras (Perfil, Pedidos, etc) */}
        <div style={{ marginTop: "auto", borderTop: "1px solid #eee", paddingTop: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
           
           {/* --- BOTÃO NOVO: MEUS PEDIDOS --- */}
           <button 
             onClick={() => { closeMenu(); openModal("orders"); }}
             style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "10px", background: "none", border: "none", cursor: "pointer", color: "#333", fontWeight: "600" }}
           >
             <span>📦</span> Meus Pedidos
           </button>

           {/* Botão Minha Conta (Abre Login se não tiver logado) */}
           <button 
             onClick={() => { closeMenu(); openModal("login"); }} // Se já tiver logado, o login modal mostra "Você já está logado" ou podemos ajustar depois
             style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "10px", background: "none", border: "none", cursor: "pointer", color: "#666" }}
           >
             <span>👤</span> Minha Conta
           </button>

        </div>

      </aside>

      <style jsx>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </>
  );
}