
"use client";

import { useState, useEffect } from "react"; 
import { useUIStore } from "@/store/ui";
import { products } from "@/data/products";
import { db } from "@/lib/firebase"; 
import { doc, onSnapshot } from "firebase/firestore";

export default function Home() {
  const openModal = useUIStore((s) => s.openModal);

  const [searchTerm, setSearchTerm] = useState("");
  const [isStoreOpen, setIsStoreOpen] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "loja"), (snap) => {
      if (snap.exists()) {
        setIsStoreOpen(snap.data().isOpen);
      }
    });
    return () => unsub();
  }, []);

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

      {/* AVISO DE LOJA FECHADA */}
      {!isStoreOpen && (
        <div style={{
          background: "#d32f2f", color: "#fff", padding: "12px", textAlign: "center",
          fontWeight: "bold", fontSize: "14px", position: "sticky", top: "0px", zIndex: 100,
          boxShadow: "0 4px 10px rgba(0,0,0,0.2)"
        }}>
          😴 A Família está descansando agora. Voltamos em breve!
        </div>
      )}

      {/* BANNER + BUSCA */}
      <section style={{ 
        textAlign: "center", 
        padding: "40px 20px", 
        background: isStoreOpen 
          ? "linear-gradient(135deg, #ffca28 0%, #ff6f00 100%)" 
          : "linear-gradient(135deg, #757575 0%, #424242 100%)",
        color: "#fff", 
        marginBottom: "20px", 
        borderRadius: "0 0 20px 20px", 
        boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
        position: "relative"
      }}>
        <h1 style={{ 
          fontSize: "clamp(22px, 6vw, 28px)", 
          fontWeight: "900", 
          margin: "0 0 20px 0", 
          textShadow: "0 2px 4px rgba(0,0,0,0.3)",
          lineHeight: "1.2",
          maxWidth: "90%",
          marginLeft: "auto",
          marginRight: "auto"
        }}>
          {isStoreOpen ? "Bem-vindo à Família! O que vamos pedir? ❤️" : "Loja Fechada no momento"}
        </h1>

        <div style={{ position: "relative", maxWidth: "400px", margin: "0 auto", zIndex: 10 }}>
          <input 
            type="text" 
            placeholder="Procure por lanche, bebida..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: "100%", padding: "14px 16px 14px 45px", borderRadius: "25px",
              border: "none", background: "#fff", fontSize: "16px", outline: "none", color: "#333",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
            }}
          />
          <span style={{ position: "absolute", left: "15px", top: "14px", fontSize: "18px" }}>🔍</span>
        </div>
      </section>

      {/* LISTAGEM DE CATEGORIAS */}
      {categoriesOrder.map((section) => {
        const items = getProductsByCategory(section.id);
        const isHotDogs = section.id === "hotdogs";

        if (!isHotDogs && items.length === 0) return null;
        if (isHotDogs && items.length === 0 && searchTerm !== "") return null;

        return (
          <section key={section.id} id={section.id} style={{ padding: "0 20px", marginBottom: "30px", scrollMarginTop: "120px" }}>

            <h2 style={{ 
              fontSize: "20px", fontWeight: "800", color: "#333", 
              marginBottom: "15px", borderLeft: "5px solid #ffca28", paddingLeft: "10px",
              display: "flex", alignItems: "center", gap: "8px"
            }}>
              {section.title}
              {isHotDogs && (
                <span style={{
                  fontSize: "11px", fontWeight: "700", background: "#ff6f00",
                  color: "#fff", padding: "2px 8px", borderRadius: "999px"
                }}>
                  Em breve
                </span>
              )}
            </h2>

            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", 
              gap: "15px" 
            }}>
              {items.map((product) => {
                const isAvailable = product.disponivel !== false;
                const hasOldPrice = typeof product.oldPrice === "number" && product.oldPrice > product.price;

                const handleProductClick = () => {
                  if (!isStoreOpen) {
                    alert("Estamos fechados no momento! 🛑\n\nAbriremos em breve para preparar sua delícia. Fique de olho!");
                    return;
                  }
                  if (isAvailable) {
                    openModal("product-details", product);
                  } else {
                    alert(`Ops! 🛑\n\nO item "${product.name}" acabou por hoje ou está indisponível.\n\nEscolha outra delícia! 😋`);
                  }
                };

                return (
                  <div
                    key={product.id}
                    onClick={handleProductClick}
                    style={{
                      background: "#fff", borderRadius: "16px", padding: "12px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.05)", 
                      cursor: (isAvailable && isStoreOpen) ? "pointer" : "not-allowed",
                      display: "flex", flexDirection: "column", gap: "10px",
                      position: "relative",
                      opacity: (isAvailable && isStoreOpen) ? 1 : 0.6, 
                      filter: (isAvailable && isStoreOpen) ? "none" : "grayscale(100%)",
                      outline: (product.isSuggestion && isAvailable) ? "2px solid #ffca28" : "none",
                    }}
                  >
                    {product.isSuggestion && isAvailable && (
                      <div style={{
                        position: "absolute", top: "10px", left: "10px", zIndex: 9,
                        background: "#ffca28", color: "#111", fontSize: "9px", fontWeight: "900",
                        padding: "3px 7px", borderRadius: "4px", letterSpacing: "0.5px"
                      }}>
                        ⭐ DESTAQUE
                      </div>
                    )}

                    {hasOldPrice && isAvailable && (
                      <div style={{
                        position: "absolute", top: product.isSuggestion ? "30px" : "10px", left: "10px", zIndex: 9,
                        background: "#d32f2f", color: "#fff", fontSize: "9px", fontWeight: "900",
                        padding: "3px 7px", borderRadius: "4px"
                      }}>
                        -{Math.round(((product.oldPrice! - product.price) / product.oldPrice!) * 100)}% OFF
                      </div>
                    )}

                    {(!isAvailable || !isStoreOpen) && (
                      <div style={{
                        position: "absolute", top: "10px", right: "10px", zIndex: 9,
                        background: !isStoreOpen ? "#757575" : "#d32f2f", color: "#fff", fontSize: "10px", fontWeight: "bold",
                        padding: "4px 8px", borderRadius: "4px"
                      }}>
                        {!isStoreOpen ? "FECHADO" : "ESGOTADO"}
                      </div>
                    )}

                    <div style={{ width: "100%", aspectRatio: "1/1", borderRadius: "12px", overflow: "hidden", background: "#eee" }}>
                      <img 
                        src={product.image} 
                        alt={product.name} 
                        style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                        onError={(e) => (e.currentTarget.src = "https://placehold.co/200?text=Sem+Foto")}
                      />
                    </div>

                    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                      <div style={{ fontWeight: "bold", fontSize: "15px", color: "#111", lineHeight: "1.2", marginBottom: "4px" }}>
                        {product.name}
                      </div>
                      <div style={{ fontSize: "12px", color: "#888", lineHeight: "1.4", flex: 1 }}>
                        {product.description}
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "5px" }}>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        {hasOldPrice && (
                          <span style={{ fontSize: "11px", color: "#999", textDecoration: "line-through", lineHeight: "1.2" }}>
                            {product.oldPrice!.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                        )}
                        <span style={{ fontWeight: "900", color: (isAvailable && isStoreOpen) ? "#2e7d32" : "#999", fontSize: "16px" }}>
                          {product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>

                      <button 
                        style={{ 
                          background: (isAvailable && isStoreOpen) ? "#111" : "#eee", 
                          color: (isAvailable && isStoreOpen) ? "#fff" : "#999", 
                          width: "32px", height: "32px", 
                          borderRadius: "50%", border: "none", fontSize: "20px", fontWeight: "bold",
                          display: "flex", alignItems: "center", justifyContent: "center"
                        }}
                      >
                        {(isAvailable && isStoreOpen) ? "+" : "🚫"}
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {searchTerm !== "" && products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
        <div style={{ textAlign: "center", padding: "40px", color: "#999" }}>
          <div style={{ fontSize: "40px", marginBottom: "10px" }}>😕</div>
          <p>Poxa, não achei nada com "{searchTerm}".</p>
        </div>
      )}

    </div>
  );
}
