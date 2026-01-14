"use client";

import { ModalBase } from "./ModalBase";
import { useCartStore } from "@/store/cart.store";
import { useUIStore } from "@/store/ui";
import { useAuthStore } from "@/store/auth.store";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { products } from "@/data/products";

export function CartModal() {
  const { closeModal, openModal } = useUIStore();
  const currentUser = useAuthStore((s) => s.currentUser);
  const { items, increaseQtd, decreaseQtd, removeItem, clearCart, getCartTotal, addItem } = useCartStore();
  const [points, setPoints] = useState(0);

  const total = getCartTotal();

  // --- BUSCA PONTOS PARA CÁLCULO DE PROGRESSO ---
  useEffect(() => {
    async function fetchPoints() {
      if (!currentUser) return;
      const snap = await getDoc(doc(db, "Usuarios", currentUser.uid));
      if (snap.exists()) setPoints(snap.data().pedidosFeitos || 0);
    }
    fetchPoints();
  }, [currentUser]);

  // Configuração de Metas
  const goals = [
    { target: 5, title: "Nível Bronze", reward: "10% OFF" },
    { target: 10, title: "Nível Prata", reward: "Coca-Cola Grátis" },
    { target: 20, title: "Nível Ouro", reward: "Burger Grátis" },
    { target: 50, title: "Nível Diamante", reward: "Combo Família" },
  ];

  const nextGoal = goals.find(g => g.target > points) || goals[goals.length - 1];
  const progressAfterOrder = Math.min(100, ((points + 1) / nextGoal.target) * 100);

  const handleFinish = () => {
    closeModal();
    openModal("checkout");
  };

  return (
    <ModalBase title="Seu Carrinho 🛒" onClose={closeModal}>
      <div style={{ padding: "20px", display: "flex", flexDirection: "column", height: "100%" }}>
        
        {/* LISTA DE ITENS */}
        <div style={{ flex: 1, overflowY: "auto", marginBottom: "20px" }}>
          {items.length === 0 ? (
            <p style={{ textAlign: "center", color: "#666", marginTop: "20px" }}>
              Seu carrinho está vazio 😢
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              {items.map((item) => (
                <div key={item.cartId} style={{ 
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  borderBottom: "1px solid #eee", paddingBottom: "10px"
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: "bold", fontSize: "15px" }}>{item.name}</div>
                    {(item.selectedAddons || []).length > 0 && (
                      <div style={{ fontSize: "11px", color: "#666" }}>
                        + {(item.selectedAddons || []).map(a => a.name).join(", ")}
                      </div>
                    )}
                    <div style={{ fontSize: "13px", color: "#333", marginTop: "2px" }}>
                      {item.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", background: "#f5f5f5", borderRadius: "8px" }}>
                        <button onClick={() => decreaseQtd(item.cartId)} style={{ width: "30px", height: "30px", border: "none", background: "transparent", cursor: "pointer", fontWeight: "bold", fontSize: "16px", color: "#d32f2f" }}>-</button>
                        <span style={{ width: "20px", textAlign: "center", fontSize: "14px", fontWeight: "600" }}>{item.quantity}</span>
                        <button onClick={() => increaseQtd(item.cartId)} style={{ width: "30px", height: "30px", border: "none", background: "transparent", cursor: "pointer", fontWeight: "bold", fontSize: "16px", color: "#388e3c" }}>+</button>
                    </div>
                    <button onClick={() => removeItem(item.cartId)} style={{ background: "#ffebee", border: "none", borderRadius: "8px", width: "30px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RODAPÉ */}
        {items.length > 0 && (
          <div style={{ borderTop: "1px solid #eee", paddingTop: "15px" }}>
            
            {/* CARD DE INCENTIVO */}
            {currentUser && points < nextGoal.target && (
              <div style={{ 
                background: "#fff9c4", padding: "12px", borderRadius: "12px", 
                marginBottom: "15px", border: "1px solid #fbc02d" 
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                  <span style={{ fontSize: "12px", fontWeight: "bold", color: "#e65100" }}>🚀 Próxima Recompensa: {nextGoal.reward}</span>
                  <span style={{ fontSize: "11px", fontWeight: "900" }}>{points + 1}/{nextGoal.target}</span>
                </div>
                <div style={{ width: "100%", height: "6px", background: "rgba(0,0,0,0.05)", borderRadius: "3px", overflow: "hidden" }}>
                  <div style={{ width: `${progressAfterOrder}%`, height: "100%", background: "#fbc02d" }} />
                </div>
                <p style={{ fontSize: "10px", margin: "5px 0 0 0", color: "#666" }}>
                  Ao finalizar, você ficará a apenas <b>{nextGoal.target - (points + 1)}</b> pedidos do seu prêmio!
                </p>
              </div>
            )}

            {/* SEÇÃO DE UPSELLING */}
            <div style={{ marginTop: "10px", marginBottom: "20px" }}>
              <p style={{ fontSize: "13px", fontWeight: "bold", color: "#111", marginBottom: "10px" }}>
                Que tal um acompanhamento? 🥤🍟
              </p>
              <div style={{ display: "flex", gap: "12px", overflowX: "auto", paddingBottom: "10px", scrollbarWidth: "none" }}>
                {products
                  .filter(p => p.isSuggestion && p.disponivel && !items.find(item => item.id === p.id))
                  .map(p => (
                    <div key={p.id} style={{ 
                      minWidth: "130px", background: "#fff", borderRadius: "12px", padding: "10px", border: "1px solid #eee",
                      display: "flex", flexDirection: "column", alignItems: "center", boxShadow: "0 2px 5px rgba(0,0,0,0.03)"
                    }}>
                      <img src={p.image} alt={p.name} style={{ width: "50px", height: "50px", objectFit: "contain", marginBottom: "8px" }} />
                      <span style={{ fontSize: "10px", fontWeight: "bold", textAlign: "center", height: "24px", overflow: "hidden" }}>{p.name}</span>
                      <span style={{ fontSize: "12px", color: "#388e3c", fontWeight: "900", marginTop: "5px" }}>
                        {p.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                      <button 
                        onClick={() => addItem(p)}
                        style={{ marginTop: "8px", width: "100%", background: "#111", color: "#fff", border: "none", borderRadius: "8px", padding: "7px", fontSize: "10px", fontWeight: "bold", cursor: "pointer" }}
                      >
                        ADICIONAR +
                      </button>
                    </div>
                  ))}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px", alignItems: "center" }}>
              <span style={{ color: "#666" }}>Total do Pedido:</span>
              <span style={{ fontSize: "20px", fontWeight: "800", color: "#111" }}>
                {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>

            <button onClick={handleFinish} style={{ width: "100%", background: "#111", color: "#fff", padding: "16px", borderRadius: "12px", border: "none", fontWeight: "bold", fontSize: "16px", cursor: "pointer", marginBottom: "10px" }}>
              Finalizar Pedido →
            </button>

            <button onClick={() => confirm("Esvaziar carrinho?") && clearCart()} style={{ width: "100%", background: "transparent", color: "#d32f2f", padding: "10px", borderRadius: "12px", border: "1px solid #ffcdd2", fontWeight: "600", fontSize: "14px", cursor: "pointer" }}>
                Esvaziar Carrinho
            </button>
          </div>
        )}
      </div>
    </ModalBase>
  );
}