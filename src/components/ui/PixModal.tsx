"use client";

import { ModalBase } from "./ModalBase";
import { useUIStore } from "@/store/ui";
import { useCartStore } from "@/store/cart.store";
import { useState } from "react";

type PaymentMethod = "pix" | "card" | "cash";

export function PixModal() {
  const closeModal = useUIStore((s) => s.closeModal);
  const cart = useCartStore((s) => s.items);
  const total = useCartStore((s) => s.getCartTotal());
  
  // Estados para controlar a escolha do cliente
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [troco, setTroco] = useState("");
  const [copied, setCopied] = useState(false);

  const PIX_KEY = "34997178336"; 

  const handleCopy = () => {
    navigator.clipboard.writeText(PIX_KEY);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFinishWhatsApp = () => {
    // 1. Monta a lista de itens
    const itensMsg = cart.map(i => `• ${i.quantity}x ${i.name}`).join("\n");
    const totalMsg = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    
    // 2. Define o texto do Pagamento baseado na escolha
    let pagtoMsg = "";
    if (method === "pix") {
      pagtoMsg = "💠 Pagamento via PIX (Comprovante em anexo)";
    } else if (method === "card") {
      pagtoMsg = "💳 Pagamento: Cartão (Levar maquininha)";
    } else {
      pagtoMsg = `💵 Pagamento: Dinheiro${troco ? ` (Troco para R$ ${troco})` : " (Sem troco)"}`;
    }

    // 3. Monta o texto final
    const text = `
🍔 *NOVO PEDIDO - Da Família Lanches*
--------------------------------
${itensMsg}
--------------------------------
💰 *Total: ${totalMsg}*
${pagtoMsg}

📍 *Endereço:* (Confirmar na resposta)
    `.trim();

    // 4. Envia
    const url = `https://wa.me/5534997178336?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
    closeModal();
  };

  return (
    <ModalBase title="Finalizar Pedido 🏁" onClose={closeModal}>
      <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "20px" }}>
        
        {/* Resumo do Valor */}
        <div style={{ textAlign: "center" }}>
          <span style={{ fontSize: "14px", color: "#666" }}>Total a Pagar:</span>
          <div style={{ fontSize: "28px", fontWeight: "900", color: "#2e7d32" }}>
            {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
        </div>

        {/* 1. SELETOR DE PAGAMENTO (Abas) */}
        <div style={{ display: "flex", background: "#f5f5f5", padding: "4px", borderRadius: "12px" }}>
          <button 
            onClick={() => setMethod("pix")}
            style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "none", background: method === "pix" ? "#fff" : "transparent", boxShadow: method === "pix" ? "0 2px 5px rgba(0,0,0,0.1)" : "none", fontWeight: "bold", color: method === "pix" ? "#000" : "#888", cursor: "pointer", transition: "all 0.2s" }}
          >
            💠 PIX
          </button>
          <button 
            onClick={() => setMethod("card")}
            style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "none", background: method === "card" ? "#fff" : "transparent", boxShadow: method === "card" ? "0 2px 5px rgba(0,0,0,0.1)" : "none", fontWeight: "bold", color: method === "card" ? "#000" : "#888", cursor: "pointer", transition: "all 0.2s" }}
          >
            💳 Cartão
          </button>
          <button 
            onClick={() => setMethod("cash")}
            style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "none", background: method === "cash" ? "#fff" : "transparent", boxShadow: method === "cash" ? "0 2px 5px rgba(0,0,0,0.1)" : "none", fontWeight: "bold", color: method === "cash" ? "#000" : "#888", cursor: "pointer", transition: "all 0.2s" }}
          >
            💵 Dinheiro
          </button>
        </div>

        {/* 2. CONTEÚDO DINÂMICO (Muda conforme a escolha) */}
        <div style={{ minHeight: "180px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: "1px solid #eee", borderRadius: "12px", padding: "20px", background: "#fff" }}>
          
          {/* OPÇÃO PIX */}
          {method === "pix" && (
            <>
              <div style={{ width: "140px", height: "140px", background: "#eee", marginBottom: "15px" }}>
                <img 
                  src="/img/pix-qrcode.png" 
                  alt="QR PIX" 
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                  onError={(e) => e.currentTarget.style.display = 'none'} 
                />
              </div>
              <div style={{ display: "flex", gap: "10px", width: "100%" }}>
                <input type="text" readOnly value={PIX_KEY} style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "1px solid #ddd", background: "#f9f9f9", textAlign: "center", fontSize: "12px" }} />
                <button onClick={handleCopy} style={{ background: copied ? "#4caf50" : "#ffca28", color: copied ? "#fff" : "#000", border: "none", borderRadius: "6px", padding: "0 10px", fontWeight: "bold", cursor: "pointer", fontSize: "12px" }}>
                  {copied ? "Copiado!" : "Copiar"}
                </button>
              </div>
              <p style={{ fontSize: "11px", color: "#888", marginTop: "10px", textAlign: "center" }}>
                Pague agora e envie o comprovante no botão abaixo.
              </p>
            </>
          )}

          {/* OPÇÃO CARTÃO */}
          {method === "card" && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "40px", marginBottom: "10px" }}>💳 + 🛵</div>
              <h4 style={{ margin: "0 0 5px 0" }}>Pagamento na Entrega</h4>
              <p style={{ color: "#666", fontSize: "14px", margin: 0 }}>
                O entregador levará a maquininha até você.<br/>Aceitamos Crédito, Débito e Vale.
              </p>
            </div>
          )}

          {/* OPÇÃO DINHEIRO */}
          {method === "cash" && (
            <div style={{ textAlign: "center", width: "100%" }}>
              <div style={{ fontSize: "40px", marginBottom: "10px" }}>💵</div>
              <h4 style={{ margin: "0 0 15px 0" }}>Vai precisar de troco?</h4>
              
              <div style={{ textAlign: "left", marginBottom: "5px", fontSize: "12px", fontWeight: "bold", color: "#444" }}>Troco para quanto? (Opcional)</div>
              <input 
                type="number" 
                placeholder="Ex: 50,00" 
                value={troco}
                onChange={(e) => setTroco(e.target.value)}
                style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #ccc", fontSize: "16px" }} 
              />
              <p style={{ fontSize: "11px", color: "#999", marginTop: "8px" }}>
                Deixe vazio se tiver o valor trocado.
              </p>
            </div>
          )}

        </div>

        {/* 3. BOTÃO FINAL (Muda o texto) */}
        <button
          onClick={handleFinishWhatsApp}
          style={{
            width: "100%",
            background: "#25D366",
            color: "#fff",
            border: "none",
            padding: "16px",
            borderRadius: "12px",
            fontSize: "16px",
            fontWeight: "bold",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            boxShadow: "0 4px 15px rgba(37, 211, 102, 0.3)"
          }}
        >
          <span>💬</span> 
          {method === "pix" ? "Enviar Comprovante no Zap" : "Enviar Pedido no Zap"}
        </button>

      </div>
    </ModalBase>
  );
}