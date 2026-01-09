"use client";

import { ModalBase } from "./ModalBase";
import { useCartStore } from "@/store/cart.store";
import { useUIStore } from "@/store/ui";

export function CartModal() {
  const { closeModal, openModal } = useUIStore();
  
  // Pegando todas as funções do Store
  const { items, increaseQtd, decreaseQtd, removeItem, clearCart, getCartTotal } = useCartStore();

  const total = getCartTotal();

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
                  {/* Info do Produto */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: "bold", fontSize: "15px" }}>{item.name}</div>
                    
                    {/* --- PROTEÇÃO CONTRA ERRO (VACINA) --- */}
                    {/* Se item.selectedAddons não existir, usamos [] para não quebrar */}
                    {(item.selectedAddons || []).length > 0 && (
                      <div style={{ fontSize: "11px", color: "#666" }}>
                        + {(item.selectedAddons || []).map(a => a.name).join(", ")}
                      </div>
                    )}
                    {/* ------------------------------------- */}

                    <div style={{ fontSize: "13px", color: "#333", marginTop: "2px" }}>
                      {item.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </div>
                  </div>

                  {/* Botões de Quantidade e Remover */}
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    
                    {/* Controlador de QTD */}
                    <div style={{ display: "flex", alignItems: "center", background: "#f5f5f5", borderRadius: "8px" }}>
                        <button 
                            onClick={() => decreaseQtd(item.cartId)}
                            style={{ width: "30px", height: "30px", border: "none", background: "transparent", cursor: "pointer", fontWeight: "bold", fontSize: "16px", color: "#d32f2f" }}
                        >
                            -
                        </button>
                        <span style={{ width: "20px", textAlign: "center", fontSize: "14px", fontWeight: "600" }}>{item.quantity}</span>
                        <button 
                            onClick={() => increaseQtd(item.cartId)}
                            style={{ width: "30px", height: "30px", border: "none", background: "transparent", cursor: "pointer", fontWeight: "bold", fontSize: "16px", color: "#388e3c" }}
                        >
                            +
                        </button>
                    </div>

                    {/* Lixeira */}
                    <button 
                        onClick={() => removeItem(item.cartId)}
                        style={{ background: "#ffebee", border: "none", borderRadius: "8px", width: "30px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                    >
                        🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RODAPÉ (Totais e Botões) */}
        {items.length > 0 && (
          <div style={{ borderTop: "1px solid #eee", paddingTop: "15px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px", alignItems: "center" }}>
              <span style={{ color: "#666" }}>Total do Pedido:</span>
              <span style={{ fontSize: "20px", fontWeight: "800", color: "#111" }}>
                {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>

            <button 
              onClick={handleFinish}
              style={{ 
                width: "100%", background: "#111", color: "#fff", padding: "16px", 
                borderRadius: "12px", border: "none", fontWeight: "bold", fontSize: "16px", cursor: "pointer", marginBottom: "10px"
              }}
            >
              Finalizar Pedido →
            </button>

            {/* BOTÃO LIMPAR CARRINHO */}
            <button 
                onClick={() => {
                    if(confirm("Tem certeza que deseja esvaziar o carrinho?")) {
                        clearCart();
                    }
                }}
                style={{ 
                    width: "100%", background: "transparent", color: "#d32f2f", padding: "10px", 
                    borderRadius: "12px", border: "1px solid #ffcdd2", fontWeight: "600", fontSize: "14px", cursor: "pointer"
                }}
            >
                Esvaziar Carrinho
            </button>
          </div>
        )}

      </div>
    </ModalBase>
  );
}