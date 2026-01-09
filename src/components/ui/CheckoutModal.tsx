"use client";

import { useState, useEffect } from "react";
import { ModalBase } from "./ModalBase";
import { useUIStore } from "@/store/ui";
import { useCartStore } from "@/store/cart.store";
import { useAuthStore } from "@/store/auth.store";
import { db } from "@/lib/firebase";
import { collection, doc, getDoc, addDoc, serverTimestamp, increment, setDoc } from "firebase/firestore";
import { getShopStatus } from "@/lib/openingHours"; // <--- 1. IMPORTAÇÃO DO HORÁRIO

type PaymentMethod = "pix" | "card" | "cash";

export function CheckoutModal() {
  const { closeModal } = useUIStore();
  const { items, getCartTotal, clearCart } = useCartStore();
  const { currentUser } = useAuthStore();
  
  // Passos: 1 = Endereço, 2 = Pagamento
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Endereço e Frete
  const [cep, setCep] = useState("");
  const [rua, setRua] = useState("");
  const [bairro, setBairro] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [manualMode, setManualMode] = useState(false);
  
  const [deliveryFee, setDeliveryFee] = useState(6.00); // Padrão
  const [deliveryStatus, setDeliveryStatus] = useState(""); 

  // Pagamento
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [troco, setTroco] = useState("");
  const [pixCopied, setPixCopied] = useState(false);

  // Estados do Cupom
  const [couponCode, setCouponCode] = useState("");
  const [discount, setDiscount] = useState(0);
  const [couponMessage, setCouponMessage] = useState("");

  // Totais
  const subtotal = getCartTotal();
  const isFreteGratis = subtotal >= 80.00; 
  const finalFee = isFreteGratis ? 0 : deliveryFee;
  
  // Cálculo final (evita negativo)
  const total = Math.max(0, subtotal + finalFee - discount);

  const PIX_KEY = "34997178336";

  // --- LÓGICA DE CUPONS ---
  const applyCoupon = () => {
    const code = couponCode.trim().toUpperCase();
    
    const coupons: any = {
        "BRONZE10": { type: "percent", value: 10 },
        "PRATACOCA": { type: "fixed", value: 8.00 },
        "OUROBURGER": { type: "fixed", value: 25.00 },
        "DIAMANTE": { type: "fixed", value: 50.00 }
    };

    if (coupons[code]) {
        const rule = coupons[code];
        let valorDesconto = 0;

        if (rule.type === "percent") {
            valorDesconto = (subtotal * rule.value) / 100;
        } else {
            valorDesconto = rule.value;
        }

        setDiscount(valorDesconto);
        setCouponMessage(`Desconto de ${valorDesconto.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})} aplicado!`);
    } else {
        setDiscount(0);
        setCouponMessage("Cupom inválido ou expirado.");
    }
  };

  // --- LÓGICA 1: VIACEP ---
  const handleBuscarCep = async () => {
    if (cep.length !== 8) return alert("CEP deve ter 8 dígitos");
    setLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (data.erro) {
        setManualMode(true);
        setDeliveryStatus("CEP não achado. Digite manualmente.");
      } else {
        setRua(data.logradouro);
        setBairro(data.bairro);
        setDeliveryStatus("Endereço encontrado!");
        await calcularTaxaEntrega(data.bairro); 
      }
    } catch (error) {
      setManualMode(true);
    }
    setLoading(false);
  };

  // --- LÓGICA 2: TAXA DINÂMICA ---
  const calcularTaxaEntrega = async (nomeBairro: string) => {
    try {
        const docRef = doc(db, "TaxasDeEntrega", "bairros", "lista", "tabela");
        const snap = await getDoc(docRef);
        
        if (snap.exists()) {
            const lista = snap.data()?.data || [];
            const bairroLimpo = nomeBairro.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            
            const achou = lista.find((item: any) => {
                const itemNome = item.nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
                return itemNome === bairroLimpo || itemNome.includes(bairroLimpo);
            });

            if (achou) {
                setDeliveryFee(Number(achou.taxa));
                setDeliveryStatus(`Taxa para ${achou.nome}: R$ ${achou.taxa}`);
            } else {
                setDeliveryFee(6.00); 
                setDeliveryStatus("Bairro não tabelado. Taxa padrão aplicada.");
            }
        }
    } catch (e) {
        console.error("Erro ao buscar taxas", e);
    }
  };

  // --- LÓGICA 3: FINALIZAR PEDIDO (AGORA COM HORÁRIO) ---
  const handleFinish = async () => {
    if (!rua || !numero || !bairro) return alert("Preencha o endereço completo!");
    if (!currentUser) return alert("Você precisa estar logado!");
    
    setLoading(true);

    // 2. VERIFICA SE ESTÁ FECHADO
    const statusLoja = getShopStatus();
    const isClosed = !statusLoja.isOpen; // True se fechado

    const enderecoCompleto = `${rua}, ${numero} - ${bairro} ${complemento ? `(${complemento})` : ''}`;
    
    // 3. SALVAR NO FIREBASE
    try {
        const pedidoData = {
            userId: currentUser.uid,
            userName: currentUser.displayName,
            userEmail: currentUser.email,
            itens: items,
            subtotal,
            taxaEntrega: finalFee,
            desconto: discount,
            cupom: discount > 0 ? couponCode : null,
            total,
            metodoPagamento: method,
            troco: method === 'cash' ? troco : null,
            endereco: enderecoCompleto,
            data: serverTimestamp(),
            // Se fechado, status vira "Agendado", se aberto "Pendente"
            status: isClosed ? "Agendado" : "Pendente", 
            isAgendamento: isClosed 
        };

        await addDoc(collection(db, "Pedidos"), pedidoData);
        
        // Atualiza contagem de pedidos (Fidelidade)
        const userRef = doc(db, "Usuarios", currentUser.uid);
        await setDoc(userRef, { 
            pedidosFeitos: increment(1),
            email: currentUser.email 
        }, { merge: true });

    } catch (error) {
        console.error("Erro ao salvar pedido", error);
        alert("Erro ao salvar, mas vamos enviar pro Zap!");
    }

    // 4. PREPARAR MENSAGEM DO WHATSAPP
    const itensMsg = items.map(i => 
        `• ${i.quantity}x ${i.name} ${i.selectedAddons.length ? `(${i.selectedAddons.map(a=>a.name).join('+')})` : ''}`
    ).join("\n");

    let pagtoTexto = "";
    if (method === "pix") pagtoTexto = "💠 PIX (Comprovante em anexo)";
    if (method === "card") pagtoTexto = "💳 Cartão (Levar maquininha)";
    if (method === "cash") pagtoTexto = `💵 Dinheiro (Troco para: ${troco || 'Sem troco'})`;

    // Título muda se for Agendamento
    const titulo = isClosed 
        ? `🕒 *PEDIDO AGENDADO (Loja Fechada)*` 
        : `🍔 *NOVO PEDIDO - Da Família*`;

    // Aviso extra no final
    const avisoExtra = isClosed 
        ? `\n⚠️ *CLIENTE CIENTE QUE A LOJA ESTÁ FECHADA.*\nEntregar na abertura ou confirmar horário.` 
        : ``;

    const zapText = `
${titulo}
--------------------------------
${itensMsg}
--------------------------------
📍 *Endereço:*
${enderecoCompleto}

💰 Subtotal: ${subtotal.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}
🛵 Entrega: ${finalFee === 0 ? "Grátis" : finalFee.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}
${discount > 0 ? `🔻 Desconto (${couponCode}): - ${discount.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}` : ''}
*TOTAL: ${total.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}*

Pagamento: ${pagtoTexto}
${avisoExtra}
`.trim();

    window.open(`https://wa.me/5534997178336?text=${encodeURIComponent(zapText)}`, "_blank");
    
    clearCart();
    closeModal();
    setLoading(false);
  };

  return (
    <ModalBase title={step === 1 ? "Endereço de Entrega 🛵" : "Pagamento 💸"} onClose={closeModal}>
      <div style={{ padding: "20px" }}>
        
        {/* --- PASSO 1: ENDEREÇO --- */}
        {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {!manualMode && (
                    <div style={{ display: "flex", gap: "10px" }}>
                        <input 
                            placeholder="CEP (Só números)" 
                            value={cep}
                            onChange={e => setCep(e.target.value.replace(/\D/g, ""))}
                            maxLength={8}
                            style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #ccc" }}
                        />
                        <button onClick={handleBuscarCep} disabled={loading} style={{ background: "#ffca28", border: "none", borderRadius: "8px", padding: "0 15px", fontWeight: "bold" }}>
                            {loading ? "..." : "Buscar"}
                        </button>
                    </div>
                )}
                
                <input placeholder="Rua" value={rua} onChange={e => setRua(e.target.value)} disabled={!manualMode} style={{ padding: "12px", borderRadius: "8px", border: "1px solid #eee", background: manualMode ? "#fff" : "#f9f9f9" }} />
                
                <div style={{ display: "flex", gap: "10px" }}>
                    <input placeholder="Número" value={numero} onChange={e => setNumero(e.target.value)} style={{ width: "80px", padding: "12px", borderRadius: "8px", border: "1px solid #ccc" }} />
                    <input placeholder="Bairro" value={bairro} onChange={e => setBairro(e.target.value)} disabled={!manualMode} style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #eee", background: manualMode ? "#fff" : "#f9f9f9" }} />
                </div>

                <input placeholder="Complemento (Opcional)" value={complemento} onChange={e => setComplemento(e.target.value)} style={{ padding: "12px", borderRadius: "8px", border: "1px solid #ccc" }} />

                <div style={{ fontSize: "12px", color: deliveryFee === 6 ? "#666" : "green", marginTop: "5px" }}>
                    {deliveryStatus}
                </div>

                <div style={{ marginTop: "10px", textAlign: "right" }}>
                    <button onClick={() => setManualMode(!manualMode)} style={{ background: "none", border: "none", color: "#888", textDecoration: "underline", fontSize: "12px", cursor: "pointer" }}>
                        {manualMode ? "Tentar buscar CEP" : "Não sei meu CEP / Digitar Manual"}
                    </button>
                </div>

                <button onClick={() => setStep(2)} disabled={!rua || !numero} style={{ marginTop: "15px", background: "#111", color: "#fff", padding: "15px", borderRadius: "8px", border: "none", fontWeight: "bold", cursor: "pointer", opacity: (!rua || !numero) ? 0.5 : 1 }}>
                    Ir para Pagamento
                </button>
            </div>
        )}

        {/* --- PASSO 2: PAGAMENTO --- */}
        {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                
                {/* --- CAMPO DE CUPOM --- */}
                <div style={{ display: "flex", gap: "10px", background: "#f0f8ff", padding: "10px", borderRadius: "8px", border: "1px dashed #2196f3" }}>
                    <input 
                        placeholder="Possui cupom? Digite aqui" 
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontSize: "14px" }}
                    />
                    <button 
                        onClick={applyCoupon}
                        style={{ background: "transparent", color: "#2196f3", fontWeight: "bold", border: "none", cursor: "pointer" }}
                    >
                        APLICAR
                    </button>
                </div>
                {couponMessage && <div style={{ fontSize: "12px", color: discount > 0 ? "green" : "red", marginTop: "-10px" }}>{couponMessage}</div>}

                {/* Resumo Valores */}
                <div style={{ background: "#f9f9f9", padding: "15px", borderRadius: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
                        <span>Subtotal:</span>
                        <span>{subtotal.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", color: isFreteGratis ? "green" : "#666" }}>
                        <span>Entrega ({bairro}):</span>
                        <span>{isFreteGratis ? "GRÁTIS" : deliveryFee.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</span>
                    </div>

                    {discount > 0 && (
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", color: "#2e7d32", fontWeight: "bold" }}>
                            <span>Desconto ({couponCode}):</span>
                            <span>- {discount.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</span>
                        </div>
                    )}

                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "20px", fontWeight: "bold", marginTop: "10px", borderTop: "1px solid #ddd", paddingTop: "10px" }}>
                        <span>Total:</span>
                        <span>{total.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</span>
                    </div>
                </div>

                {/* Seletor Pagamento */}
                <div style={{ display: "flex", background: "#eee", padding: "4px", borderRadius: "8px" }}>
                    {['pix', 'card', 'cash'].map((m) => (
                        <button 
                            key={m}
                            onClick={() => setMethod(m as PaymentMethod)}
                            style={{ flex: 1, padding: "8px", borderRadius: "6px", border: "none", background: method === m ? "#fff" : "transparent", fontWeight: "bold", cursor: "pointer" }}
                        >
                            {m === 'pix' ? '💠 PIX' : m === 'card' ? '💳 Cartão' : '💵 Dinheiro'}
                        </button>
                    ))}
                </div>

                {/* Conteúdo Dinâmico */}
                {method === "pix" && (
                    <div style={{ textAlign: "center", padding: "10px", border: "1px solid #eee", borderRadius: "8px" }}>
                        <p style={{ fontSize: "12px", color: "#666" }}>Copie a chave e pague no app do banco:</p>
                        <div style={{ display: "flex", gap: "5px", marginTop: "5px" }}>
                            <input readOnly value={PIX_KEY} style={{ flex: 1, padding: "8px", borderRadius: "4px", border: "1px solid #ccc", fontSize: "12px", textAlign: "center" }} />
                            <button onClick={() => { navigator.clipboard.writeText(PIX_KEY); setPixCopied(true); }} style={{ background: pixCopied ? "green" : "#ffca28", border: "none", borderRadius: "4px", padding: "0 10px", color: pixCopied ? "#fff" : "#000", fontSize: "12px", fontWeight: "bold" }}>
                                {pixCopied ? "Copiado!" : "Copiar"}
                            </button>
                        </div>
                    </div>
                )}

                {method === "cash" && (
                    <input 
                        placeholder="Precisa de troco para quanto?" 
                        value={troco}
                        onChange={e => setTroco(e.target.value)}
                        style={{ padding: "12px", borderRadius: "8px", border: "1px solid #ccc" }}
                    />
                )}

                {/* Botões Finais */}
                <div style={{ display: "flex", gap: "10px" }}>
                    <button onClick={() => setStep(1)} style={{ flex: 1, background: "#ccc", border: "none", borderRadius: "8px", padding: "15px", fontWeight: "bold" }}>Voltar</button>
                    <button onClick={handleFinish} disabled={loading} style={{ flex: 2, background: "#25D366", color: "#fff", border: "none", borderRadius: "8px", padding: "15px", fontWeight: "bold", fontSize: "16px" }}>
                        {loading ? "Salvando..." : "Finalizar no Zap 💬"}
                    </button>
                </div>

            </div>
        )}
      </div>
    </ModalBase>
  );
}