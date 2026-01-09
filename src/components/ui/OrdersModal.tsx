"use client";

import { useEffect, useState } from "react";
import { ModalBase } from "./ModalBase";
import { useUIStore } from "@/store/ui";
import { useAuthStore } from "@/store/auth.store";
import { useCartStore } from "@/store/cart.store";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export function OrdersModal() {
  const { closeModal, openModal } = useUIStore();
  const { currentUser } = useAuthStore();
  const { addItem, clearCart } = useCartStore();

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // --- FUNÇÃO INTELIGENTE DE DATA ---
  const formatDate = (dateField: any) => {
    if (!dateField) return "Data desconhecida";

    let dateObj: Date;

    // Caso 1: É um Carimbo do Firestore (tem seconds)
    if (dateField.seconds) {
        dateObj = new Date(dateField.seconds * 1000);
    } 
    // Caso 2: É um Texto (ISO String do site antigo)
    else if (typeof dateField === 'string') {
        dateObj = new Date(dateField);
    }
    // Caso 3: Já é um objeto Date
    else if (dateField instanceof Date) {
        dateObj = dateField;
    } 
    else {
        return "Data desconhecida";
    }

    // Verifica se a data é válida
    if (isNaN(dateObj.getTime())) return "Data Inválida";

    return `${dateObj.toLocaleDateString('pt-BR')} às ${dateObj.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}`;
  };
  // ----------------------------------

  useEffect(() => {
    async function fetchOrders() {
      if (!currentUser) return;
      try {
        const q = query(
            collection(db, "Pedidos"), 
            where("userId", "==", currentUser.uid)
        );
        
        const querySnapshot = await getDocs(q);
        const lista = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Ordena por data (tenta converter tudo para número para comparar)
        lista.sort((a: any, b: any) => {
            const dateA = a.data?.seconds ? a.data.seconds * 1000 : new Date(a.data).getTime();
            const dateB = b.data?.seconds ? b.data.seconds * 1000 : new Date(b.data).getTime();
            return dateB - dateA;
        });

        setOrders(lista);
      } catch (error) {
        console.error("Erro ao buscar pedidos:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchOrders();
  }, [currentUser]);

  // Função de Itens (mantida da correção anterior)
  const getOrderItems = (order: any) => {
    if (Array.isArray(order.itens)) {
        return order.itens.map((i: any) => ({
            name: i.name || i.nome,
            quantity: i.quantity || i.qtd,
            addons: i.selectedAddons || []
        }));
    }
    if (Array.isArray(order.itensObj)) {
        return order.itensObj.map((i: any) => ({
            name: i.nome,
            quantity: i.qtd,
            addons: [] 
        }));
    }
    return [];
  };

  const handleRepeatOrder = (order: any) => {
    if (confirm("Deseja esvaziar o carrinho atual e repetir este pedido?")) {
        clearCart();
        
        const itemsToRepeat = getOrderItems(order);

        itemsToRepeat.forEach((item: any) => {
            addItem(
                { 
                    id: "repeat-" + Math.random(), 
                    name: item.name, 
                    price: 0, 
                    description: "",
                    image: "",
                    category: "outros"
                }, 
                item.quantity, 
                item.addons, 
                ""
            );
        });

        closeModal();
        openModal("cart");
    }
  };

  return (
    <ModalBase title="Meus Pedidos 📦" onClose={closeModal}>
      <div style={{ padding: "20px", maxHeight: "80vh", overflowY: "auto" }}>
        
        {loading && <p style={{ textAlign: "center", color: "#666" }}>Carregando histórico...</p>}

        {!loading && orders.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#999" }}>
                <div style={{ fontSize: "40px", marginBottom: "10px" }}>🕸️</div>
                <p>Você ainda não fez nenhum pedido.</p>
                <button onClick={closeModal} style={{ marginTop: "20px", color: "#d32f2f", background: "none", border: "1px solid #d32f2f", padding: "8px 16px", borderRadius: "8px", cursor: "pointer" }}>
                    Fazer o primeiro!
                </button>
            </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            {orders.map((order) => {
                const itemsSafe = getOrderItems(order); 
                
                return (
                    <div key={order.id} style={{ background: "#f9f9f9", borderRadius: "12px", padding: "15px", border: "1px solid #eee" }}>
                        
                        {/* Cabeçalho */}
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", borderBottom: "1px solid #eee", paddingBottom: "8px" }}>
                            {/* AQUI ESTÁ A MÁGICA DO FORMAT DATE */}
                            <span style={{ fontWeight: "bold", color: "#333", fontSize: "14px" }}>
                                {formatDate(order.data)}
                            </span>
                            <span style={{ fontWeight: "800", color: "#2e7d32" }}>
                                {order.total?.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}
                            </span>
                        </div>

                        {/* Lista de Itens */}
                        <div style={{ fontSize: "13px", color: "#555", marginBottom: "15px", lineHeight: "1.6" }}>
                            {itemsSafe.map((i: any, idx: number) => (
                                <div key={idx}>
                                    • {i.quantity}x {i.name} 
                                    {i.addons.length > 0 && <span style={{fontSize: "11px", color: "#888"}}> (+{i.addons.length})</span>}
                                </div>
                            ))}
                        </div>

                        <button 
                            onClick={() => handleRepeatOrder(order)}
                            style={{ width: "100%", background: "#fff", border: "1px solid #111", borderRadius: "8px", padding: "10px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                        >
                            🔄 Repetir esse Pedido
                        </button>
                    </div>
                );
            })}
        </div>

      </div>
    </ModalBase>
  );
} 