"use client";

import { useState } from "react"; 
import { useUIStore } from "@/store/ui";
import { products } from "@/data/products";

export default function Home() {
  const openModal = useUIStore((s) => s.openModal);
  
  // ESTADO DA BUSCA
  const [searchTerm, setSearchTerm] = useState("");

  // Função que filtra os produtos
  const getProductsByCategory = (cat: string) => {
    return products.filter((p) => {
      const isCategoryMatch = p.category === cat;
      const isSearchMatch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      return isCategoryMatch && isSearchMatch;
    });
  };
 
  const categoriesOrder = [
    { id: "promocoes", title: "🔥 Promoções" },
    { id: "combos", title: "🧡 Combos" },
    { id: "tradicionais", title: "🍔 Tradicionais" },
    { id: "artesanais", title: "🍔 Artesanais" },
    { id: "hotdogs", title: "🌭 Hot Dogs" },
    { id: "bebidas", title: "🥤 Bebidas" },
  ];

  return (
    <div style={{ paddingBottom: "100px", background: "#f8f9fa", minHeight: "100vh" }}>
      
      {/* BANNER + BUSCA */}
      <section style={{ 
        textAlign: "center", padding: "40px 20px", 
        background: "linear-gradient(135deg, #ffca28 0%, #ff6f00 100%)",
        color: "#fff", marginBottom: "20px", borderRadius: "0 0 20px 20px", boxShadow: "0 4px 15px rgba(255, 111, 0, 0.3)"
      }}>
        <h1 style={{ fontSize: "28px", fontWeight: "900", margin: "0 0 15px 0", textShadow: "0 2px 4px rgba(0,0,0,0.2)" }}>
          Fome de quê hoje? 😋
        </h1>
        
        {/* BARRA DE PESQUISA */}
        <div style={{ position: "relative", maxWidth: "400px", margin: "0 auto" }}>
          <input 
            type="text" 
            placeholder="Procure por lanche, bebida..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: "100%", padding: "12px 16px 12px 40px", borderRadius: "25px",
              border: "none", background: "#fff", fontSize: "15px", outline: "none", color: "#333",
              boxShadow: "0 4px 10px rgba(0,0,0,0.1)"
            }}
          />
          <span style={{ position: "absolute", left: "12px", top: "12px", fontSize: "16px" }}>🔍</span>
        </div>
      </section>

      {/* LISTAGEM DE CATEGORIAS */}
      {categoriesOrder.map((section) => {
        const items = getProductsByCategory(section.id);
        
        if (items.length === 0) return null;

        return (
          <section key={section.id} id={section.id} style={{ padding: "0 20px", marginBottom: "30px", scrollMarginTop: "120px" }}>
            
            <h2 style={{ 
              fontSize: "20px", fontWeight: "800", color: "#333", 
              marginBottom: "15px", borderLeft: "5px solid #ffca28", paddingLeft: "10px" 
            }}>
              {section.title}
            </h2>

            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", 
              gap: "15px" 
            }}>
              {items.map((product) => {
                
                // VERIFICA SE ESTÁ DISPONÍVEL
                const isAvailable = product.disponivel !== false;

                // --- FUNÇÃO DE CLIQUE INTELIGENTE ---
                const handleProductClick = () => {
                    if (isAvailable) {
                        // Se disponível, abre o modal
                        openModal("product-details", product);
                    } else {
                        // Se NÃO disponível, solta o alerta
                        alert(`Ops! 🛑\n\nO item "${product.name}" acabou por hoje ou está indisponível no momento.\n\nEscolha outra delícia! 😋`);
                    }
                };
                // ------------------------------------

                return (
                  <div
                    key={product.id}
                    onClick={handleProductClick} // <--- USA A NOVA FUNÇÃO
                    style={{
                      background: "#fff", borderRadius: "16px", padding: "12px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.05)", 
                      cursor: isAvailable ? "pointer" : "not-allowed", // Cursor de bloqueio visual
                      display: "flex", flexDirection: "column", gap: "10px",
                      position: "relative",
                      opacity: isAvailable ? 1 : 0.6, 
                      filter: isAvailable ? "none" : "grayscale(100%)"
                    }}
                  >
                    {/* ETIQUETA ESGOTADO */}
                    {!isAvailable && (
                        <div style={{
                            position: "absolute", top: "10px", right: "10px", zIndex: 10,
                            background: "#d32f2f", color: "#fff", fontSize: "10px", fontWeight: "bold",
                            padding: "4px 8px", borderRadius: "4px"
                        }}>
                            ESGOTADO
                        </div>
                    )}

                    {/* Imagem */}
                    <div style={{ width: "100%", aspectRatio: "1/1", borderRadius: "12px", overflow: "hidden", background: "#eee" }}>
                       <img 
                         src={product.image} 
                         alt={product.name} 
                         style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                         onError={(e) => (e.currentTarget.src = "https://placehold.co/200?text=Sem+Foto")}
                       />
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                       <div style={{ fontWeight: "bold", fontSize: "15px", color: "#111", lineHeight: "1.2", marginBottom: "4px" }}>
                         {product.name}
                       </div>
                       <div style={{ fontSize: "12px", color: "#888", lineHeight: "1.4", flex: 1 }}>
                         {product.description}
                       </div>
                    </div>

                    {/* Preço e Botão */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "5px" }}>
                       <span style={{ fontWeight: "900", color: isAvailable ? "#2e7d32" : "#999", fontSize: "16px" }}>
                         {product.price.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}
                       </span>
                       
                       <button 
                         style={{ 
                           background: isAvailable ? "#111" : "#eee", 
                           color: isAvailable ? "#fff" : "#999", 
                           width: "32px", height: "32px", 
                           borderRadius: "50%", border: "none", fontSize: "20px", fontWeight: "bold",
                           display: "flex", alignItems: "center", justifyContent: "center", 
                           cursor: isAvailable ? "pointer" : "not-allowed"
                         }}
                       >
                         {isAvailable ? "+" : "🚫"}
                       </button>
                    </div>

                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* Mensagem de Erro na Busca */}
      {searchTerm !== "" && products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
        <div style={{ textAlign: "center", padding: "40px", color: "#999" }}>
          <div style={{ fontSize: "40px", marginBottom: "10px" }}>😕</div>
          <p>Poxa, não achei nada com "{searchTerm}".</p>
        </div>
      )}

    </div>
  );
}