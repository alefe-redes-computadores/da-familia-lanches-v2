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

  // ESTADOS DO SPLASH SCREEN
  const [showSplash, setShowSplash] = useState(true);
  const [timeLeft, setTimeLeft] = useState({ dias: 0, horas: 0, minutos: 0, segundos: 0 });

  // ESTADOS DO JOGO DO BAÚ DA SORTE
  const [showBauModal, setShowBauModal] = useState(false);
  const [tentativas, setTentativas] = useState(2);
  const [bauStatus, setBauStatus] = useState<"inicio" | "erro1" | "ganhou">("inicio");
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "loja"), (snap) => {
      if (snap.exists()) {
        setIsStoreOpen(snap.data().isOpen);
      }
    });
    return () => unsub();
  }, []);

  // LÓGICA DO CONTAGEM REGRESSIVA (ATÉ DOMINGO, 14/06 ÀS 23:59:59)
  useEffect(() => {
    const targetDate = new Date(2026, 5, 14, 23, 59, 59).getTime();

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const difference = targetDate - now;

      if (difference <= 0) {
        clearInterval(timer);
        setTimeLeft({ dias: 0, horas: 0, minutos: 0, segundos: 0 });
        setShowSplash(false);
      } else {
        const d = Math.floor(difference / (1000 * 60 * 60 * 24));
        const h = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((difference % (1000 * 60)) / 1000);
        setTimeLeft({ dias: d, horas: h, minutes: m, segundos: s } as any);
      }
    }, 1000);

    const autoClose = setTimeout(() => {
      setShowSplash(false);
      // Quando o splash fecha sozinho ou pelo botão, abre o Baú da Sorte depois de 1.5 segundos
      setTimeout(() => {
        // Verifica no localStorage para não incomodar quem já jogou
        if (!localStorage.getItem("dfl_bau_jogado")) {
          setShowBauModal(true);
        }
      }, 1500);
    }, 6000);

    return () => {
      clearInterval(timer);
      clearTimeout(autoClose);
    };
  }, []);

  const handleCloseSplash = () => {
    setShowSplash(false);
    setTimeout(() => {
      const promoSection = document.getElementById("promocoes");
      if (promoSection) {
        promoSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      // Abre o Baú da Sorte logo após o scroll
      setTimeout(() => {
        if (!localStorage.getItem("dfl_bau_jogado")) {
          setShowBauModal(true);
        }
      }, 1000);
    }, 150);
  };

  // LÓGICA DO CLIQUE NO BAÚ
  const handleEscolherBau = (id: number) => {
    if (bauStatus === "ganhou") return;

    if (tentativas === 2) {
      setTentativas(1);
      setBauStatus("erro1");
    } else if (tentativas === 1) {
      setTentativas(0);
      setBauStatus("ganhou");
      localStorage.setItem("dfl_bau_jogado", "true"); // Trava para jogar só uma vez
    }
  };

  const handleCopiarCupom = () => {
    navigator.clipboard.writeText("FAMILIA10");
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

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

      {/* INFORMAÇÃO DO SPLASH SCREEN PROMOCIONAL */}
      {showSplash && (
        <div style={{
          position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
          backgroundColor: "#0d0d0d", zIndex: 9999, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", padding: "20px", color: "#fff",
          textAlign: "center", fontFamily: "Poppins, sans-serif"
        }}>
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes pulseHeart { 0%, 100% { transform: scale(1); opacity: 0.9; } 50% { transform: scale(1.2); opacity: 1; } }
            @keyframes spinBall { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            @keyframes softGlow { 0%, 100% { text-shadow: 0 0 10px #ffca28; } 50% { text-shadow: 0 0 25px #ff6f00; } }
          `}} />

          <div style={{ display: "flex", gap: "15px", marginBottom: "20px", fontSize: "28px" }}>
            <span style={{ animation: "pulseHeart 1.5s infinite ease-in-out", display: "inline-block", color: "#d32f2f" }}>❤️</span>
            <span style={{ animation: "spinBall 4s infinite linear", display: "inline-block" }}>⚽</span>
          </div>

          <h1 style={{ 
            fontSize: "clamp(20px, 6vw, 32px)", fontWeight: "900", margin: "0 0 15px 0",
            color: "#ffca28", animation: "softGlow 2.5s infinite", letterSpacing: "1px", lineHeight: "1.2"
          }}>
            ❤️⚽ DIA DOS NAMORADOS NA DFL ⚽❤️
          </h1>

          <p style={{ fontSize: "clamp(14px, 4vw, 16px)", color: "#eee", margin: "0 0 10px 0", fontWeight: "600", maxWidth: "450px" }}>
            Hoje é dia de torcer junto, compartilhar e comer bem.
          </p>
          
          <p style={{ fontSize: "clamp(12px, 3.5vw, 14px)", color: "#b3b3b3", margin: "0 0 35px 0", maxWidth: "400px" }}>
            Aproveite nossos combos especiais antes que a campanha termine.
          </p>

          <div style={{ display: "flex", gap: "12px", marginBottom: "40px" }}>
            {[
              { label: "Dias", value: timeLeft.dias },
              { label: "Horas", value: timeLeft.horas },
              { label: "Min", value: (timeLeft as any).minutes || 0 },
              { label: "Seg", value: timeLeft.segundos }
            ].map((item, index) => (
              <div key={index} style={{
                background: "linear-gradient(180deg, #1f1f1f 0%, #0c0c0c 100%)",
                border: "1px solid #333", borderTop: "2px solid #ffca28",
                borderRadius: "12px", minWidth: "65px", padding: "10px 5px",
                boxShadow: "0 4px 10px rgba(0,0,0,0.5)"
              }}>
                <div style={{ fontSize: "20px", fontWeight: "900", color: "#ffca28" }}>
                  {String(item.value).padStart(2, "0")}
                </div>
                <div style={{ fontSize: "10px", color: "#888", fontWeight: "700", textTransform: "uppercase", marginTop: "2px" }}>
                  {item.label}
                </div>
              </div>
            ))}
          </div>

          <button 
            onClick={handleCloseSplash}
            style={{
              background: "linear-gradient(135deg, #ffca28 0%, #ff6f00 100%)",
              color: "#fff", fontWeight: "900", fontSize: "15px", border: "none",
              padding: "15px 35px", borderRadius: "30px", cursor: "pointer",
              boxShadow: "0 5px 20px rgba(255, 111, 0, 0.4)", transition: "transform 0.1s",
              letterSpacing: "0.5px", position: "relative", zIndex: 10000
            }}
          >
            🍔 VER PROMOÇÕES
          </button>
        </div>
      )}

      {/* GAMIFICAÇÃO: MODAL DO BAÚ DA Sorte */}
      {showBauModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, width: "100vw", height: "100vh",
          backgroundColor: "rgba(0,0,0,0.85)", zIndex: 9998, display: "flex",
          alignItems: "center", justifyContent: "center", padding: "20px", fontFamily: "sans-serif"
        }}>
          <div style={{
            background: "#111", border: "2px solid #ffca28", borderRadius: "24px",
            padding: "25px", maxWidth: "340px", width: "100%", textAlign: "center", color: "#fff",
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)", position: "relative"
          }}>
            
            <button 
              onClick={() => setShowBauModal(false)}
              style={{ position: "absolute", top: "15px", right: "15px", background: "none", border: "none", color: "#aaa", fontSize: "18px", cursor: "pointer" }}
            >
              ✕
            </button>

            <h2 style={{ fontSize: "20px", fontWeight: "900", color: "#ffca28", margin: "0 0 10px 0" }}>
              {bauStatus === "ganhou" ? "🎉 VOCÊ GANHOU! 🎉" : "🎁 RODADA PREMIADA"}
            </h2>

            <p style={{ fontSize: "14px", color: "#ccc", margin: "0 0 20px 0", lineHeight: "1.4" }}>
              {bauStatus === "inicio" && `Escolha um dos baús da Família abaixo para tentar ganhar um cupom secreto! (Tentativas: ${tentativas})`}
              {bauStatus === "erro1" && `❌ Poxa, esse estava vazio! Resta ${tentativas} tentativa. Escolha outro baú!`}
              {bauStatus === "ganhou" && "Incrível! Você tem muita sorte. Use o cupom abaixo no seu carrinho antes de fechar o pedido!"}
            </p>

            {/* AREA DOS BAÚS */}
            {bauStatus !== "ganhou" ? (
              <div style={{ display: "flex", justifyContent: "center", gap: "20px", marginBottom: "15px" }}>
                {[1, 2, 3].map((num) => (
                  <div 
                    key={num}
                    onClick={() => handleEscolherBau(num)}
                    style={{
                      fontSize: "45px", cursor: "pointer", background: "#222", 
                      padding: "10px", borderRadius: "15px", border: "1px solid #333",
                      transition: "transform 0.1s"
                    }}
                    onMouseDown={(e) => e.currentTarget.style.transform = "scale(0.9)"}
                    onMouseUp={(e) => e.currentTarget.style.transform = "scale(1)"}
                  >
                    📦
                  </div>
                ))}
              </div>
            ) : (
              /* TELA DE GANHOU O CUPOM */
              <div style={{ background: "#222", padding: "15px", borderRadius: "16px", border: "1px dashed #ffca28", marginBottom: "20px" }}>
                <span style={{ fontSize: "12px", color: "#aaa", fontWeight: "bold" }}>CÓDIGO DO CUPOM:</span>
                <div style={{ fontSize: "24px", fontWeight: "900", color: "#ffca28", margin: "5px 0", letterSpacing: "1px" }}>FAMILIA10</div>
                <button 
                  onClick={handleCopiarCupom}
                  style={{
                    background: copiado ? "#4caf50" : "#ffca28", color: copiado ? "#fff" : "#111",
                    border: "none", padding: "8px 15px", borderRadius: "8px", fontWeight: "bold",
                    fontSize: "12px", cursor: "pointer", marginTop: "5px", width: "100%"
                  }}
                >
                  {copiado ? "📋 COPIADO!" : "📋 COPIAR CÓDIGO"}
                </button>
              </div>
            )}

            <button 
              onClick={() => setShowBauModal(false)}
              style={{ background: "none", border: "none", color: "#ffca28", fontWeight: "bold", fontSize: "13px", cursor: "pointer", textDecoration: "underline" }}
            >
              {bauStatus === "ganhou" ? "Ir para o Cardápio 🍔" : "Não quero desconto"}
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
