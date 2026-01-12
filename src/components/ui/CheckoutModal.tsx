"use client";

import { useState, useEffect } from "react";
import { ModalBase } from "./ModalBase";
import { useUIStore } from "@/store/ui";
import { useCartStore } from "@/store/cart.store";
import { useAuthStore } from "@/store/auth.store";
import { db } from "@/lib/firebase";
import { collection, doc, getDoc, addDoc, serverTimestamp, increment, setDoc } from "firebase/firestore";
import { getShopStatus } from "@/lib/openingHours";

type PaymentMethod = "pix" | "card" | "cash";
type DeliveryMode = "delivery" | "pickup";

export function CheckoutModal() {
    const { closeModal } = useUIStore();
    const { items, getCartTotal, clearCart } = useCartStore();
    const { currentUser } = useAuthStore();

    // Passos: 1 = Endereço, 2 = Pagamento
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("delivery");

    // Telefone do usuário
    const [userPhone, setUserPhone] = useState("");

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
    const isRetirada = deliveryMode === "pickup";
    const finalFee = (isFreteGratis || isRetirada) ? 0 : deliveryFee;

    // Cálculo final (evita negativo)
    const total = Math.max(0, subtotal + finalFee - discount);

    const PIX_KEY = "34997178336";

    // --- LÓGICA DE CUPONS (BUSCA REAL NO FIREBASE) ---
    const applyCoupon = async () => {
        const code = couponCode.trim().toUpperCase();
        if (!code) return;

        setLoading(true);
        try {
            const docRef = doc(db, "Cupons", code);
            const snap = await getDoc(docRef);

            if (snap.exists() && snap.data().ativo) {
                const data = snap.data();
                let valorDesconto = 0;

                if (data.tipo === "percent") {
                    valorDesconto = (subtotal * data.percent) / 100;
                } else {
                    valorDesconto = data.valor;
                }

                setDiscount(valorDesconto);
                setCouponMessage(`✅ Desconto de ${valorDesconto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} aplicado!`);
            } else {
                setDiscount(0);
                setCouponMessage("❌ Cupom inválido ou expirado.");
            }
        } catch (e) {
            setCouponMessage("Erro ao validar cupom.");
        }
        setLoading(false);
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

    // --- LÓGICA 3: FINALIZAR PEDIDO ---
    const handleFinish = async () => {
        // Validação condicional: só exige endereço se for Entrega
        if (deliveryMode === "delivery" && (!rua || !numero || !bairro)) {
            return alert("Preencha o endereço completo!");
        }
        if (!currentUser) return alert("Você precisa estar logado!");

        setLoading(true);

        const statusLoja = getShopStatus();
        const isClosed = !statusLoja.isOpen;

        const enderecoFinal = deliveryMode === "pickup"
            ? "🛍️ RETIRADA NO LOCAL"
            : `${rua}, ${numero} - ${bairro} ${complemento ? `(${complemento})` : ''}`;

        try {
            const pedidoData = {
                userId: currentUser.uid,
                userName: currentUser.displayName,
                userEmail: currentUser.email,
                userPhone: userPhone,
                itens: items,
                subtotal,
                taxaEntrega: finalFee,
                desconto: discount,
                cupom: discount > 0 ? couponCode : null,
                total,
                metodoPagamento: method,
                troco: method === 'cash' ? troco : null,
                endereco: enderecoFinal,
                tipoEntrega: deliveryMode,
                data: serverTimestamp(),
                status: isClosed ? "Agendado" : "Pendente",
                isAgendamento: isClosed
            };

            await addDoc(collection(db, "Pedidos"), pedidoData);

            const userRef = doc(db, "Usuarios", currentUser.uid);
            await setDoc(userRef, {
                pedidosFeitos: increment(1),
                email: currentUser.email
            }, { merge: true });

        } catch (error) {
            console.error("Erro ao salvar pedido", error);
        }

        const itensMsg = items.map(i =>
            `• ${i.quantity}x ${i.name} ${i.selectedAddons?.length ? `(${i.selectedAddons.map(a => a.name).join('+')})` : ''}`
        ).join("\n");

        let pagtoTexto = "";
        if (method === "pix") pagtoTexto = "💠 PIX (Comprovante em anexo)";
        if (method === "card") pagtoTexto = "💳 Cartão (Levar maquininha)";
        if (method === "cash") pagtoTexto = `💵 Dinheiro (Troco para: ${troco || 'Sem troco'})`;

        const titulo = isClosed
            ? `🕒 *PEDIDO AGENDADO (Loja Fechada)*`
            : `🍔 *NOVO PEDIDO - Da Família*`;

        const zapText = `
${titulo}
--------------------------------
${itensMsg}
--------------------------------
📍 *Modo:* ${deliveryMode === "pickup" ? "🛍️ Retirada" : "🛵 Entrega"}
${deliveryMode === "delivery" ? `🏠 *Endereço:* ${enderecoFinal}` : "🏢 Retirar no Balcão"}

💰 Subtotal: ${subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
🛵 Entrega: ${finalFee === 0 ? "Grátis" : finalFee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
${discount > 0 ? `🔻 Desconto (${couponCode}): - ${discount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` : ''}
*TOTAL: ${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}*

Pagamento: ${pagtoTexto}
`.trim();

        window.open(`https://wa.me/5534997178336?text=${encodeURIComponent(zapText)}`, "_blank");

        clearCart();
        closeModal();
        setLoading(false);
    };

    return (
        <ModalBase title={step === 1 ? "Como deseja receber? 🛵" : "Pagamento 💸"} onClose={closeModal}>
            <div style={{ padding: "20px" }}>

                {/* --- PASSO 1: ENDEREÇO / MODO --- */}
                {step === 1 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>

                        {/* SELETOR MODO DE RECEBIMENTO */}
                        <div style={{ display: "flex", background: "#f5f5f5", padding: "4px", borderRadius: "10px", marginBottom: "15px" }}>
                            <button
                                onClick={() => setDeliveryMode("delivery")}
                                style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "none", background: deliveryMode === "delivery" ? "#111" : "transparent", color: deliveryMode === "delivery" ? "#fff" : "#666", fontWeight: "bold", cursor: "pointer" }}
                            >
                                🛵 Entrega
                            </button>
                            <button
                                onClick={() => setDeliveryMode("pickup")}
                                style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "none", background: deliveryMode === "pickup" ? "#111" : "transparent", color: deliveryMode === "pickup" ? "#fff" : "#666", fontWeight: "bold", cursor: "pointer" }}
                            >
                                🛍️ Retirada
                            </button>
                        </div>

                        {/* CAMPO WHATSAPP DO CLIENTE */}
                        <div style={{ marginBottom: "10px" }}>
                            <label style={{ fontSize: "12px", fontWeight: "bold", color: "#111" }}>SEU WHATSAPP (PARA AVISOS):</label>
                            <input
                                placeholder="(00) 00000-0000"
                                value={userPhone}
                                onChange={e => setUserPhone(e.target.value.replace(/\D/g, ""))}
                                style={{ width: "100%", padding: "14px", borderRadius: "10px", border: "2px solid #ffca28", fontSize: "16px", outline: "none", marginTop: "5px" }}
                            />
                        </div>

                        {deliveryMode === "delivery" ? (
                            <>
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
                            </>
                        ) : (
                            <div style={{ padding: "30px 20px", background: "#fff9c4", borderRadius: "12px", textAlign: "center", border: "1px solid #fbc02d", marginBottom: "15px" }}>
                                <p style={{ fontSize: "16px", fontWeight: "bold", color: "#827717", marginBottom: "5px" }}>📍 Retirada no Balcão</p>
                                <p style={{ fontSize: "13px", color: "#827717" }}>Preparemos seu pedido e te avisamos pelo WhatsApp!</p>
                            </div>
                        )}

                        <button
                            onClick={() => setStep(2)}
                            disabled={deliveryMode === "delivery" && (!rua || !numero)}
                            style={{
                                marginTop: "15px", background: "#111", color: "#fff", padding: "16px",
                                borderRadius: "12px", border: "none", fontWeight: "bold", cursor: "pointer",
                                opacity: (deliveryMode === "delivery" && (!rua || !numero)) ? 0.5 : 1
                            }}
                        >
                            Ir para Pagamento →
                        </button>
                    </div>
                )}

                {/* --- PASSO 2: PAGAMENTO --- */}
                {step === 2 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>

                        {/* --- CONTAINER DO CUPOM COM ALINHAMENTO MILIMÉTRICO --- */}
                        <div style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            border: "2px dashed #2196f3", // Borda um pouco mais grossa para destacar
                            borderRadius: "12px",
                            padding: "0 15px", // Padding apenas nas laterais
                            marginTop: "20px",
                            background: "#f8fbff",
                            height: "50px", // Altura fixa para garantir centralização vertical
                            overflow: "hidden"
                        }}>
                            <input
                                type="text"
                                placeholder="Possui cupom? Digite aqui"
                                style={{
                                    border: "none",
                                    background: "transparent",
                                    outline: "none",
                                    flex: 1,
                                    fontSize: "14px",
                                    fontWeight: "500",
                                    color: "#333",
                                    height: "100%", // Ocupa toda a altura do container
                                    padding: 0
                                }}
                            />
                            <button style={{
                                background: "none",
                                border: "none",
                                color: "#2196f3",
                                fontWeight: "900",
                                fontSize: "13px",
                                cursor: "pointer",
                                padding: "0 0 0 10px", // Espaço entre o texto do input e o botão
                                height: "100%", // Garante que o botão tenha a mesma base do input
                                display: "flex",
                                alignItems: "center",
                                textTransform: "uppercase",
                                letterSpacing: "0.5px"
                            }}>
                                APLICAR
                            </button>
                        </div>


                        {couponMessage && <div style={{ fontSize: "12px", color: discount > 0 ? "green" : "red", marginTop: "-10px" }}>{couponMessage}</div>}

                        {/* Resumo Valores */}
                        <div style={{ background: "#f9f9f9", padding: "15px", borderRadius: "12px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px" }}>
                                <span>Subtotal:</span>
                                <span>{subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", color: (isFreteGratis || isRetirada) ? "green" : "#666" }}>
                                <span>Entrega {deliveryMode === "delivery" ? `(${bairro})` : "(Retirada)"}:</span>
                                <span>{(isFreteGratis || isRetirada) ? "GRÁTIS" : deliveryFee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>

                            {discount > 0 && (
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", color: "#2e7d32", fontWeight: "bold" }}>
                                    <span>Desconto ({couponCode}):</span>
                                    <span>- {discount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                </div>
                            )}

                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "20px", fontWeight: "bold", marginTop: "10px", borderTop: "1px solid #ddd", paddingTop: "10px" }}>
                                <span>Total:</span>
                                <span>{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
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
                                    {m === 'pix' ? '💠 PIX' : m === 'card' ? '💳 Card' : '💵 Dinheiro'}
                                </button>
                            ))}
                        </div>

                        {/* Conteúdo Dinâmico Pagamento (PIX) */}
                        {method === "pix" && (
                            <div style={{ textAlign: "center", padding: "15px", border: "1px solid #e3f2fd", borderRadius: "12px", background: "#fbb03422" }}>
                                <p style={{ fontSize: "12px", color: "#666" }}>Copie a chave e pague no app do seu banco:</p>
                                <div style={{ display: "flex", gap: "5px", marginTop: "10px" }}>
                                    <input readOnly value={PIX_KEY} style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #ccc", fontSize: "13px", textAlign: "center", fontWeight: "bold" }} />
                                    <button onClick={() => { navigator.clipboard.writeText(PIX_KEY); setPixCopied(true); }} style={{ background: pixCopied ? "#388e3c" : "#ffca28", border: "none", borderRadius: "8px", padding: "0 15px", color: pixCopied ? "#fff" : "#000", fontSize: "12px", fontWeight: "bold", cursor: "pointer" }}>
                                        {pixCopied ? "Copiado!" : "Copiar"}
                                    </button>
                                </div>
                            </div>
                        )}

                        {method === "cash" && (
                            <input
                                placeholder="Troco para quanto?"
                                value={troco}
                                onChange={e => setTroco(e.target.value)}
                                style={{ padding: "12px", borderRadius: "8px", border: "1px solid #ccc" }}
                            />
                        )}

                        {/* Botões Finais */}
                        <div style={{ display: "flex", gap: "10px", marginTop: "5px" }}>
                            <button onClick={() => setStep(1)} style={{ flex: 1, background: "transparent", border: "1px solid #ccc", borderRadius: "12px", padding: "16px", fontWeight: "bold", cursor: "pointer" }}>Voltar</button>
                            <button onClick={handleFinish} disabled={loading} style={{ flex: 2, background: "#25D366", color: "#fff", border: "none", borderRadius: "12px", padding: "16px", fontWeight: "bold", fontSize: "16px", cursor: "pointer" }}>
                                {loading ? "Salvando..." : "Finalizar Pedido 💬"}
                            </button>
                        </div>

                    </div>
                )}
            </div>
        </ModalBase>
    );
}