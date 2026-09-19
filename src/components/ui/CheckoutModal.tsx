"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { doc, getDoc, increment, serverTimestamp, setDoc } from "firebase/firestore";
import { ModalBase } from "./ModalBase";
import { useUIStore } from "@/store/ui";
import { useCartStore } from "@/store/cart.store";
import { useAuthStore } from "@/store/auth.store";
import { useUserProfile } from "@/hooks/useUserProfile";
import { formatCEPBR, formatPhoneBR, saveUserAddresses, saveUserProfile, type SavedAddress } from "@/lib/userProfile";
import { db } from "@/lib/firebase";
import { createCustomerOrder } from "@/lib/orderRepository";
import { getEffectiveShopStatus } from "@/lib/shopStatus";
import { canPlaceImmediateTestOrder, normalizeStoreSettings } from "@/lib/storeSchedule";
import { findCustomerRewardByCode, rewardDiscount, rewardIsExpired } from "@/lib/rewards";
import { couponAvailability, couponDiscount, normalizeCoupon } from "@/lib/coupons";
import styles from "./CheckoutModal.module.css";
import { DEFAULT_COMMERCIAL_SETTINGS, freeDeliveryThreshold, getCommercialSettings, type CommercialSettings } from "@/lib/commercialSettings";

type PaymentMethod = "pix" | "cartao" | "dinheiro";
type DeliveryMode = "delivery" | "pickup";

import { getDefaultDeliveryFee, SAFE_DEFAULT_DELIVERY_FEE, type DeliveryRate } from "@/lib/deliveryRates";
import { getOrderScheduleSlots, scheduleHumanLabel, type OrderScheduleSlot } from "@/lib/orderScheduling";

const PIX_KEY = "34997178336";
const WHATSAPP_NUMBER = "5534997178336";
const DEFAULT_DELIVERY_FEE = SAFE_DEFAULT_DELIVERY_FEE;

const getTestAccess = async (email: string | null | undefined) => {
  try {
    const snapshot = await getDoc(doc(db, "settings", "loja"));
    return snapshot.exists() && canPlaceImmediateTestOrder(normalizeStoreSettings(snapshot.data()), email);
  } catch {
    return false;
  }
};

const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const normalizeText = (value: string) =>
  value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

export function CheckoutModal() {
  const { closeModal, openModal } = useUIStore();
  const { items, getCartTotal, clearCart } = useCartStore();
  const currentUser = useAuthStore((s) => s.currentUser);
  const { profile, loading: profileLoading } = useUserProfile(currentUser);
  const hydratedProfileRef = useRef<string>("");
  const customerEditingRef = useRef(false);

  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("delivery");
  const [customerName, setCustomerName] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [cep, setCep] = useState("");
  const [rua, setRua] = useState("");
  const [bairro, setBairro] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [referencia, setReferencia] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [addressPickerOpen, setAddressPickerOpen] = useState(false);
  const [addressEditorOpen, setAddressEditorOpen] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [deliveryFee, setDeliveryFee] = useState(DEFAULT_DELIVERY_FEE);
  const [deliveryStatus, setDeliveryStatus] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [troco, setTroco] = useState("");
  const [pixCopied, setPixCopied] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCouponCode, setAppliedCouponCode] = useState("");
  const [appliedRewardId, setAppliedRewardId] = useState("");
  const [discount, setDiscount] = useState(0);
  const [couponMessage, setCouponMessage] = useState("");
  const [commercialSettings, setCommercialSettings] = useState<CommercialSettings>(DEFAULT_COMMERCIAL_SETTINGS);
  const [errorMessage, setErrorMessage] = useState("");
  const [shopClosed, setShopClosed] = useState(false);
  const [scheduleSlots, setScheduleSlots] = useState<OrderScheduleSlot[]>([]);
  const [scheduledFor, setScheduledFor] = useState("");
  const [scheduleLoading, setScheduleLoading] = useState(true);

  const subtotal = getCartTotal();
  const isPickup = deliveryMode === "pickup";
  const freeThreshold = freeDeliveryThreshold(commercialSettings, bairro);
  const hasFreeDelivery = !isPickup && freeThreshold !== null && subtotal >= freeThreshold;
  const missingForFreeDelivery = freeThreshold === null ? 0 : Math.max(0, freeThreshold - subtotal);
  const finalFee = isPickup || hasFreeDelivery ? 0 : deliveryFee;
  const safeDiscount = Math.min(Math.max(0, discount), subtotal);
  const total = Math.max(0, subtotal + finalFee - safeDiscount);

  const phoneDigits = userPhone.replace(/\D/g, "");
  const addressReady = isPickup || Boolean(rua.trim() && numero.trim() && bairro.trim());
  const phoneReady = phoneDigits.length === 10 || phoneDigits.length === 11;

  const nameReady = customerName.trim().length >= 2;
  const canAdvance = nameReady && phoneReady && addressReady && items.length > 0;

  useEffect(() => { void getCommercialSettings().then(setCommercialSettings).catch(() => setCommercialSettings(DEFAULT_COMMERCIAL_SETTINGS)); }, []);
  useEffect(() => { let alive=true; void (async()=>{ try{const [status,testAccess]=await Promise.all([getEffectiveShopStatus(),getTestAccess(currentUser?.email)]);if(!alive)return;const closedForUser=!status.isOpen&&!testAccess;setShopClosed(closedForUser);if(closedForUser){const slots=await getOrderScheduleSlots();if(!alive)return;setScheduleSlots(slots);setScheduledFor(v=>v||slots[0]?.value||"")}}catch(error){console.error("Falha ao preparar agendamento",error)}finally{if(alive)setScheduleLoading(false)}})();return()=>{alive=false}}, []);

  useEffect(() => {
    if (!currentUser || profileLoading) return;
    const hydrationKey = JSON.stringify({
      uid: currentUser.uid,
      version: profile?.profileVersion ?? 0,
      name: profile?.name ?? "",
      phone: profile?.phone ?? "",
      address: profile?.address ?? null,
      addresses: profile?.addresses ?? [],
    });
    if (hydratedProfileRef.current === hydrationKey) return;
    hydratedProfileRef.current = hydrationKey;
    if (customerEditingRef.current) return;

    setCustomerName(profile?.name || currentUser.displayName || "");
    setUserPhone(profile?.phone || "");
    const saved=profile?.addresses?.find(a=>a.isDefault)||profile?.addresses?.[0]||profile?.address;
    setCep(saved?.cep||""); setRua(saved?.street||""); setNumero(saved?.number||""); setBairro(saved?.district||""); setComplemento(saved?.complement||""); setReferencia(saved?.reference||"");
    if(saved?.street||saved?.district){setSelectedAddressId(saved.id||"address-1");setManualMode(true);setAddressEditorOpen(false);if(saved.district)void calculateDeliveryFee(saved.district);}else setAddressEditorOpen(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, profile, profileLoading]);


  const selectSavedAddress=(a:SavedAddress)=>{customerEditingRef.current=true;setSelectedAddressId(a.id);setCep(a.cep);setRua(a.street);setNumero(a.number);setBairro(a.district);setComplemento(a.complement);setReferencia(a.reference);setManualMode(true);setAddressPickerOpen(false);setAddressEditorOpen(false);if(a.district)void calculateDeliveryFee(a.district);};
  const startNewCheckoutAddress=()=>{customerEditingRef.current=true;setSelectedAddressId("");setCep("");setRua("");setNumero("");setBairro("");setComplemento("");setReferencia("");setManualMode(false);setAddressPickerOpen(false);setAddressEditorOpen(true);setDeliveryStatus("");};
  const savedAddresses = profile?.addresses || [];
  const selectedSavedAddress = savedAddresses.find((address) => address.id === selectedAddressId);
  const addressLimitReached = savedAddresses.length >= 3;

  const changeCouponCode = (value: string) => {
    const next = value.toUpperCase();
    setCouponCode(next);
    if (appliedCouponCode && next.trim() !== appliedCouponCode) {
      setAppliedCouponCode("");
      setAppliedRewardId("");
      setDiscount(0);
      setCouponMessage("Cupom alterado. Valide novamente para aplicar o desconto.");
    }
  };

  const calculateDeliveryFee = async (district: string) => {
    const cleanedDistrict = normalizeText(district);
    if (!cleanedDistrict) return;

    try {
      const [snap, configuredDefaultFee] = await Promise.all([
        getDoc(doc(db, "TaxasDeEntrega", "bairros", "lista", "tabela")),
        getDefaultDeliveryFee(),
      ]);
      if (!snap.exists()) {
        setDeliveryFee(configuredDefaultFee);
        setDeliveryStatus(`Taxa padrão: ${money(configuredDefaultFee)}`);
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
        setDeliveryFee(configuredDefaultFee);
        setDeliveryStatus(`Bairro fora da tabela. Taxa padrão: ${money(configuredDefaultFee)}`);
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
    setAppliedRewardId("");
    setDiscount(0);

    if (!code) {
      setCouponMessage("Digite um cupom antes de validar.");
      return;
    }

    setLoading(true);
    try {
      const publicCoupon = await getDoc(doc(db, "Cupons", code));

      if (publicCoupon.exists()) {
        const coupon = normalizeCoupon(publicCoupon.id, publicCoupon.data());
        const availability = couponAvailability(coupon, subtotal);
        if (availability.ok) {
          const bounded = couponDiscount(coupon, subtotal);
          setCouponCode(code);
          setAppliedCouponCode(code);
          setDiscount(bounded);
          setCouponMessage(`${money(bounded)} de desconto aplicado.`);
          return;
        }
        if (availability.reason === "min-order") return setCouponMessage(`Este cupom exige pedido mínimo de ${money(coupon.minOrder)}.`);
        if (availability.reason === "not-started") return setCouponMessage("Este cupom ainda não começou.");
        if (availability.reason === "expired") return setCouponMessage("Este cupom expirou.");
        if (availability.reason === "inactive") return setCouponMessage("Este cupom está pausado.");
        if (availability.reason === "invalid") return setCouponMessage("Este cupom está configurado de forma inválida.");
      }

      if (currentUser) {
        const reward = await findCustomerRewardByCode(currentUser.uid, code);

        if (reward) {
          if (reward.used) {
            setCouponMessage("Este benefício já foi utilizado.");
            return;
          }
          if (rewardIsExpired(reward)) {
            setCouponMessage("Este benefício expirou.");
            return;
          }
          if (subtotal < reward.minOrder) {
            setCouponMessage(`Este benefício exige pedido mínimo de ${money(reward.minOrder)}.`);
            return;
          }

          const bounded = rewardDiscount(reward, subtotal);
          if (bounded > 0) {
            setCouponCode(code);
            setAppliedCouponCode(code);
            setAppliedRewardId(reward.id);
            setDiscount(bounded);
            setCouponMessage(`${money(bounded)} de benefício aplicado.`);
            return;
          }
        }
      }

      setCouponMessage("Cupom ou benefício inválido, inativo ou expirado.");
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
    if (!nameReady) {
      setStep(1);
      setErrorMessage("Informe seu nome para o pedido.");
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
      const [shopStatus, testAccess] = await Promise.all([getEffectiveShopStatus(), getTestAccess(currentUser.email)]);
      const isClosed = !shopStatus.isOpen && !testAccess;
      const selectedSchedule = isClosed ? scheduledFor : "";
      if (isClosed && !selectedSchedule) { setStep(1); throw new Error("SCHEDULE_REQUIRED"); }
      const finalAddress = isPickup
        ? "RETIRADA NO LOCAL"
        : `${rua.trim()}, ${numero.trim()} - ${bairro.trim()}${complemento.trim() ? ` (${complemento.trim()})` : ""}${referencia.trim() ? ` · Ref.: ${referencia.trim()}` : ""}`;

      const orderData = {
        userId: currentUser.uid,
        userName: customerName.trim() || currentUser.displayName || "Cliente",
        userEmail: currentUser.email,
        userPhone: userPhone.trim(),
        itens: items,
        subtotal,
        taxaEntrega: finalFee,
        desconto: safeDiscount,
        cupom: safeDiscount > 0 && appliedCouponCode ? appliedCouponCode : null,
        rewardId: appliedRewardId || null,
        total,
        metodoPagamento: method,
        trocoPara: method === "dinheiro" ? (troco.trim() || null) : null,
        endereco: finalAddress,
        tipoEntrega: deliveryMode,
        data: serverTimestamp(),
        status: isClosed ? "Agendado" : "Pendente",
        isAgendamento: isClosed,
        scheduledFor: isClosed ? selectedSchedule : null,
        scheduledLabel: isClosed ? scheduleHumanLabel(selectedSchedule) : null,
        scheduleWindowMinutes: isClosed ? 30 : null,
        sourceSystem: "dfl_site",
        orderSchemaVersion: 2,
        customerSnapshot: {
          id: currentUser.uid,
          name: customerName.trim() || currentUser.displayName || "Cliente",
          email: currentUser.email || "",
          phone: userPhone.trim(),
          phoneE164: `+55${phoneDigits}`,
        },
        deliverySnapshot: isPickup ? null : {
          cep: cep.trim(),
          street: rua.trim(),
          number: numero.trim(),
          district: bairro.trim(),
          complement: complemento.trim(),
          reference: referencia.trim(),
        },
      };

      const created = await createCustomerOrder({
        userId: currentUser.uid,
        order: orderData,
        subtotal,
        discount: safeDiscount > 0 && appliedCouponCode ? {
          code: appliedCouponCode,
          rewardId: appliedRewardId || null,
          expectedDiscount: safeDiscount,
        } : null,
      });

      try {
        await saveUserProfile(currentUser, { name: customerName, phone: userPhone, cep, street: rua, number: numero, district: bairro, complement: complemento, reference: referencia });
        if (!isPickup) {
          const list=profile?.addresses||[]; const i=list.findIndex(a=>a.id===selectedAddressId); const old=i>=0?list[i]:null;
          const next:SavedAddress={id:selectedAddressId||`address-${Date.now()}`,label:old?.label||(list.length?"Outro":"Casa"),cep:cep.trim(),street:rua.trim(),number:numero.trim(),district:bairro.trim(),complement:complemento.trim(),reference:referencia.trim(),isDefault:old?.isDefault??list.length===0};
          await saveUserAddresses(currentUser,i>=0?list.map((a,n)=>n===i?next:a):(list.length<3?[...list,next]:list));
        }
        await setDoc(doc(db, "Usuarios", currentUser.uid), {
          pedidosFeitos: increment(1),
        }, { merge: true });
      } catch (profileError) {
        console.error("Pedido salvo, mas falhou ao atualizar o perfil do cliente", profileError);
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
        `Pedido: *#${created.id.slice(-8).toUpperCase()}*`,
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
        isClosed ? `\n🕒 Agendado para *${scheduleHumanLabel(selectedSchedule)}*.\nEsse horário é uma previsão operacional; faremos o possível para atender o mais próximo dele.` : null,
      ].filter(Boolean).join("\n");

      const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
      clearCart();
      openModal("order-success", {
        orderId: created.id,
        isScheduled: isClosed,
        deliveryMode,
        total,
        whatsappUrl,
      });
    } catch (error) {
      console.error("Erro ao salvar pedido", error);
      const code = error instanceof Error ? error.message : "";
      if (code === "SCHEDULE_REQUIRED") { setErrorMessage("Escolha um horário disponível para o pedido agendado."); } else if (code.startsWith("COUPON_") || code.startsWith("REWARD_")) {
        setAppliedCouponCode("");
        setAppliedRewardId("");
        setDiscount(0);
        setCouponMessage("O cupom ou benefício mudou desde a validação. Aplique o código novamente.");
        setErrorMessage("Revise o cupom ou benefício antes de confirmar. Seu carrinho foi preservado.");
      } else {
        setErrorMessage("Não conseguimos registrar o pedido. Seu carrinho foi preservado. Tente novamente antes de enviar pelo WhatsApp.");
      }
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
            <div className={styles.profileHint} data-loaded={Boolean(profile)}><div><strong>{profile ? "Dados carregados da sua conta" : "Seus dados de entrega"}</strong><span>{profile ? "Você pode alterar aqui. Salvamos a atualização depois do pedido." : "Preencha uma vez e os próximos pedidos ficam mais rápidos."}</span></div>{profileLoading && <b>Carregando…</b>}</div>
            <label className={styles.label}>Nome para o pedido<input className={styles.input} data-invalid={Boolean(customerName && !nameReady)} placeholder="Seu nome" value={customerName} onChange={(event) => { customerEditingRef.current = true; setCustomerName(event.target.value); }} autoComplete="name" /></label>
            <label className={styles.label}>WhatsApp para contato e atualizações <span>(obrigatório)</span><input className={styles.input} data-invalid={Boolean(userPhone && !phoneReady)} placeholder="(34) 99999-9999" value={userPhone} onChange={(event) => { customerEditingRef.current = true; setUserPhone(formatPhoneBR(event.target.value)); }} inputMode="tel" autoComplete="tel" /></label>
            {deliveryMode === "delivery" ? <>
              <section className={styles.addressChoice}>
                <div className={styles.addressHeading}>
                  <span>ONDE VOCÊ QUER RECEBER?</span>
                  <strong>{rua && !addressEditorOpen ? "Vamos entregar aqui" : "Informe o endereço da entrega"}</strong>
                  <small>{rua && !addressEditorOpen ? "Confira o endereço antes de continuar." : "Salve uma vez e os próximos pedidos ficam mais rápidos."}</small>
                </div>
                {rua && !addressEditorOpen && <>
                  <div className={styles.selectedAddress}>
                    <span className={styles.locationMark} aria-hidden="true">⌂</span>
                    <div><span className={styles.addressLabelRow}><b>{selectedSavedAddress?.label || "Endereço"}</b>{selectedSavedAddress?.isDefault && <em>Padrão</em>}</span><strong>{rua}, {numero}</strong><span>{bairro}{cep ? ` · CEP ${cep}` : ""}</span>{complemento && <small>{complemento}</small>}</div>
                  </div>
                  <button className={styles.changeAddress} type="button" onClick={()=>setAddressPickerOpen(true)}><span><strong>Receber em outro endereço</strong><small>Escolha outro endereço salvo ou cadastre um novo</small></span><b aria-hidden="true">›</b></button>
                </>}
                {addressPickerOpen && <div className={styles.addressSheet} role="dialog" aria-modal="true" aria-label="Escolha um endereço">
                  <button className={styles.addressSheetBackdrop} type="button" aria-label="Fechar" onClick={()=>setAddressPickerOpen(false)} />
                  <div className={styles.addressSheetPanel}><div className={styles.sheetHandle}/><div className={styles.sheetHead}><div><strong>Escolha um endereço</strong><span>Onde você quer receber este pedido?</span></div><button type="button" onClick={()=>setAddressPickerOpen(false)} aria-label="Fechar">×</button></div>
                    <div className={styles.savedAddressList}>{savedAddresses.map(address=><button type="button" key={address.id} data-active={address.id===selectedAddressId} onClick={()=>selectSavedAddress(address)}><span className={styles.radioDot}/><span className={styles.savedAddressCopy}><span><b>{address.label}</b>{address.isDefault&&<em>Padrão</em>}</span><strong>{address.street}, {address.number}</strong><small>{address.district}{address.cep ? ` · CEP ${address.cep}` : ""}</small></span></button>)}</div>
                    {!addressLimitReached ? <button className={styles.addNewAddress} type="button" onClick={startNewCheckoutAddress}><b>+</b><span><strong>Cadastrar novo endereço</strong><small>Você pode salvar até 3 endereços</small></span></button> : <div className={styles.addressLimit}><b>3/3</b><span><strong>Limite de endereços atingido</strong><small>Você já possui 3 endereços salvos. Exclua um em Minha Conta para cadastrar outro.</small></span><button type="button" onClick={()=>openModal("account")}>Gerenciar endereços</button></div>}
                  </div>
                </div>}
                {(!rua || addressEditorOpen) && <div className={styles.addressForm}>
                  <div className={styles.newAddressIntro}><strong>{savedAddresses.length ? "Novo endereço" : "Seu primeiro endereço"}</strong><span>Busque pelo CEP para preencher mais rápido.</span></div>
                  {!manualMode&&<div className={styles.inline}><input className={styles.input} placeholder="CEP" value={cep} onChange={e=>{customerEditingRef.current=true;setCep(formatCEPBR(e.target.value))}} onBlur={()=>{if(cep.replace(/\D/g,"").length===8)void handleSearchCep();}} inputMode="numeric" autoComplete="postal-code"/><button className={styles.yellowButton} type="button" onClick={()=>void handleSearchCep()} disabled={loading}>{loading?"Buscando…":"Buscar"}</button></div>}
                  <input className={styles.input} placeholder="Rua" value={rua} onChange={e=>{customerEditingRef.current=true;setRua(e.target.value)}} readOnly={!manualMode} data-readonly={!manualMode} autoComplete="address-line1"/>
                  <div className={styles.addressGrid}><input className={styles.input} placeholder="Número" value={numero} onChange={e=>{customerEditingRef.current=true;setNumero(e.target.value)}} inputMode="numeric"/><input className={styles.input} placeholder="Bairro" value={bairro} onChange={e=>{customerEditingRef.current=true;setBairro(e.target.value)}} onBlur={()=>{if(manualMode&&bairro.trim())void calculateDeliveryFee(bairro);}} readOnly={!manualMode} data-readonly={!manualMode}/></div>
                  <input className={styles.input} placeholder="Complemento (opcional)" value={complemento} onChange={e=>{customerEditingRef.current=true;setComplemento(e.target.value)}} autoComplete="address-line2"/><input className={styles.input} placeholder="Referência (opcional)" value={referencia} onChange={e=>{customerEditingRef.current=true;setReferencia(e.target.value)}}/>{deliveryStatus&&<div className={styles.info}>{deliveryStatus}</div>}
                  <div className={styles.addressFormActions}><button className={styles.linkButton} type="button" onClick={()=>setManualMode(v=>!v)}>{manualMode?"Usar busca por CEP":"Preencher manualmente"}</button>{savedAddresses.length>0&&<button className={styles.linkButton} type="button" onClick={()=>{const fallback=savedAddresses.find(a=>a.isDefault)||savedAddresses[0];if(fallback)selectSavedAddress(fallback);}}>Cancelar</button>}</div>
                </div>}
              </section>
              {!isPickup && freeThreshold !== null && !hasFreeDelivery && <div className={styles.freightProgress}>Faltam <strong>{money(missingForFreeDelivery)}</strong> para ganhar entrega grátis.</div>}{hasFreeDelivery && <div className={styles.successHint}>Entrega grátis conquistada para este pedido.</div>}
            </> : <div className={styles.pickupCard}><strong>Retirada no balcão</strong><span>Sem taxa de entrega. O pedido ficará identificado pelo seu nome e referência.</span></div>}
            {shopClosed && <section className={styles.scheduleCard}><div><span>LOJA FECHADA AGORA</span><strong>Agende seu pedido</strong><small>Escolha um horário disponível. O horário é uma previsão e pode variar conforme o movimento.</small></div>{scheduleLoading ? <p>Carregando horários…</p> : scheduleSlots.length ? <select value={scheduledFor} onChange={e=>setScheduledFor(e.target.value)}>{scheduleSlots.map(slot=><option key={slot.value} value={slot.value} disabled={slot.disabled}>{slot.label}</option>)}</select> : <p>Nenhum horário disponível nos próximos dias.</p>}</section>}
            <button className={styles.primary} type="button" onClick={() => { setErrorMessage(""); if (canAdvance && (!shopClosed || Boolean(scheduledFor))) setStep(2); else setErrorMessage(!nameReady ? "Informe seu nome para o pedido." : !phoneReady ? "Informe um WhatsApp válido com DDD." : !addressReady ? "Complete o endereço para continuar." : "Escolha um horário disponível para o agendamento."); }}>Continuar</button>
          </div>
        ) : (
          <div className={styles.stack}>
            <section className={styles.receiveCard}><div><strong>{customerName || (isPickup ? "Retirada no balcão" : "Entrega no endereço")}</strong><span>{isPickup ? "Retirada no balcão · sem taxa de entrega" : `${rua}, ${numero} - ${bairro}${complemento ? ` · ${complemento}` : ""}${referencia ? ` · Ref.: ${referencia}` : ""}`}</span><small>{userPhone}</small></div><button type="button" onClick={() => setStep(1)}>Editar</button></section>
            <section className={styles.card}><div className={styles.cardTitle}><div><strong>Cupom ou benefício</strong><span>Você também pode usar aqui um código liberado pela fidelidade.</span></div></div><div className={styles.inline}><input className={styles.input} placeholder="Código do cupom" value={couponCode} onChange={(event) => changeCouponCode(event.target.value)} autoCapitalize="characters"/><button className={styles.yellowButton} type="button" onClick={() => void applyCoupon()} disabled={loading || !couponCode.trim()}>Aplicar</button></div>{couponMessage && <span className={safeDiscount > 0 ? styles.couponOk : styles.couponError} role={safeDiscount > 0 ? "status" : "alert"}>{couponMessage}</span>}</section>
            <section className={styles.totalCard}><div><span>Subtotal</span><b>{money(subtotal)}</b></div><div><span>Entrega</span><b data-free={finalFee === 0}>{finalFee === 0 ? "Grátis" : money(finalFee)}</b></div>{safeDiscount > 0 && <div className={styles.discount}><span>Desconto {appliedCouponCode ? `(${appliedCouponCode})` : ""}</span><b>-{money(safeDiscount)}</b></div>}<div className={styles.total}><strong>Total</strong><strong>{money(total)}</strong></div>{hasFreeDelivery && !isPickup && <small>Entrega grátis aplicada conforme a promoção vigente.</small>}</section>
            <section><div className={styles.sectionLabel}>Como você quer pagar?</div><div className={styles.paymentTabs}>{(["pix", "cartao", "dinheiro"] as PaymentMethod[]).map((option) => <button type="button" key={option} data-active={method === option} onClick={() => setMethod(option)}>{option === "pix" ? "PIX" : option === "cartao" ? "Cartão" : "Dinheiro"}</button>)}</div></section>
            {method === "pix" && <div className={styles.pixCard}><div><strong>Pagamento via PIX</strong><span>Copie a chave abaixo. O pedido é registrado antes de qualquer envio pelo WhatsApp.</span></div><div className={styles.inline}><input className={styles.input} readOnly value={PIX_KEY}/><button className={styles.yellowButton} type="button" onClick={() => { void navigator.clipboard.writeText(PIX_KEY); setPixCopied(true); }}>{pixCopied ? "Copiado" : "Copiar"}</button></div></div>}
            {method === "dinheiro" && <label className={styles.label}>Troco para quanto? <span>(opcional)</span><input className={styles.input} placeholder="Ex.: 100,00" value={troco} onChange={(event) => setTroco(event.target.value)} inputMode="decimal"/></label>}
            <div className={styles.actions}><button className={styles.secondary} type="button" onClick={() => { setErrorMessage(""); setStep(1); }} disabled={loading}>Voltar</button><button className={styles.primary} type="button" onClick={() => void finishOrder()} disabled={loading}>{loading ? "Registrando pedido…" : `Confirmar pedido · ${money(total)}`}</button></div>
            <p className={styles.trust}>Seu WhatsApp fica salvo para as atualizações do pedido. Você também acompanha o andamento pelo site.</p>
          </div>
        )}
      </div>
    </ModalBase>
  );
}
