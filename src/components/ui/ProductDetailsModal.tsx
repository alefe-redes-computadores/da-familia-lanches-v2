"use client";

import { ModalBase } from "./ModalBase";
import { useUIStore } from "@/store/ui";
import { useCartStore } from "@/store/cart.store";
import { useState } from "react";

export function ProductDetailsModal() {
  const { closeModal, modalData } = useUIStore(); // Pega o produto clicado
  const addItem = useCartStore((s) => s.addItem);

  const [quantity, setQuantity] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState<any[]>([]);

  // Se não tiver produto carregado, não mostra nada
  if (!modalData) return null;
  const product = modalData;

  // --- LISTA OFICIAL DE ADICIONAIS (BASEADA NA SUA FOTO) ---
  const addonsList = [
    { id: "cebola", name: "Cebola", price: 0.99 },
    { id: "salada", name: "Salada", price: 1.99 },
    { id: "ovo", name: "Ovo", price: 1.99 },
    { id: "bacon", name: "Bacon", price: 2.99 },
    { id: "hamb_trad", name: "Hambúrguer Tradicional 56g", price: 2.99 },
    { id: "cheddar", name: "Cheddar Cremoso", price: 3.99 },
    { id: "frango", name: "Filé de Frango", price: 5.99 },
    { id: "hamb_art", name: "Hambúrguer Artesanal 120g", price: 7.99 },
  ];
  // ---------------------------------------------------------

  const handleToggleAddon = (addon: any) => {
    const exists = selectedAddons.find(a => a.id === addon.id);
    if (exists) {
        setSelectedAddons(selectedAddons.filter(a => a.id !== addon.id));
    } else {
        setSelectedAddons([...selectedAddons, addon]);
    }
  };

  const handleAddToCart = () => {
    // Adiciona ao carrinho com os complementos
    addItem(product, quantity, selectedAddons, "");
    
    closeModal();
    // Opcional: Se quiser abrir o carrinho direto, descomente a linha abaixo:
    // useUIStore.getState().openModal("cart");
  };

  // Calcula o preço total
  const totalAddons = selectedAddons.reduce((acc, curr) => acc + curr.price, 0);
  const finalPrice = (product.price + totalAddons) * quantity;

  return (
    <ModalBase title="Adicionais" onClose={closeModal}>
      <div style={{ padding: "20px" }}>
        
        {/* Cabeçalho do Produto */}
        <div style={{ display: "flex", gap: "15px", marginBottom: "20px", alignItems: "center" }}>
            {product.image && (
                <img 
                    src={product.image} 
                    alt={product.name} 
                    style={{ width: "60px", height: "60px", borderRadius: "50%", objectFit: "cover", border: "2px solid #ffca28" }} 
                />
            )}
            <div>
                <h3 style={{ margin: 0, fontSize: "18px" }}>{product.name}</h3>
                <div style={{ fontWeight: "bold", color: "#2e7d32" }}>
                    {product.price.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}
                </div>
            </div>
        </div>

        {/* Lista de Adicionais Estilo "Checklist" */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "50vh", overflowY: "auto", marginBottom: "20px" }}>
            {addonsList.map((addon) => {
                const isSelected = selectedAddons.find(a => a.id === addon.id);
                return (
                    <div 
                        key={addon.id} 
                        onClick={() => handleToggleAddon(addon)}
                        style={{ 
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            padding: "12px", borderRadius: "8px", 
                            border: "1px solid #eee",
                            background: "#fff", 
                            cursor: "pointer"
                        }}
                    >
                        <span style={{ fontWeight: "600", color: "#333" }}>
                            {addon.name} <span style={{color: "#d32f2f"}}>— {addon.price.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</span>
                        </span>
                        
                        {/* Caixinha de Seleção (Checkbox Visual) */}
                        <div style={{ 
                            width: "20px", height: "20px", borderRadius: "4px", border: "2px solid #ccc",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            background: isSelected ? "#2e7d32" : "#fff",
                            borderColor: isSelected ? "#2e7d32" : "#ccc"
                        }}>
                            {isSelected && <span style={{ color: "#fff", fontSize: "14px", fontWeight: "bold" }}>✓</span>}
                        </div>
                    </div>
                )
            })}
        </div>

        {/* Botão Final Flutuante (Estilo iFood) */}
        <div style={{ borderTop: "1px solid #eee", paddingTop: "15px" }}>
            <button 
                onClick={handleAddToCart}
                style={{ 
                    width: "100%", background: "#2e7d32", color: "#fff", padding: "16px", 
                    borderRadius: "12px", border: "none", fontWeight: "bold", fontSize: "16px", 
                    cursor: "pointer", display: "flex", justifyContent: "space-between" 
                }}
            >
                <span>Adicionar ao Pedido</span>
                <span>{finalPrice.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</span>
            </button>
        </div>

      </div>
    </ModalBase>
  );
}