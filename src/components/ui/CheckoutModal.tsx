"use client";

import { useMemo, useState } from "react";
import { addDoc, collection, doc, getDoc, increment, serverTimestamp, setDoc } from "firebase/firestore";
import { ModalBase } from "./ModalBase";
import { useUIStore } from "@/store/ui";
import { useCartStore } from "@/store/cart.store";
import { useAuthStore } from "@/store/auth.store";
import { db } from "@/lib/firebase";
import { getEffectiveShopStatus } from "@/lib/shopStatus";

type PaymentMethod = "pix" | "cartao" | "dinheiro";
type DeliveryMode = "delivery" | "pickup";

type DeliveryRate = { nome?: string; taxa?: number | string };

const PIX_KEY = "34997178336";
const WHATSAPP_NUMBER = "5534997178336";
const DEFAULT_DELIVERY_FEE = 6;

const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const normalizeText = (value: string) =>
  value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

export function CheckoutModal() {
  const { closeModal } = useUIStore();
  const { items, getCartTotal, clearCart } = useCartStore();
  const currentUser = useAuthStore((s) => s.currentUser);

  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("delivery");
  const [userPhone, setUserPhone] = useState("");
  const [cep, setCep] = useState("");
  const [rua, setRua] = useState("");
  const [bairro, setBairro] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState(DEFAULT_DELIVERY_FEE);
  const [deliveryStatus, setDeliveryStatus] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [troco, setTroco] = useState("");
  const [pixCopied, setPixCopied] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCouponCode, setAppliedCouponCode] = useState("");
  const [discount, setDiscount] = useState(0);
  const [couponMessage, setCouponMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const subtotal = getCartTotal();
  const isPickup = deliveryMode === "pickup";
  const hasFreeDelivery = subtotal >= 80;
  const finalFee = isPickup || hasFreeDelivery ? 0 : deliveryFee;
  const safeDiscount = Math.min(Math.max(0, discount), subtotal);
  const total = Math.max(0, subtotal + finalFee - safeDiscount);

  const phoneDigits = userPhone.replace(/\D/g, "");
  const addressReady = isPickup || Boolean(rua.trim() && numero.trim() && bairro.trim());
  const phoneReady = phoneDigits.length === 10 || phoneDigits.length === 11;

  const canAdvance = phoneReady && addressReady && items.length > 0;

  const changeCouponCode = (value: string) => {
    const next = value.toUpperCase();
    setCouponCode(next);
    if (appliedCouponCode && next.trim() !== appliedCouponCode) {
      setAppliedCouponCode("");
      setDiscount(0);
      setCouponMessage("Cupom alterado. Valide novamente para aplicar o desconto.");
    }
  };

  const formatPhone = (value: string) => {
    let digits = value.replace(/\D/g, "").slice(0, 11);
    digits = digits.replace(/^(\d{2})(\d)/g, "($1) $2");
    digits = digits.replace(/(\d)(\d{4})$/, "$1-$2");
    return digits;
  };

  const formatCEP = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    return digits.replace(/^(\d{5})(\d)/, "$1-$2");
  };

  const calculateDeliveryFee = async (district: string) => {
    const cleanedDistrict = normalizeText(district);
    if (!cleanedDistrict) return;

    try {
      const snap = await getDoc(doc(db, "TaxasDeEntrega", "bairros", "lista", "tabela"));
      if (!snap.exists()) {
        setDeliveryFee(DEFAULT_DELIVERY_FEE);
        setDeliveryStatus(`Taxa padrão: ${money(DEFAULT_DELIVERY_FEE)}`);
        return;
      }

      const list = Array.isArray(snap.data()?.data) ? (snap.data().data as DeliveryRate[]) : [];
      const found = list.find((item) => {
        const name = typeof item.nome === "string" ? normalizeText(item.nome) : "";
        return name === cleanedDistrict || name.includes(cleanedDistrict) || cleanedDistrict.includes(name);
      });

      const rate = Number(found?.taxa);
      if (found && Number.isFinite(rate) && rate >= 0) {
        setDeliveryFee(rate);
        setDeliveryStatus(`Taxa para ${found.nome || district}: ${money(rate)}`);
      } else {
        setDeliveryFee(DEFAULT_DELIVERY_FEE);
        setDeliveryStatus(`Bairro fora da tabela. Taxa padrão: ${money(DEFAULT_DELIVERY_FEE)}`);
      }
    } catch (error) {
      console.error("Erro ao buscar taxas", error);
      setDeliveryFee(DEFAULT_DELIVERY_FEE);
      setDeliveryStatus(`Não foi possível consultar a tabela. Taxa padrão: ${money(DEFAULT_DELIVERY_FEE)}`);
    }
  };

  const handleSearchCep = async () => {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) {
      setDeliveryStatus("Digite um CEP com 8 números.");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      if (!response.ok) throw new Error(`ViaCEP respondeu ${response.status}`);
      const data = await response.json();
      if (data.erro) {
        setManualMode(true);
        setDeliveryStatus("CEP não encontrado. Preencha o endereço manualmente.");
        return;
      }
      const nextStreet = typeof data.logradouro === "string" ? data.logradouro : "";
      const nextDistrict = typeof data.bairro === "string" ? data.bairro : "";
      setRua(nextStreet);
      setBairro(nextDistrict);
      setManualMode(!nextStreet || !nextDistrict);
      setDeliveryStatus("Endereço encontrado.");
      if (nextDistrict) await calculateDeliveryFee(nextDistrict);
    } catch (error) {
      console.error("Erro ao consultar CEP", error);
      setManualMode(true);
      setDeliveryStatus("Não foi possível consultar o CEP. Preencha manualmente.");
    } finally {
      setLoading(false);
    }
  };

  const applyCoupon = async () => {
    const code = couponCode.trim().toUpperCase();
    setCouponMessage("");
    setAppliedCouponCode("");
    setDiscount(0);

    if (!code) {
      setCouponMessage("Digite um cupom antes de validar.");
      return;
    }

    setLoading(true);
    try {
      const snap = await getDoc(doc(db, "Cupons", code));
      if (!snap.exists() || snap.data().ativo !== true) {
        setCouponMessage("Cupom inválido, inativo ou expirado.");
        return;
      }

      const data = snap.data();
      const rawValue = Number(data.valor ?? data.percent ?? 0);
      if (!Number.isFinite(rawValue) || rawValue <= 0) {
        setCouponMessage("Este cupom está configurado de forma inválida.");
        return;
      }

      const calculated = data.tipo === "percent" || data.tipo === "porcentagem"
        ? (subtotal * rawValue) / 100
        : rawValue;
      const bounded = Math.min(subtotal, Math.max(0, calculated));

      setCouponCode(code);
      setAppliedCouponCode(code);
      setDiscount(bounded);
      setCouponMessage(`${money(bounded)} de desconto aplicado.`);
    } catch (error) {
      console.error("Erro ao validar cupom", error);
      setCouponMessage("Não foi possível validar o cupom agora.");
    } finally {
      setLoading(false);
    }
  };

  const cashValue = useMemo(() => {
    if (!troco.trim()) return null;
    const normalized = troco.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
    const value = Number(normalized);
    return Number.isFinite(value) ? value : null;
  }, [troco]);

  const finishOrder = async () => {
    setErrorMessage("");
    if (!currentUser) {
      setErrorMessage("Sua sessão expirou. Entre novamente para finalizar.");
      return;
    }
    if (items.length === 0) {
      setErrorMessage("Seu carrinho está vazio.");
      return;
    }
    if (!phoneReady) {
      setStep(1);
      setErrorMessage("Informe um WhatsApp válido com DDD.");
      return;
    }
    if (!addressReady) {
      setStep(1);
      setErrorMessage("Preencha rua, número e bairro para entrega.");
      return;
    }
    if (method === "dinheiro" && cashValue !== null && cashValue < total) {
      setErrorMessage(`O valor para troco precisa ser pelo menos ${money(total)}.`);
      return;
    }

    setLoading(true);
    try {
      const shopStatus = await getEffectiveShopStatus();
      const isClosed = !shopStatus.isOpen;
      const finalAddress = isPickup
        ? "RETIRADA NO LOCAL"
        : `${rua.trim()}, ${numero.trim()} - ${bairro.trim()}${complemento.trim() ? ` (${complemento.trim()})` : ""}`;

      const orderData = {
        userId: currentUser.uid,
        userName: currentUser.displayName,
        userEmail: currentUser.email,
        userPhone: userPhone.trim(),
        itens: items,
        subtotal,
        taxaEntrega: finalFee,
        desconto: safeDiscount,
        cupom: safeDiscount > 0 && appliedCouponCode ? appliedCouponCode : null,
        total,
        metodoPagamento: method,
        trocoPara: method === "dinheiro" ? (troco.trim() || null) : null,
        endereco: finalAddress,
        tipoEntrega: deliveryMode,
        data: serverTimestamp(),
        status: isClosed ? "Agendado" : "Pendente",
        isAgendamento: isClosed,
      };

      const orderRef = await addDoc(collection(db, "Pedidos"), orderData);

      try {
        await setDoc(doc(db, "Usuarios", currentUser.uid), {
          pedidosFeitos: increment(1),
          email: currentUser.email,
        }, { merge: true });
      } catch (profileError) {
        console.error("Pedido salvo, mas falhou ao atualizar fidelidade", profileError);
      }

      const itemsMessage = items.map((item) => {
        const addons = item.selectedAddons?.length ? `\n   + ${item.selectedAddons.map((addon) => addon.name).join(", ")}` : "";
        const observation = item.observation?.trim() ? `\n   Obs.: ${item.observation.trim()}` : "";
        return `• ${item.quantity}x ${item.name} — ${money(item.price * item.quantity)}${addons}${observation}`;
      }).join("\n");

      const paymentText = method === "pix"
        ? "PIX"
        : method === "cartao"
          ? "Cartão — levar maquininha"
          : `Dinheiro${troco.trim() ? ` — troco para ${troco.trim()}` : " — sem troco informado"}`;

      const message = [
        isClosed ? "🕒 *PEDIDO AGENDADO — Da Família*" : "🍔 *NOVO PEDIDO — Da Família*",
        `Pedido: *#${orderRef.id.slice(-8).toUpperCase()}*`,
        "",
        itemsMessage,
        "",
        `📍 ${isPickup ? "Retirada no balcão" : finalAddress}`,
        `📱 ${userPhone.trim()}`,
        "",
        `Subtotal: ${money(subtotal)}`,
        `Entrega: ${finalFee === 0 ? "Grátis" : money(finalFee)}`,
        safeDiscount > 0 ? `Desconto${appliedCouponCode ? ` (${appliedCouponCode})` : ""}: -${money(safeDiscount)}` : null,
        `*TOTAL: ${money(total)}*`,
        `Pagamento: ${paymentText}`,
        isClosed ? "\nLoja fechada neste momento: pedido registrado como agendado." : null,
      ].filter(Boolean).join("\n");

      clearCart();
      closeModal();
      window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Erro ao salvar pedido", error);
      setErrorMessage("Não conseguimos registrar o pedido. Seu carrinho foi preservado. Tente novamente antes de enviar pelo WhatsApp.");
    } finally {
      setLoading(false);
    }
  };

  const fieldStyle = { width: "100%", boxSizing: "border-box" as const, padding: "13px 14px", borderRadius: 11, border: "1px solid #ddd", outline: "none", fontSize: 14, background: "#fff" };

  return (
    <ModalBase title={step === 1 ? "Entrega ou retirada" : "Revise e pague"} onClose={closeModal}>
      <div style={{ padding: 18 }}>
        <div style={{ display: "flex", gap: 7, marginBottom: 18 }}>
          <div style={{ flex: 1, height: 5, borderRadius: 99, background: "#111" }} />
          <div style={{ flex: 1, height: 5, borderRadius: 99, background: step === 2 ? "#111" : "#e5e5e5" }} />
        </div>

        {errorMessage && <div style={{ background: "#fff1f0", color: "#a61b1b", border: "1px solid #ffd0cc", borderRadius: 12, padding: 12, marginBottom: 14, fontSize: 12, lineHeight: 1.45 }}>{errorMessage}</div>}

        {step === 1 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 5, padding: 4, background: "#f3f3f3", borderRadius: 12 }}>
              <button onClick={() => setDeliveryMode("delivery")} style={{ flex: 1, padding: 12, border: 0, borderRadius: 9, background: deliveryMode === "delivery" ? "#111" : "transparent", color: deliveryMode === "delivery" ? "#fff" : "#555", fontWeight: 900, cursor: "pointer" }}>Entrega</button>
              <button onClick={() => setDeliveryMode("pickup")} style={{ flex: 1, padding: 12, border: 0, borderRadius: 9, background: deliveryMode === "pickup" ? "#111" : "transparent", color: deliveryMode === "pickup" ? "#fff" : "#555", fontWeight: 900, cursor: "pointer" }}>Retirada</button>
            </div>

            <label style={{ fontSize: 11, fontWeight: 900 }}>WHATSAPP COM DDD
              <input placeholder="(34) 99999-9999" value={userPhone} onChange={(event) => setUserPhone(formatPhone(event.target.value))} inputMode="tel" style={{ ...fieldStyle, marginTop: 6, borderColor: phoneReady || !userPhone ? "#ddd" : "#ef9a9a" }} />
            </label>

            {deliveryMode === "delivery" ? (
              <>
                {!manualMode && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <input placeholder="CEP" value={cep} onChange={(event) => setCep(formatCEP(event.target.value))} onBlur={() => { if (cep.replace(/\D/g, "").length === 8) void handleSearchCep(); }} inputMode="numeric" style={fieldStyle} />
                    <button onClick={() => void handleSearchCep()} disabled={loading} style={{ border: 0, borderRadius: 11, background: "#ffca28", padding: "0 15px", fontWeight: 900, cursor: "pointer" }}>{loading ? "…" : "Buscar"}</button>
                  </div>
                )}

                <input placeholder="Rua" value={rua} onChange={(event) => setRua(event.target.value)} readOnly={!manualMode} style={{ ...fieldStyle, background: manualMode ? "#fff" : "#f7f7f7" }} />
                <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 8 }}>
                  <input placeholder="Número" value={numero} onChange={(event) => setNumero(event.target.value)} inputMode="numeric" style={fieldStyle} />
                  <input placeholder="Bairro" value={bairro} onChange={(event) => setBairro(event.target.value)} onBlur={() => { if (manualMode && bairro.trim()) void calculateDeliveryFee(bairro); }} readOnly={!manualMode} style={{ ...fieldStyle, background: manualMode ? "#fff" : "#f7f7f7" }} />
                </div>
                <input placeholder="Complemento (opcional)" value={complemento} onChange={(event) => setComplemento(event.target.value)} style={fieldStyle} />

                {deliveryStatus && <div style={{ fontSize: 11, color: "#666", lineHeight: 1.4 }}>{deliveryStatus}</div>}
                <button onClick={() => setManualMode((value) => !value)} style={{ alignSelf: "flex-start", border: 0, background: "transparent", padding: 0, color: "#666", textDecoration: "underline", fontSize: 11, cursor: "pointer" }}>{manualMode ? "Voltar para busca por CEP" : "Preencher endereço manualmente"}</button>
              </>
            ) : (
              <div style={{ background: "#fff8d7", border: "1px solid #ffe082", borderRadius: 14, padding: 16 }}>
                <strong style={{ display: "block", fontSize: 13 }}>Retirada no balcão</strong>
                <span style={{ display: "block", marginTop: 4, color: "#6d5b00", fontSize: 11, lineHeight: 1.45 }}>Você recebe o aviso pelo WhatsApp quando o pedido estiver em andamento.</span>
              </div>
            )}

            <button onClick={() => { setErrorMessage(""); if (canAdvance) setStep(2); else setErrorMessage(!phoneReady ? "Informe um WhatsApp válido com DDD." : "Complete o endereço para continuar."); }} style={{ marginTop: 5, width: "100%", border: 0, borderRadius: 13, background: "#111", color: "#fff", padding: 16, fontWeight: 900, cursor: "pointer", opacity: canAdvance ? 1 : 0.65 }}>Continuar</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14, background: "#fafafa" }}>
              <strong style={{ display: "block", fontSize: 12 }}>Recebimento</strong>
              <span style={{ display: "block", marginTop: 5, color: "#666", fontSize: 11, lineHeight: 1.45 }}>{isPickup ? "Retirada no local" : `${rua}, ${numero} - ${bairro}${complemento ? ` · ${complemento}` : ""}`}</span>
              <span style={{ display: "block", marginTop: 3, color: "#666", fontSize: 11 }}>{userPhone}</span>
            </div>

            <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
              <strong style={{ display: "block", fontSize: 12, marginBottom: 9 }}>Cupom</strong>
              <div style={{ display: "flex", gap: 8 }}>
                <input placeholder="Código do cupom" value={couponCode} onChange={(event) => changeCouponCode(event.target.value)} autoCapitalize="characters" style={fieldStyle} />
                <button onClick={() => void applyCoupon()} disabled={loading || !couponCode.trim()} style={{ border: 0, borderRadius: 11, background: "#ffca28", padding: "0 14px", fontWeight: 900, cursor: "pointer" }}>Aplicar</button>
              </div>
              {couponMessage && <span style={{ display: "block", marginTop: 7, fontSize: 10, color: safeDiscount > 0 ? "#2e7d32" : "#777" }}>{couponMessage}</span>}
            </div>

            <div style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8 }}><span>Subtotal</span><span>{money(subtotal)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8 }}><span>Entrega</span><span style={{ color: finalFee === 0 ? "#2e7d32" : "inherit" }}>{finalFee === 0 ? "Grátis" : money(finalFee)}</span></div>
              {safeDiscount > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#2e7d32", marginBottom: 8 }}><span>Desconto {appliedCouponCode ? `(${appliedCouponCode})` : ""}</span><span>-{money(safeDiscount)}</span></div>}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: "1px solid #eee", paddingTop: 10, marginTop: 4 }}><strong>Total</strong><strong style={{ fontSize: 22 }}>{money(total)}</strong></div>
              {hasFreeDelivery && !isPickup && <span style={{ display: "block", marginTop: 7, color: "#2e7d32", fontSize: 10 }}>Frete grátis aplicado para pedidos a partir de R$ 80.</span>}
            </div>

            <div style={{ display: "flex", gap: 5, padding: 4, background: "#f3f3f3", borderRadius: 12 }}>
              {(["pix", "cartao", "dinheiro"] as PaymentMethod[]).map((option) => (
                <button key={option} onClick={() => setMethod(option)} style={{ flex: 1, padding: 11, border: 0, borderRadius: 9, background: method === option ? "#fff" : "transparent", boxShadow: method === option ? "0 1px 4px rgba(0,0,0,.08)" : "none", fontWeight: 900, fontSize: 11, cursor: "pointer" }}>{option === "pix" ? "PIX" : option === "cartao" ? "Cartão" : "Dinheiro"}</button>
              ))}
            </div>

            {method === "pix" && (
              <div style={{ border: "1px solid #ffe082", background: "#fffdf3", borderRadius: 14, padding: 14 }}>
                <span style={{ display: "block", fontSize: 11, color: "#666" }}>Chave PIX</span>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <input readOnly value={PIX_KEY} style={fieldStyle} />
                  <button onClick={() => { void navigator.clipboard.writeText(PIX_KEY); setPixCopied(true); }} style={{ border: 0, borderRadius: 11, background: pixCopied ? "#2e7d32" : "#ffca28", color: pixCopied ? "#fff" : "#111", padding: "0 14px", fontWeight: 900, cursor: "pointer" }}>{pixCopied ? "Copiado" : "Copiar"}</button>
                </div>
              </div>
            )}

            {method === "dinheiro" && <input placeholder="Troco para quanto? Ex.: 100,00" value={troco} onChange={(event) => setTroco(event.target.value)} inputMode="decimal" style={fieldStyle} />}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
              <button onClick={() => { setErrorMessage(""); setStep(1); }} disabled={loading} style={{ border: "1px solid #ddd", borderRadius: 13, background: "#fff", padding: 15, fontWeight: 800, cursor: "pointer" }}>Voltar</button>
              <button onClick={() => void finishOrder()} disabled={loading} style={{ border: 0, borderRadius: 13, background: "#25D366", color: "#fff", padding: 15, fontWeight: 900, cursor: "pointer", opacity: loading ? 0.7 : 1 }}>{loading ? "Registrando pedido…" : "Registrar e abrir WhatsApp"}</button>
            </div>

            <span style={{ textAlign: "center", color: "#888", fontSize: 10, lineHeight: 1.45 }}>O WhatsApp só abre depois que o pedido for salvo com sucesso. Se ocorrer erro, seu carrinho permanece intacto.</span>
          </div>
        )}
      </div>
    </ModalBase>
  );
}
