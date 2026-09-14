"use client";

import { useMemo, useState } from "react";
import { addDoc, collection, doc, getDoc, increment, serverTimestamp, setDoc } from "firebase/firestore";
import { ModalBase } from "./ModalBase";
import { useUIStore } from "@/store/ui";
import { useCartStore } from "@/store/cart.store";
import { useAuthStore } from "@/store/auth.store";
import { db } from "@/lib/firebase";
import { getEffectiveShopStatus } from "@/lib/shopStatus";
import styles from "./CheckoutModal.module.css";

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
  const { closeModal, openModal } = useUIStore();
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

      const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
      clearCart();
      openModal("order-success", {
        orderId: orderRef.id,
        isScheduled: isClosed,
        deliveryMode,
        total,
        whatsappUrl,
      });
    } catch (error) {
      console.error("Erro ao salvar pedido", error);
      setErrorMessage("Não conseguimos registrar o pedido. Seu carrinho foi preservado. Tente novamente antes de enviar pelo WhatsApp.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalBase title={step === 1 ? "Como você quer receber?" : "Confirme seu pedido"} onClose={closeModal}>
      <div className={styles.body}>
        <div className={styles.steps} aria-label={`Etapa ${step} de 2`}>
          <i data-active="true" /><i data-active={step === 2} />
        </div>
        <div className={styles.stepCaption}><strong>{step === 1 ? "Entrega" : "Pagamento"}</strong><span>{step}/2</span></div>
        {errorMessage && <div className={styles.error}>{errorMessage}</div>}

        {step === 1 ? (
          <div className={styles.stack}>
            <div className={styles.modeTabs}>
              <button type="button" data-active={deliveryMode === "delivery"} onClick={() => setDeliveryMode("delivery")}><b>Entrega</b><small>Receber no endereço</small></button>
              <button type="button" data-active={deliveryMode === "pickup"} onClick={() => setDeliveryMode("pickup")}><b>Retirada</b><small>Buscar no balcão</small></button>
            </div>
            <label className={styles.label}>WhatsApp com DDD<input className={styles.input} data-invalid={Boolean(userPhone && !phoneReady)} placeholder="(34) 99999-9999" value={userPhone} onChange={(event) => setUserPhone(formatPhone(event.target.value))} inputMode="tel" autoComplete="tel" /></label>
            {deliveryMode === "delivery" ? <>
              <section className={styles.card}>
                <div className={styles.cardTitle}><div><strong>Endereço de entrega</strong><span>Busque pelo CEP ou preencha manualmente.</span></div></div>
                {!manualMode && <div className={styles.inline}><input className={styles.input} placeholder="CEP" value={cep} onChange={(event) => setCep(formatCEP(event.target.value))} onBlur={() => { if (cep.replace(/\D/g, "").length === 8) void handleSearchCep(); }} inputMode="numeric" autoComplete="postal-code"/><button className={styles.yellowButton} type="button" onClick={() => void handleSearchCep()} disabled={loading}>{loading ? "Buscando…" : "Buscar"}</button></div>}
                <input className={styles.input} placeholder="Rua" value={rua} onChange={(event) => setRua(event.target.value)} readOnly={!manualMode} data-readonly={!manualMode} autoComplete="address-line1"/>
                <div className={styles.addressGrid}><input className={styles.input} placeholder="Número" value={numero} onChange={(event) => setNumero(event.target.value)} inputMode="numeric"/><input className={styles.input} placeholder="Bairro" value={bairro} onChange={(event) => setBairro(event.target.value)} onBlur={() => { if (manualMode && bairro.trim()) void calculateDeliveryFee(bairro); }} readOnly={!manualMode} data-readonly={!manualMode}/></div>
                <input className={styles.input} placeholder="Complemento (opcional)" value={complemento} onChange={(event) => setComplemento(event.target.value)} autoComplete="address-line2"/>
                {deliveryStatus && <div className={styles.info}>{deliveryStatus}</div>}
                <button className={styles.linkButton} type="button" onClick={() => setManualMode((value) => !value)}>{manualMode ? "Usar busca por CEP" : "Preencher endereço manualmente"}</button>
              </section>
              {hasFreeDelivery && <div className={styles.successHint}>Seu pedido já atingiu o valor de frete grátis.</div>}
            </> : <div className={styles.pickupCard}><strong>Retirada no balcão</strong><span>Sem taxa de entrega. O pedido ficará identificado pelo seu nome e referência.</span></div>}
            <button className={styles.primary} type="button" onClick={() => { setErrorMessage(""); if (canAdvance) setStep(2); else setErrorMessage(!phoneReady ? "Informe um WhatsApp válido com DDD." : "Complete o endereço para continuar."); }}>Continuar</button>
          </div>
        ) : (
          <div className={styles.stack}>
            <section className={styles.receiveCard}><div><strong>{isPickup ? "Retirada no balcão" : "Entrega no endereço"}</strong><span>{isPickup ? "Sem taxa de entrega" : `${rua}, ${numero} - ${bairro}${complemento ? ` · ${complemento}` : ""}`}</span><small>{userPhone}</small></div><button type="button" onClick={() => setStep(1)}>Editar</button></section>
            <section className={styles.card}><div className={styles.cardTitle}><div><strong>Cupom</strong><span>Use apenas se você tiver um código válido.</span></div></div><div className={styles.inline}><input className={styles.input} placeholder="Código do cupom" value={couponCode} onChange={(event) => changeCouponCode(event.target.value)} autoCapitalize="characters"/><button className={styles.yellowButton} type="button" onClick={() => void applyCoupon()} disabled={loading || !couponCode.trim()}>Aplicar</button></div>{couponMessage && <span className={safeDiscount > 0 ? styles.couponOk : styles.muted}>{couponMessage}</span>}</section>
            <section className={styles.totalCard}><div><span>Subtotal</span><b>{money(subtotal)}</b></div><div><span>Entrega</span><b data-free={finalFee === 0}>{finalFee === 0 ? "Grátis" : money(finalFee)}</b></div>{safeDiscount > 0 && <div className={styles.discount}><span>Desconto {appliedCouponCode ? `(${appliedCouponCode})` : ""}</span><b>-{money(safeDiscount)}</b></div>}<div className={styles.total}><strong>Total</strong><strong>{money(total)}</strong></div>{hasFreeDelivery && !isPickup && <small>Frete grátis aplicado para pedidos a partir de R$ 80.</small>}</section>
            <section><div className={styles.sectionLabel}>Como você quer pagar?</div><div className={styles.paymentTabs}>{(["pix", "cartao", "dinheiro"] as PaymentMethod[]).map((option) => <button type="button" key={option} data-active={method === option} onClick={() => setMethod(option)}>{option === "pix" ? "PIX" : option === "cartao" ? "Cartão" : "Dinheiro"}</button>)}</div></section>
            {method === "pix" && <div className={styles.pixCard}><div><strong>Pagamento via PIX</strong><span>Copie a chave abaixo. O pedido é registrado antes de qualquer envio pelo WhatsApp.</span></div><div className={styles.inline}><input className={styles.input} readOnly value={PIX_KEY}/><button className={styles.yellowButton} type="button" onClick={() => { void navigator.clipboard.writeText(PIX_KEY); setPixCopied(true); }}>{pixCopied ? "Copiado" : "Copiar"}</button></div></div>}
            {method === "dinheiro" && <label className={styles.label}>Troco para quanto? <span>(opcional)</span><input className={styles.input} placeholder="Ex.: 100,00" value={troco} onChange={(event) => setTroco(event.target.value)} inputMode="decimal"/></label>}
            <div className={styles.actions}><button className={styles.secondary} type="button" onClick={() => { setErrorMessage(""); setStep(1); }} disabled={loading}>Voltar</button><button className={styles.primary} type="button" onClick={() => void finishOrder()} disabled={loading}>{loading ? "Registrando pedido…" : `Confirmar pedido · ${money(total)}`}</button></div>
            <p className={styles.trust}>Seu pedido entra primeiro no sistema. Depois você pode acompanhar o status pelo site e, se quiser, avisar a loja pelo WhatsApp.</p>
          </div>
        )}
      </div>
    </ModalBase>
  );
}
