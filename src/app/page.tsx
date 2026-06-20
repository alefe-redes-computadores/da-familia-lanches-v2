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

  // 🎰 ESTADOS DA GAMIFICAÇÃO (CAÇA-NÍQUEL)
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [tentativas, setTentativas] = useState(2);
  const [slotStatus, setSlotStatus] = useState<"inicio" | "girando" | "quase" | "ganhou">("inicio");
  const [slots, setSlots] = useState(['🎰', '🎰', '🎰']);
  const [copiado, setCopiado] = useState(false);

  // Monitora se a loja está aberta ou fechada em tempo real pelo Firebase
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "loja"), (snap) => {
      if (snap.exists()) {
        setIsStoreOpen(snap.data().isOpen);
      }
    });
    return () => unsub();
  }, []);

  // 🎰 EFEITO DA GAMIFICAÇÃO: Aparece após 2.5s se a pessoa ainda não tiver jogado
  useEffect(() => {
    const hasPlayed = localStorage.getItem("dfl_slot_jogado");
    if (!hasPlayed) {
      const timer = setTimeout(() => setShowSlotModal(true), 2500);
      return () => clearTimeout(timer);
    }
  }, []);

  // 🎰 LÓGICA DO GIRO DA ROLETA
  const handleSpinSlot = () => {
    if (slotStatus === "girando" || slotStatus === "ganhou") return;
    
    setSlotStatus("girando");
    let counter = 0;
    
    // Animação de giro rápido (100ms)
    const interval = setInterval(() => {
      const emojis = ['🍔', '🍟', '🥤', '🍕', '🌭', '🍩'];
      const randomEmoji = () => emojis[Math.floor(Math.random() * emojis.length)];
      setSlots([randomEmoji(), randomEmoji(), randomEmoji()]);
      
      counter++;
      
      // Para o giro após ~1.2 segundos
      if (counter > 12) {
        clearInterval(interval);
        
        if (tentativas === 2) {
          // Resultado forçado: Quase ganhou
          setSlots(['🍔', '🍔', '🍟']);
          setSlotStatus("quase");
          setTentativas(1);
        } else {
          // Resultado forçado: Ganhou o prêmio
          setSlots(['🎁', '🎁', '🎁']);
          setSlotStatus("ganhou");
          setTentativas(0);
          localStorage.setItem("dfl_slot_jogado", "true");
        }
      }
    }, 100);
  };

  const handleCopiarCupom = () => {
    navigator.clipboard.writeText("FRETEOFF");
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  // Busca simples de produtos pela categoria e termo de pesquisa
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

  // FUNÇÃO REUTILIZÁVEL: Cria o visual do card do produto para não repetir código
  const renderProductCard = (product: any) => {
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
  };

  return (
    <div style={{ paddingBottom: "100px", background: "#f8f9fa", minHeight: "100vh" }}>

      {/* 🎰 MODAL GAMIFICAÇÃO - CAÇA NÍQUEL */}
      {showSlotModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
          backgroundColor: "rgba(0,0,0,0.85)", zIndex: 9999, display: "flex",
          alignItems: "center", justifyContent: "center", padding: "20px", fontFamily: "sans-serif"
        }}>
          <div style={{
            background: "#111", border: "2px solid #ffca28", borderRadius: "24px",
            padding: "25px", maxWidth: "340px", width: "100%", textAlign: "center", color: "#fff",
            boxShadow: "0 10px 40px rgba(255, 202, 40, 0.2)", position: "relative"
          }}>
            
            <button 
              onClick={() => setShowSlotModal(false)}
              style={{ position: "absolute", top: "15px", right: "15px", background: "none", border: "none", color: "#aaa", fontSize: "18px", cursor: "pointer" }}
            >
              ✕
            </button>

            <h2 style={{ fontSize: "20px", fontWeight: "900", color: "#ffca28", margin: "0 0 10px 0" }}>
              {slotStatus === "ganhou" ? "JACKPOT! 🎉" : "🎰 SORTEIO DA FAMÍLIA"}
            </h2>

            <p style={{ fontSize: "14px", color: "#ccc", margin: "0 0 20px 0", lineHeight: "1.4" }}>
              {slotStatus === "inicio" && `Gire a roleta para tentar ganhar um cupom de Frete Grátis! (Tentativas: ${tentativas})`}
              {slotStatus === "girando" && "Cruzando os dedos..."}
              {slotStatus === "quase" && `Bateu na trave! Você tem mais ${tentativas} giro da sorte. Vai!`}
              {slotStatus === "ganhou" && "Você tirou a sorte grande! Aplique o cupom no carrinho e aproveite."}
            </p>

            {/* AS ROLETA DOS EMOJIS */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '25px' }}>
              {slots.map((emoji, idx) => (
                <div key={idx} style={{
                  fontSize: '40px', background: '#222', border: '2px solid #ffca28',
                  borderRadius: '12px', padding: '15px 10px', minWidth: '75px',
                  boxShadow: 'inset 0 0 15px rgba(0,0,0,0.8)',
                  display: 'flex', justifyContent: 'center', alignItems: 'center'
                }}>
                  {emoji}
                </div>
              ))}
            </div>

            {/* BOTÃO DE AÇÃO */}
            {slotStatus !== "ganhou" ? (
              <button 
                onClick={handleSpinSlot}
                disabled={slotStatus === "girando"}
                style={{
                  background: slotStatus === "girando" ? "#555" : "linear-gradient(135deg, #ffca28 0%, #ff6f00 100%)", 
                  color: "#fff", border: "none", padding: "15px", borderRadius: "30px", fontWeight: "900",
                  fontSize: "16px", cursor: slotStatus === "girando" ? "not-allowed" : "pointer", 
                  width: "100%", boxShadow: slotStatus === "girando" ? "none" : "0 5px 15px rgba(255, 111, 0, 0.4)",
                  transition: "transform 0.1s"
                }}
              >
                {slotStatus === "girando" ? "GIRANDO..." : "🎯 GIRAR ROLETA"}
              </button>
            ) : (
              <div style={{ background: "#222", padding: "15px", borderRadius: "16px", border: "1px dashed #ffca28" }}>
                <span style={{ fontSize: "12px", color: "#aaa", fontWeight: "bold" }}>CÓDIGO DO CUPOM:</span>
                <div style={{ fontSize: "24px", fontWeight: "900", color: "#ffca28", margin: "5px 0", letterSpacing: "1px" }}>FRETEOFF</div>
                <button 
                  onClick={handleCopiarCupom}
                  style={{
                    background: copiado ? "#4caf50" : "#ffca28", color: copiado ? "#fff" : "#111",
                    border: "none", padding: "10px 15px", borderRadius: "8px", fontWeight: "bold",
                    fontSize: "14px", cursor: "pointer", marginTop: "10px", width: "100%"
                  }}
                >
                  {copiado ? "📋 COPIADO!" : "📋 COPIAR CÓDIGO"}
                </button>
              </div>
            )}

            <button 
              onClick={() => setShowSlotModal(false)}
              style={{ background: "none", border: "none", color: "#888", fontWeight: "bold", fontSize: "12px", cursor: "pointer", textDecoration: "underline", marginTop: "20px" }}
            >
              {slotStatus === "ganhou" ? "Ir para o Cardápio 🍔" : "Não quero brinde hoje"}
            </button>

          </div>
        </div>
      )}

      {/* AVISO DE LOJA FECHADA */}
      {!isStoreOpen && (
        <div style={{
          background: "#d32f2f", color: "#fff", padding: "12px", textAlign: "center",
          fontWeight: "bold", fontSize: "14px", position: "sticky", top: "65px", zIndex: 10,
          boxShadow: "0 4px 10px rgba(0,0,0,0.2)"
        }}>
          😴 A Família está descansando agora. Voltamos em breve!
        </div>
      )}

      {/* BANNER + BUSCA */}
      <section style={{ 
        textAlign: "center", 
        padding: "40px 20px", 
        marginTop: "65px",
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

      {/* LISTAGEM DE CATEGORIAS COM LÓGICA DE ORDENAÇÃO E ESGOTADOS */}
      {categoriesOrder.map((section) => {
        const items = getProductsByCategory(section.id);
        const isHotDogs = section.id === "hotdogs";

        if (!isHotDogs && items.length === 0) return null;
        if (isHotDogs && items.length === 0 && searchTerm !== "") return null;

        // 1. Separa e ordena os ativos (Destaques primeiro, depois preço)
        const activeItems = items.filter(p => p.disponivel !== false).sort((a, b) => {
          if (a.isSuggestion && !b.isSuggestion) return -1;
          if (!a.isSuggestion && b.isSuggestion) return 1;
          return a.price - b.price;
        });

        // 2. Separa os esgotados
        const exhaustedItems = items.filter(p => p.disponivel === false);

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

            {/* Renderiza os itens ATIVOS */}
            {activeItems.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "15px" }}>
                {activeItems.map((product) => renderProductCard(product))}
              </div>
            )}

            {/* Renderiza o título e a grade dos ESGOTADOS no final da categoria */}
            {exhaustedItems.length > 0 && (
              <div style={{ marginTop: activeItems.length > 0 ? "25px" : "0px" }}>
                <h3 style={{ 
                  fontSize: "17px", fontWeight: "800", color: "#777", 
                  marginBottom: "15px", borderLeft: "4px solid #aaa", paddingLeft: "10px",
                  display: "flex", alignItems: "center", gap: "8px"
                }}>
                  🚫 Esgotados
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "15px" }}>
                  {exhaustedItems.map((product) => renderProductCard(product))}
                </div>
              </div>
            )}

          </section>
        );
      })}

      {/* MENSAGEM DE BUSCA VAZIA */}
      {searchTerm !== "" && products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
        <div style={{ textAlign: "center", padding: "40px", color: "#999" }}>
          <div style={{ fontSize: "40px", marginBottom: "10px" }}>😕</div>
          <p>Poxa, não achei nada com "{searchTerm}".</p>
        </div>
      )}

    </div>
  );
}
