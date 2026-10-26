"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { readGuestIdentity, saveGuestIdentity, rememberGuestOrder } from "@/lib/guestContinuity";
import { doc, getDoc, serverTimestamp } from "firebase/firestore";
import { ModalBase } from "./ModalBase";
import { useUIStore } from "@/store/ui";
import { useCartStore } from "@/store/cart.store";
import { useAuthStore } from "@/store/auth.store";
import { useUserProfile } from "@/hooks/useUserProfile";
import { formatCEPBR, formatPhoneBR, saveUserAddresses, saveUserProfile, type SavedAddress } from "@/lib/userProfile";
import { inspectDistrict, matchDeliveryRate, suggestDistricts } from "@/lib/addressIntelligence";
import { recoverSavedDistrictForExactAddress } from "@/lib/addressDraftRepair";
import { db } from "@/lib/firebase";
import { createCustomerOrder } from "@/lib/orderRepository";
import { getCheckoutStoreAccess } from "@/lib/shopStatus";

import { findCustomerRewardByCode, rewardDiscount, rewardIsExpired } from "@/lib/rewards";
import { couponAvailability, couponDiscount, normalizeCoupon } from "@/lib/coupons";
import styles from "./CheckoutModal.module.css";
import { canOfferManualOrderFallback } from "@/lib/checkoutFallbackSafety";
import { orderOutcomeNeedsReview } from "@/lib/orderOutcomeRecovery";
import { resolveCheckoutAttempt } from "@/lib/checkoutAttemptResolver";
import { DEFAULT_COMMERCIAL_SETTINGS, freeDeliveryThreshold, getCommercialSettings, type CommercialSettings } from "@/lib/commercialSettings";
import { BUSINESS_CONTACT, businessWhatsAppUrl } from "@/lib/businessContact";
import { buildOrderWhatsAppMessage } from "@/lib/orderWhatsApp";
import { haptic } from "@/lib/haptics";
import {
  clearCheckoutDraft,
  migrateGuestCheckoutDraft,
  readCheckoutDraft,
  saveCheckoutDraft,
  checkoutDraftAgeMinutes,
} from "@/lib/checkoutDraft";

type PaymentMethod = "pix" | "cartao" | "dinheiro";
type DeliveryMode = "delivery" | "pickup";

import { getDefaultDeliveryFee, SAFE_DEFAULT_DELIVERY_FEE, type DeliveryRate } from "@/lib/deliveryRates";
import { getOrderScheduleSlots, scheduleHumanLabel, type OrderScheduleSlot } from "@/lib/orderScheduling";

const DEFAULT_DELIVERY_FEE = SAFE_DEFAULT_DELIVERY_FEE;
const DELIVERY_CACHE_TTL = 5 * 60_000;
let deliveryTableCache: { at: number; list: DeliveryRate[]; defaultFee: number } | null = null;
let deliveryTableInflight: Promise<{ list: DeliveryRate[]; defaultFee: number }> | null = null;

async function getDeliveryTableCached() {
  if (deliveryTableCache && Date.now() - deliveryTableCache.at < DELIVERY_CACHE_TTL) return deliveryTableCache;
  if (deliveryTableInflight) return deliveryTableInflight;
  deliveryTableInflight = Promise.all([
    getDoc(doc(db, "TaxasDeEntrega", "bairros", "lista", "tabela")),
    getDefaultDeliveryFee(),
  ]).then(([snap, defaultFee]) => {
    const list = snap.exists() && Array.isArray(snap.data()?.data) ? snap.data().data as DeliveryRate[] : [];
    deliveryTableCache = { at: Date.now(), list, defaultFee };
    return deliveryTableCache;
  }).finally(() => { deliveryTableInflight = null; });
  return deliveryTableInflight;
}

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
  const submittingRef = useRef(false);
  const orderAttemptRef = useRef<string>("");
  const couponRequestRef = useRef(0);
  const statusRefreshBusyRef = useRef(false);
  const couponCodeRef = useRef("");
  const numberInputRef = useRef<HTMLInputElement>(null);
  const districtInputRef = useRef<HTMLInputElement>(null);
  const districtManuallyEditedRef = useRef(false);
  const scheduleSectionRef = useRef<HTMLElement>(null);
  const cepLookupRef = useRef("");
  const cepRequestRef = useRef(0);

  const orderAttemptStorageKey = currentUser?.uid
    ? `dfl:pending-order:${currentUser.uid}`
    : "";

  const rememberOrderAttempt = (value: string) => {
    orderAttemptRef.current = value;

    if (
      orderAttemptStorageKey &&
      typeof window !== "undefined"
    ) {
      try {
        window.sessionStorage.setItem(
          orderAttemptStorageKey,
          value,
        );
      } catch {}
    }
  };

  const clearOrderAttempt = () => {
    orderAttemptRef.current = "";

    if (
      orderAttemptStorageKey &&
      typeof window !== "undefined"
    ) {
      try {
        window.sessionStorage.removeItem(
          orderAttemptStorageKey,
        );
      } catch {}
    }
  };

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
  const [orderObservation, setOrderObservation] = useState("");
  const [pixCopied, setPixCopied] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCouponCode, setAppliedCouponCode] = useState("");
  const [appliedRewardId, setAppliedRewardId] = useState("");
  const [discount, setDiscount] = useState(0);
  const [couponMessage, setCouponMessage] = useState("");
  const [couponChecking, setCouponChecking] = useState(false);
  const [commercialSettings, setCommercialSettings] = useState<CommercialSettings>(DEFAULT_COMMERCIAL_SETTINGS);
  const [errorMessage, setErrorMessage] = useState("");
  const [fallbackWhatsAppUrl, setFallbackWhatsAppUrl] = useState("");
  const [orderOutcomeUncertain, setOrderOutcomeUncertain] = useState(false);
  const [shopClosed, setShopClosed] = useState(false);
  const [scheduleSlots, setScheduleSlots] = useState<OrderScheduleSlot[]>([]);
  const [scheduledFor, setScheduledFor] = useState("");
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleError, setScheduleError] = useState("");
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [draftRecovered, setDraftRecovered] = useState(false);
  const [draftRecoveredAge, setDraftRecoveredAge] = useState<number | null>(null);
  const draftHydratedRef = useRef(false);

  const subtotal = getCartTotal();
  const isPickup = deliveryMode === "pickup";
  const freeThreshold = freeDeliveryThreshold(commercialSettings, bairro);
  const hasFreeDelivery = !isPickup && freeThreshold !== null && subtotal >= freeThreshold;
  const missingForFreeDelivery = freeThreshold === null ? 0 : Math.max(0, freeThreshold - subtotal);
  const finalFee = isPickup || hasFreeDelivery ? 0 : deliveryFee;
  const safeDiscount = Math.min(Math.max(0, discount), subtotal);
  const total = Math.max(0, subtotal + finalFee - safeDiscount);

  const scheduleGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        date: string;
        label: string;
        slots: OrderScheduleSlot[];
      }
    >();

    for (const slot of scheduleSlots) {
      const current = groups.get(slot.date);
      const label =
        slot.label.split(" · ")[0] ||
        slot.date;

      if (current) {
        current.slots.push(slot);
      } else {
        groups.set(slot.date, {
          date: slot.date,
          label,
          slots: [slot],
        });
      }
    }

    return [...groups.values()];
  }, [scheduleSlots]);

  const phoneDigits = userPhone.replace(/\D/g, "");
  const configuredDistricts = deliveryTableCache?.list.map(item => String(item.nome ?? "")) ?? [];
  const districtInspection = inspectDistrict(bairro, configuredDistricts);
  const districtSuggestions = suggestDistricts(bairro, configuredDistricts);
  const addressReady = isPickup || Boolean(cep.replace(/\D/g, "").length === 8 && rua.trim().length >= 4 && numero.trim() && districtInspection.valid);
  const phoneReady = phoneDigits.length === 10 || phoneDigits.length === 11;

  const nameReady = customerName.trim().length >= 2;
  const canAdvance = nameReady && phoneReady && addressReady && items.length > 0;

  useEffect(() => {
    if (currentUser || !nameReady || !phoneReady) return;
    const timer = window.setTimeout(() => {
      const completeAddress = deliveryMode === "delivery" && addressReady;
      saveGuestIdentity({
        name: customerName.trim(), phone: userPhone.trim(), lastDeliveryMode: deliveryMode, paymentPreference: method,
        ...(completeAddress ? { cep: cep.trim(), street: rua.trim(), number: numero.trim(), district: bairro.trim(), complement: complemento.trim(), reference: referencia.trim() } : {}),
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [currentUser, nameReady, phoneReady, addressReady, customerName, userPhone, deliveryMode, method, cep, rua, numero, bairro, complemento, referencia]);

  useEffect(() => { void getCommercialSettings().then(setCommercialSettings).catch(() => setCommercialSettings(DEFAULT_COMMERCIAL_SETTINGS)); }, []);
  useEffect(() => {
    if (draftHydratedRef.current) return;

    if (currentUser?.uid) {
      migrateGuestCheckoutDraft(currentUser.uid);
    }

    const draft = readCheckoutDraft(currentUser?.uid || null);
    if (!currentUser) {
      const local = readGuestIdentity();
      if (local) {
        setCustomerName(local.name || ""); setUserPhone(local.phone || "");
        setDeliveryMode(local.lastDeliveryMode || "delivery"); if (local.paymentPreference) setMethod(local.paymentPreference);
        if (local.street && local.number && local.district) {
          setCep(local.cep || ""); setRua(local.street); setNumero(local.number); setBairro(local.district);
          setComplemento(local.complement || ""); setReferencia(local.reference || ""); setManualMode(true); setAddressEditorOpen(!inspectDistrict(local.district).valid);
        }
      }
    }
    draftHydratedRef.current = true;

    if (!draft || items.length === 0) return;

    customerEditingRef.current = true;

    setStep(draft.step === 2 && (draft.deliveryMode === "pickup" || inspectDistrict(draft.bairro).valid) ? 2 : 1);
    setDeliveryMode(draft.deliveryMode);
    setCustomerName(draft.customerName || "");
    setUserPhone(draft.userPhone || "");
    setCep(draft.cep || "");
    setRua(draft.rua || "");
    setBairro(draft.bairro || "");
    setNumero(draft.numero || "");
    setComplemento(draft.complemento || "");
    setReferencia(draft.referencia || "");
    setMethod(draft.method);
    setTroco(draft.troco || "");
    setOrderObservation(draft.orderObservation || "");
    const recoveredCoupon = (draft.couponCode || "").toUpperCase();
    couponCodeRef.current = recoveredCoupon;
    setCouponCode(recoveredCoupon);
    setScheduledFor(draft.scheduledFor || "");

    if (draft.rua || draft.bairro) {
      setManualMode(true);
      setAddressEditorOpen(!inspectDistrict(draft.bairro).valid);
    }

    if (draft.bairro) {
      void calculateDeliveryFee(draft.bairro);
    }

    setDraftRecoveredAge(checkoutDraftAgeMinutes(draft));
    setDraftRecovered(true);
  // O draft deve ser hidratado uma única vez por abertura.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!draftHydratedRef.current || items.length === 0) return;

    const timer = window.setTimeout(() => {
      saveCheckoutDraft(currentUser?.uid || null, {
        step,
        deliveryMode,
        customerName,
        userPhone,
        cep,
        rua,
        bairro,
        numero,
        complemento,
        referencia,
        method,
        troco,
        orderObservation,
        couponCode,
        scheduledFor,
      });
    }, 180);

    return () => window.clearTimeout(timer);
  }, [
    currentUser?.uid,
    items.length,
    step,
    deliveryMode,
    customerName,
    userPhone,
    cep,
    rua,
    bairro,
    numero,
    complemento,
    referencia,
    method,
    troco,
    orderObservation,
    couponCode,
    scheduledFor,
  ]);

  useEffect(() => {
    if (
      !orderAttemptStorageKey ||
      typeof window === "undefined"
    ) {
      return;
    }

    try {
      const pending =
        window.sessionStorage.getItem(
          orderAttemptStorageKey,
        );

      if (
        pending &&
        /^[A-Za-z0-9_-]{16,80}$/.test(pending)
      ) {
        orderAttemptRef.current = pending;
      }
    } catch {}
  }, [orderAttemptStorageKey]);

  useEffect(()=>{
    const online=()=>setIsOnline(true), offline=()=>setIsOnline(false);
    window.addEventListener("online",online); window.addEventListener("offline",offline);
    return()=>{window.removeEventListener("online",online);window.removeEventListener("offline",offline);};
  },[]);
  useEffect(() => {
    let alive = true;

    setScheduleLoading(true);
    setScheduleError("");

    void (async () => {
      try {
        const {
          status,
          testAccess,
        } =
          await getCheckoutStoreAccess(
            currentUser?.email,
          );

        if (!alive) return;

        const closedForUser =
          !status.isOpen &&
          !testAccess;

        setShopClosed(
          closedForUser,
        );

        if (closedForUser) {
          const slots =
            await getOrderScheduleSlots();

          if (!alive) return;

          setScheduleSlots(slots);

          // V56.1: disponibilidade não é consentimento. Nunca escolha um horário pelo cliente.
          setScheduledFor((current) =>
            slots.some((slot) => slot.value === current && !slot.disabled) ? current : "",
          );
        } else {
          setScheduleSlots([]);
          setScheduledFor("");
        }
      } catch (error) {
        console.error(
          "Falha ao preparar agendamento",
          error,
        );
        if (alive) {
          setScheduleSlots([]);
          setScheduledFor("");
          setScheduleError(
            "Não foi possível consultar a agenda agora. Tente novamente em instantes.",
          );
        }
      } finally {
        if (alive) {
          setScheduleLoading(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [currentUser?.email]);

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
    if (customerEditingRef.current) {
      // Um rascunho antigo nao pode impedir a recuperacao do bairro do MESMO endereco.
      // Nunca recuperar se o cliente ja editou manualmente o campo.
      const known = profile?.addresses?.find(a => a.isDefault) || profile?.addresses?.[0] || profile?.address;
      const recovered = known && !districtManuallyEditedRef.current
        ? recoverSavedDistrictForExactAddress(
            { street: rua, number: numero, cep, district: bairro }, known,
          )
        : null;
      if (recovered && inspectDistrict(recovered, configuredDistricts).valid) {
        setBairro(recovered);
        setManualMode(true);
        setAddressEditorOpen(false);
        void calculateDeliveryFee(recovered);
      }
      return;
    }

    setCustomerName(profile?.name || currentUser?.displayName || "");
    setUserPhone(profile?.phone || "");
    const saved=profile?.addresses?.find(a=>a.isDefault)||profile?.addresses?.[0]||profile?.address;
    setCep(saved?.cep||""); setRua(saved?.street||""); setNumero(saved?.number||""); setBairro(saved?.district||""); setComplemento(saved?.complement||""); setReferencia(saved?.reference||"");
    if(saved?.street||saved?.district){setSelectedAddressId(saved.id||"address-1");setManualMode(true);setAddressEditorOpen(!inspectDistrict(saved.district).valid);if(saved.district && inspectDistrict(saved.district).valid)void calculateDeliveryFee(saved.district);}else setAddressEditorOpen(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, profile, profileLoading]);


  const selectSavedAddress=(a:SavedAddress)=>{customerEditingRef.current=true;setSelectedAddressId(a.id);setCep(a.cep);setRua(a.street);setNumero(a.number);setBairro(a.district);setComplemento(a.complement);setReferencia(a.reference);setManualMode(true);setAddressPickerOpen(false);setAddressEditorOpen(!inspectDistrict(a.district).valid);if(a.district && inspectDistrict(a.district).valid)void calculateDeliveryFee(a.district);};
  const startNewCheckoutAddress=()=>{customerEditingRef.current=true;setSelectedAddressId("");setCep("");setRua("");setNumero("");setBairro("");setComplemento("");setReferencia("");setManualMode(false);setAddressPickerOpen(false);setAddressEditorOpen(true);setDeliveryStatus("");};
  const savedAddresses = profile?.addresses || [];
  const selectedSavedAddress = savedAddresses.find((address) => address.id === selectedAddressId);
  const addressLimitReached = savedAddresses.length >= 3;

  // V60.3: checagem leve, apenas com o checkout visível; sem listener Firestore.
  // O cache de 20 segundos do shopStatus limita leituras entre verificações.
  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      if (!alive || document.visibilityState !== "visible" || statusRefreshBusyRef.current || submittingRef.current) return;
      statusRefreshBusyRef.current = true;
      try {
        const { status, testAccess } = await getCheckoutStoreAccess(currentUser?.email);
        if (!alive) return;
        const closed = !status.isOpen && !testAccess;
        setShopClosed(closed);
        if (closed) {
          const slots = await getOrderScheduleSlots();
          if (!alive) return;
          setScheduleSlots(slots);
          setScheduledFor(previous => slots.some(slot => slot.value === previous && !slot.disabled) ? previous : "");
          setScheduleError("");
        } else {
          setScheduleSlots([]);
          setScheduledFor("");
          setScheduleError("");
        }
      } catch {
        // Falha de consulta não equivale a loja aberta.
        if (alive) setScheduleError("Não foi possível atualizar a disponibilidade. Confirme novamente antes de pedir.");
      } finally {
        statusRefreshBusyRef.current = false;
      }
    };
    const onFocus = () => { void refresh(); };
    const timer = window.setInterval(() => { void refresh(); }, 60_000);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [currentUser?.email]);

  const changeCouponCode = (value: string) => {
    const next = value.toUpperCase().slice(0, 32);
    couponCodeRef.current = next;
    couponRequestRef.current += 1;
    setCouponChecking(false);
    setCouponCode(next);
    if (appliedCouponCode && next.trim() !== appliedCouponCode) {
      setAppliedCouponCode("");
      setAppliedRewardId("");
      setDiscount(0);
      setCouponMessage("Cupom alterado. Valide novamente para aplicar o desconto.");
    }
  };

  const calculateDeliveryFee = async (district: string) => {
    if (!inspectDistrict(district).valid) {
      setDeliveryStatus("Bairro incompleto. Selecione a sugestão ou informe o nome completo.");
      return;
    }

    try {
      const { list, defaultFee: configuredDefaultFee } = await getDeliveryTableCached();
      if (!list.length) {
        setDeliveryFee(configuredDefaultFee);
        setDeliveryStatus(`Taxa padrão: ${money(configuredDefaultFee)}`);
        return;
      }
      const found = matchDeliveryRate(district, list);

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

    const requestId = ++cepRequestRef.current;
    cepLookupRef.current = digits;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 8000);
    setLoading(true);
    setErrorMessage("");
    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { signal: controller.signal });
      if (!response.ok) throw new Error(`ViaCEP respondeu ${response.status}`);
      const data = await response.json();
      if (requestId !== cepRequestRef.current) return; // resposta antiga não altera novo endereço
      if (data.erro) {
        setManualMode(true);
        setDeliveryStatus("CEP não encontrado. Preencha o endereço manualmente.");
        return;
      }
      const city = normalizeText(typeof data.localidade === "string" ? data.localidade : "");
      const uf = String(data.uf || "").toUpperCase();
      if (city !== "patos de minas" || uf !== "MG") {
        setRua(""); setBairro(""); setNumero(""); setManualMode(false);
        setDeliveryStatus("Este CEP fica fora da nossa área de entrega em Patos de Minas.");
        return;
      }
      const nextStreet = typeof data.logradouro === "string" ? data.logradouro : "";
      const nextDistrict = typeof data.bairro === "string" ? data.bairro : "";
      setRua(nextStreet);
      setBairro(nextDistrict);
      const districtVerified = inspectDistrict(nextDistrict).valid;
      setManualMode(!nextStreet || !districtVerified);
      setDeliveryStatus(districtVerified ? "Endereço encontrado. Confira o bairro." : "CEP localizado. Complete ou confirme o nome do bairro antes de continuar.");
      if (districtVerified) await calculateDeliveryFee(nextDistrict);
      window.setTimeout(() => { numberInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); numberInputRef.current?.focus(); }, 80);
    } catch (error) {
      if (requestId !== cepRequestRef.current) return;
      console.error("Erro ao consultar CEP", error);
      cepLookupRef.current = "";
      setManualMode(true);
      setDeliveryStatus(controller.signal.aborted
        ? "A consulta do CEP demorou demais. Confira a conexão ou preencha manualmente."
        : "Não foi possível consultar o CEP. Tente novamente ou preencha manualmente.");
    } finally {
      window.clearTimeout(timer);
      if (requestId === cepRequestRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (manualMode || addressEditorOpen === false) return;
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8 || cepLookupRef.current === digits) return;
    cepLookupRef.current = digits;
    void handleSearchCep();
  }, [cep, manualMode, addressEditorOpen]);

  const focusCheckoutIssue = (kind: "address" | "schedule" | "district") => {
    window.setTimeout(() => {
      const target = kind === "schedule" ? scheduleSectionRef.current : kind === "district" ? districtInputRef.current : numberInputRef.current;
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (kind === "address") numberInputRef.current?.focus();
      if (kind === "district") districtInputRef.current?.focus();
    }, 60);
  };

  const applyCoupon = async () => {
    if (couponChecking || submittingRef.current) return;
    const code = couponCodeRef.current.trim().toUpperCase() || couponCode.trim().toUpperCase();
    const requestId = ++couponRequestRef.current;
    const stillCurrent = () => requestId === couponRequestRef.current && couponCodeRef.current.trim().toUpperCase() === code;
    setCouponMessage("");
    setAppliedCouponCode("");
    setAppliedRewardId("");
    setDiscount(0);
    if (!code) {
      setCouponMessage("Digite um cupom antes de validar.");
      return;
    }
    if (!/^[A-Z0-9_-]{1,32}$/.test(code)) {
      setCouponMessage("Código inválido. Use letras, números, hífen ou underline, sem espaços.");
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setCouponMessage("Sem conexão. Reconecte para consultar este cupom.");
      return;
    }
    setCouponChecking(true);
    const couponTimeout = async <T,>(request: Promise<T>): Promise<T> => {
      let timer: number | undefined;
      try {
        return await Promise.race([
          request,
          new Promise<T>((_, reject) => {
            timer = window.setTimeout(() => reject(new Error("COUPON_CHECK_TIMEOUT")), 8000);
          }),
        ]);
      } finally {
        if (timer !== undefined) window.clearTimeout(timer);
      }
    };
    try {
      const publicCoupon = await couponTimeout(getDoc(doc(db, "Cupons", code)));
      if (!stillCurrent()) return;
      if (publicCoupon.exists()) {
        const coupon = normalizeCoupon(publicCoupon.id, publicCoupon.data());
        const availability = couponAvailability(coupon, subtotal);
        if (availability.ok) {
          const bounded = couponDiscount(coupon, subtotal);
          if (bounded > 0) {
            setCouponCode(code);
            setAppliedCouponCode(code);
            setDiscount(bounded);
            setCouponMessage(`${money(bounded)} de desconto aplicado.`);
            return;
          }
        }
        if (availability.reason === "min-order") return setCouponMessage(`Este cupom exige pedido mínimo de ${money(coupon.minOrder)}.`);
        if (availability.reason === "not-started") return setCouponMessage("Este cupom ainda não começou.");
        if (availability.reason === "expired") return setCouponMessage("Este cupom expirou.");
        if (availability.reason === "inactive") return setCouponMessage("Este cupom está pausado.");
        if (availability.reason === "invalid") return setCouponMessage("Este cupom está configurado de forma inválida.");
      }
      if (currentUser) {
        const reward = await couponTimeout(findCustomerRewardByCode(currentUser.uid, code));
        if (!stillCurrent()) return;
        if (reward) {
          if (reward.used) return setCouponMessage("Este benefício já foi utilizado.");
          if (rewardIsExpired(reward)) return setCouponMessage("Este benefício expirou.");
          if (subtotal < reward.minOrder) return setCouponMessage(`Este benefício exige pedido mínimo de ${money(reward.minOrder)}.`);
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
      setCouponMessage(publicCoupon.exists()
        ? "Este cupom não oferece desconto para este pedido."
        : currentUser
          ? "Código não encontrado. Confira as letras e números e tente novamente."
          : "Cupom não encontrado. Benefícios de fidelidade exigem entrar com sua conta.");
    } catch (error) {
      console.error("Erro ao validar cupom", error);
      if (stillCurrent()) setCouponMessage(error instanceof Error && error.message === "COUPON_CHECK_TIMEOUT"
        ? "A consulta demorou demais. Confira a conexão e tente novamente."
        : "Não foi possível consultar o cupom agora. Tente novamente.");
    } finally {
      if (stillCurrent()) setCouponChecking(false);
    }
  };

  const cashValue = useMemo(() => {
    if (!troco.trim()) return null;
    const normalized = troco.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
    const value = Number(normalized);
    return Number.isFinite(value) ? value : null;
  }, [troco]);

  const finishOrder = async () => {
    if(submittingRef.current) return;
    if(!navigator.onLine){
      setIsOnline(false);
      setErrorMessage("Você está sem internet. Seu carrinho continua salvo neste aparelho; reconecte para registrar o pedido.");
      return;
    }
    // Preserve o carrinho caso o cliente o altere durante a confirmacao.
    const submittedCart = JSON.stringify(items.map(item => ({
      id: item.cartId, quantity: item.quantity, price: item.price,
      addons: item.selectedAddons, observation: item.observation,
    })));
    const clearConfirmedCart = () => {
      const currentCart = JSON.stringify(useCartStore.getState().items.map(item => ({
        id: item.cartId, quantity: item.quantity, price: item.price,
        addons: item.selectedAddons, observation: item.observation,
      })));
      if (submittedCart !== currentCart) return false;
      clearCart();
      return true;
    };
    submittingRef.current=true;
    setErrorMessage("");
    setFallbackWhatsAppUrl("");
    setOrderOutcomeUncertain(false);
    if (items.length === 0) {
      submittingRef.current=false;
      setErrorMessage("Seu carrinho está vazio.");
      return;
    }
    if (!nameReady) {
      submittingRef.current=false;
      setStep(1);
      setErrorMessage("Informe seu nome para o pedido.");
      return;
    }
    if (!phoneReady) {
      submittingRef.current=false;
      setStep(1);
      setErrorMessage("Informe um WhatsApp válido com DDD.");
      return;
    }
    if (!addressReady) {
      submittingRef.current=false;
      setStep(1);
      setErrorMessage(!isPickup && !bairro.trim() ? "Falta informar o bairro da entrega. Preencha o campo Bairro." : !districtInspection.valid && !isPickup ? "Informe o nome completo do bairro para entrega." : !numero.trim() ? "Falta o número da entrega. Complete o endereço para continuar." : "Complete rua, número e CEP para entrega.");
      if (!isPickup && !districtInspection.valid) setManualMode(true);
      setAddressEditorOpen(true); focusCheckoutIssue(!isPickup && !districtInspection.valid ? "district" : "address");
      return;
    }
    if (method === "dinheiro" && cashValue !== null && cashValue < total) {
      submittingRef.current=false;
      setErrorMessage(`O valor para troco precisa ser pelo menos ${money(total)}.`);
      return;
    }

    // R3: um HTTP 201/200 ja e compromisso confirmado. Erros locais posteriores
    // nunca podem virar uma mensagem de "pedido nao registrado".
    let confirmedOrderId: string | null = null;
    setLoading(true);
    try {
      const { status: shopStatus, testAccess } = await getCheckoutStoreAccess(currentUser?.email, true);
      const isClosed = !shopStatus.isOpen && !testAccess;
      setShopClosed(isClosed);
      const selectedSchedule = isClosed ? scheduledFor : "";
      if (isClosed && selectedSchedule) {
        let latestSlots: OrderScheduleSlot[];
        try {
          latestSlots = await getOrderScheduleSlots();
        } catch {
          setStep(1);
          setScheduleError("Não conseguimos confirmar as vagas agora. Tente novamente.");
          setErrorMessage("Não foi possível validar o horário. Seu carrinho foi preservado.");
          return;
        }
        setScheduleSlots(latestSlots);
        if (!latestSlots.some(slot => slot.value === selectedSchedule && !slot.disabled)) {
          setScheduledFor("");
          setStep(1);
          setErrorMessage("O horário selecionado não está mais disponível. Escolha outro horário.");
          return;
        }
      }
      if (isClosed && !selectedSchedule) { setStep(1); setErrorMessage("Escolha o dia e o horário do seu pedido."); focusCheckoutIssue("schedule"); submittingRef.current=false; setLoading(false); return; }
      const finalAddress = isPickup
        ? "RETIRADA NO LOCAL"
        : `${rua.trim()}, ${numero.trim()} - ${bairro.trim()}${complemento.trim() ? ` (${complemento.trim()})` : ""}${referencia.trim() ? ` · Ref.: ${referencia.trim()}` : ""}`;

      if (!currentUser) {
        if (!orderAttemptRef.current) rememberOrderAttempt(typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `guest-${Date.now()}-${Math.random().toString(36).slice(2,12)}`);
        const guestOrder = {
          clientRequestId: orderAttemptRef.current, userId: null, userName: customerName.trim() || "Cliente", userEmail: "", userPhone: userPhone.trim(),
          itens: items, subtotal, taxaEntrega: finalFee, desconto: safeDiscount, cupom: safeDiscount > 0 && appliedCouponCode ? appliedCouponCode : null, rewardId: null, total,
          metodoPagamento: method, trocoPara: method === "dinheiro" ? (troco.trim() || null) : null, observacao: orderObservation.trim() || null,
          endereco: finalAddress, tipoEntrega: deliveryMode, status: isClosed ? "Agendado" : "Pendente", isAgendamento: isClosed,
          scheduledFor: isClosed ? selectedSchedule : null, scheduledLabel: isClosed ? scheduleHumanLabel(selectedSchedule) : null, scheduleWindowMinutes: isClosed ? 30 : null,
          sourceSystem: "dfl_site", orderSchemaVersion: 3, customerMode: "guest", checkoutChannel: "site", handoffChannel: "whatsapp", recoveredCheckout: draftRecovered,
          customerSnapshot: { id: "", name: customerName.trim() || "Cliente", email: "", phone: userPhone.trim(), phoneE164: `+55${phoneDigits}` },
          deliverySnapshot: isPickup ? null : { cep: cep.trim(), street: rua.trim(), number: numero.trim(), district: bairro.trim(), complement: complemento.trim(), reference: referencia.trim() },
        };
        const created=await createCustomerOrder({ userId: null, order: guestOrder, subtotal, discount: safeDiscount > 0 && appliedCouponCode ? { code: appliedCouponCode, rewardId: null, expectedDiscount: safeDiscount } : null });
        confirmedOrderId = created.id;
        const guestMessage=buildOrderWhatsAppMessage({registered:true,orderId:created.id,customerName:customerName.trim()||"Cliente",phone:userPhone.trim(),items:items.map((item)=>({quantity:item.quantity,name:item.name,price:item.price,addons:item.selectedAddons?.map((addon)=>addon.name)??[],observation:item.observation})),deliveryMode,address:isPickup?"Retirada no balcão":finalAddress,district:bairro.trim(),complement:complemento.trim(),reference:referencia.trim(),subtotal,deliveryFee:finalFee,discount:safeDiscount,couponCode:appliedCouponCode,total,paymentMethod:method,changeFor:troco,orderObservation,scheduledLabel:isClosed?scheduleHumanLabel(selectedSchedule):undefined});
        const whatsappUrl=businessWhatsAppUrl(guestMessage);
        saveGuestIdentity({name:customerName.trim()||"Cliente",phone:userPhone.trim(),lastDeliveryMode:deliveryMode,paymentPreference:method,...(isPickup?{}:{cep:cep.trim(),street:rua.trim(),number:numero.trim(),district:bairro.trim(),complement:complemento.trim(),reference:referencia.trim()})});
        rememberGuestOrder({id:created.id,trackingKey:orderAttemptRef.current,status:isClosed?"Agendado":"Pendente",total,deliveryMode,scheduledFor:isClosed?selectedSchedule:null,scheduledLabel:isClosed?scheduleHumanLabel(selectedSchedule):null,createdAt:Date.now(),customerName:customerName.trim()||"Cliente",items:items.map(item=>({name:item.name,quantity:item.quantity}))});
        const cartCleared = clearConfirmedCart(); clearOrderAttempt(); clearCheckoutDraft(null);
        openModal("order-success",{orderId:created.id,isScheduled:isClosed,deliveryMode,total,whatsappUrl,paymentMethod:method,pixKey:method==="pix"?BUSINESS_CONTACT.pixKey:undefined,cartPreserved:!cartCleared,rescueMessage:guestMessage});
        submittingRef.current=false; setLoading(false); return;
      }

      if (!orderAttemptRef.current) {
        rememberOrderAttempt(
          typeof crypto !== "undefined" &&
          typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `site-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 12)}`,
        );
      }

      const orderData = {
        clientRequestId: orderAttemptRef.current,
        userId: currentUser.uid,
        userName: customerName.trim() || currentUser?.displayName || "Cliente",
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
        observacao: orderObservation.trim() || null,
        endereco: finalAddress,
        tipoEntrega: deliveryMode,
        data: serverTimestamp(),
        status: isClosed ? "Agendado" : "Pendente",
        isAgendamento: isClosed,
        scheduledFor: isClosed ? selectedSchedule : null,
        scheduledLabel: isClosed ? scheduleHumanLabel(selectedSchedule) : null,
        scheduleWindowMinutes: isClosed ? 30 : null,
        sourceSystem: "dfl_site",
        orderSchemaVersion: 3,
        customerMode: "google",
        checkoutChannel: "site",
        handoffChannel: null,
        recoveredCheckout: draftRecovered,
        customerSnapshot: {
          id: currentUser.uid,
          name: customerName.trim() || currentUser?.displayName || "Cliente",
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
      confirmedOrderId = created.id;

      // O perfil e apenas conveniencia. Nao segurar confirmacao esperando Firestore.
      const persistProfileAfterSuccess = async () => {
      try {
        await saveUserProfile(currentUser, { name: customerName, phone: userPhone, cep, street: rua, number: numero, district: bairro, complement: complemento, reference: referencia });
        if (!isPickup) {
          const list=profile?.addresses||[]; const i=list.findIndex(a=>a.id===selectedAddressId); const old=i>=0?list[i]:null;
          const next:SavedAddress={id:selectedAddressId||`address-${Date.now()}`,label:old?.label||(list.length?"Outro":"Casa"),cep:cep.trim(),street:rua.trim(),number:numero.trim(),district:bairro.trim(),complement:complemento.trim(),reference:referencia.trim(),isDefault:old?.isDefault??list.length===0};
          await saveUserAddresses(currentUser,i>=0?list.map((a,n)=>n===i?next:a):(list.length<3?[...list,next]:list));
        }

      } catch (profileError) {
        console.error("Pedido salvo, mas falhou ao atualizar o perfil do cliente", profileError);
      }
      };

      const whatsappMessage = buildOrderWhatsAppMessage({
        registered: true,
        orderId: created.id,
        customerName: customerName.trim() || currentUser?.displayName || "Cliente",
        phone: userPhone.trim(),
        items: items.map((item) => ({
          quantity: item.quantity,
          name: item.name,
          price: item.price,
          addons: item.selectedAddons?.map((addon) => addon.name) ?? [],
          observation: item.observation,
        })),
        deliveryMode,
        address: isPickup ? "Retirada no balcão" : finalAddress,
        district: bairro.trim(),
        complement: complemento.trim(),
        reference: referencia.trim(),
        subtotal,
        deliveryFee: finalFee,
        discount: safeDiscount,
        couponCode: appliedCouponCode,
        total,
        paymentMethod: method,
        changeFor: troco,
        orderObservation,
        scheduledLabel: isClosed ? scheduleHumanLabel(selectedSchedule) : undefined,
      });

      const whatsappUrl = businessWhatsAppUrl(whatsappMessage);

      const cartCleared = clearConfirmedCart();
      clearOrderAttempt();
      clearCheckoutDraft(currentUser.uid);
      clearCheckoutDraft(null);

      openModal("order-success", {
        orderId: created.id,
        isScheduled: isClosed,
        deliveryMode,
        total,
        whatsappUrl,
        paymentMethod: method,
        pixKey: method === "pix" ? BUSINESS_CONTACT.pixKey : undefined,
        cartPreserved: !cartCleared,
        rescueMessage: whatsappMessage,
      });
      // Perfil atualizado depois de exibir o comprovante. Rejeicoes ja tratadas no helper.
      void persistProfileAfterSuccess();
    } catch (error) {
      if (confirmedOrderId) {
        // Pode falhar um formatador, localStorage ou o WhatsApp DEPOIS do HTTP 201.
        // Nunca dizer que o pedido nao foi salvo nem oferecer um pedido paralelo.
        console.error("[checkout] pedido confirmado, falha local pos-registro", error);
        setOrderOutcomeUncertain(false);
        setFallbackWhatsAppUrl("");
        setErrorMessage("");
        try { clearOrderAttempt(); clearCheckoutDraft(currentUser?.uid ?? null); } catch {}
        try {
          openModal("order-success", {
            orderId: confirmedOrderId,
            isScheduled: shopClosed && Boolean(scheduledFor),
            deliveryMode,
            total,
            whatsappUrl: "",
            paymentMethod: method,
            pixKey: method === "pix" ? BUSINESS_CONTACT.pixKey : undefined,
            cartPreserved: true,
          });
        } catch {
          setErrorMessage(`Pedido ${confirmedOrderId} confirmado! Consulte Meus Pedidos.`);
        }
        return;
      }
      console.error("Erro ao salvar pedido", error);
      const code = error instanceof Error ? error.message : "";
      // R5: antes de alegar falha, consultar a MESMA tentativa. Nunca enviar outro POST.
      if (orderOutcomeNeedsReview(code) && orderAttemptRef.current) {
        const resolved = await resolveCheckoutAttempt(orderAttemptRef.current, currentUser ? "google" : "guest");
        if (resolved.outcome === "found") {
          setOrderOutcomeUncertain(false);
          setFallbackWhatsAppUrl("");
          setErrorMessage("");
          try { clearOrderAttempt(); clearCheckoutDraft(currentUser?.uid ?? null); } catch {}
          openModal("order-success", {
            orderId: resolved.orderId,
            isScheduled: shopClosed && Boolean(scheduledFor),
            deliveryMode,
            total,
            whatsappUrl: "",
            paymentMethod: method,
            pixKey: method === "pix" ? BUSINESS_CONTACT.pixKey : undefined,
            cartPreserved: true,
          });
          return;
        }
        // Mesmo not_found e incerto devido a corrida com POST original.
        setOrderOutcomeUncertain(true);
      } else {
        setOrderOutcomeUncertain(false);
      }
      const fallbackMessage = buildOrderWhatsAppMessage({
        registered: false,
        customerName: customerName.trim() || currentUser?.displayName || "Cliente",
        phone: userPhone.trim(),
        items: items.map((item) => ({
          quantity: item.quantity,
          name: item.name,
          price: item.price,
          addons: item.selectedAddons?.map((addon) => addon.name) ?? [],
          observation: item.observation,
        })),
        deliveryMode,
        address: isPickup ? "Retirada no balcão" : `${rua.trim()}, ${numero.trim()}`,
        district: bairro.trim(),
        complement: complemento.trim(),
        reference: referencia.trim(),
        subtotal,
        deliveryFee: finalFee,
        discount: safeDiscount,
        couponCode: appliedCouponCode,
        total,
        paymentMethod: method,
        changeFor: troco,
        orderObservation,
        scheduledLabel: shopClosed && scheduledFor ? scheduleHumanLabel(scheduledFor) : undefined,
      });
      // Resposta incerta pode significar pedido já registrado: proibir duplicidade por WhatsApp.
      // V86 R4 e V88: regras de adicionais jamais abrem pedido manual paralelo.
      const addonRuleRejected = code === "ADDON_SELECTION_INVALID" ||
        code === "ADDON_POLICY_INVALID" ||
        code === "ADDON_GROUP_INVALID" ||
        code === "ADDON_GROUP_SELECTION_INVALID";
      if (addonRuleRejected) {
        setFallbackWhatsAppUrl("");
      } else {
      setFallbackWhatsAppUrl(canOfferManualOrderFallback(code) ? businessWhatsAppUrl(fallbackMessage) : "");
      }
      haptic("error");
      if (code === "SCHEDULE_REQUIRED") {
        // O backend pode detectar o fechamento entre a revisao e o clique final.
        // Nunca perder carrinho/chave de idempotencia: voltar ao agendamento.
        setShopClosed(true);
        setStep(1);
        setScheduledFor("");
        setScheduleLoading(true);
        setErrorMessage("A loja não está recebendo pedidos imediatos agora. Escolha um horário disponível para agendar.");
        void getOrderScheduleSlots()
          .then((slots) => { setScheduleSlots(slots); setScheduleError(""); })
          .catch(() => setScheduleError("Não conseguimos carregar horários. Tente novamente em instantes."))
          .finally(() => setScheduleLoading(false));
      } else if (code.startsWith("COUPON_") || code.startsWith("REWARD_")) {
        setAppliedCouponCode("");
        setAppliedRewardId("");
        setDiscount(0);
        setCouponMessage("O cupom ou benefício mudou desde a validação. Aplique o código novamente.");
        setErrorMessage("Revise o cupom ou benefício antes de confirmar. Seu carrinho foi preservado.");
      } else if (["PRICE_CHANGED", "DELIVERY_CHANGED", "PRODUCT_UNAVAILABLE", "ADDON_UNAVAILABLE", "ADDON_SELECTION_INVALID", "ADDON_POLICY_INVALID", "ADDON_GROUP_INVALID", "ADDON_GROUP_SELECTION_INVALID", "UPSELL_CHANGED", "UPSELL_INVALID"].includes(code)) {
        setErrorMessage("O cardápio ou a taxa mudou. Feche o checkout, confira o carrinho atualizado e tente novamente.");
      } else if (code === "ADDRESS_INVALID") {
        setStep(1);
        setAddressEditorOpen(true);
        setManualMode(true);
        setErrorMessage("Não conseguimos confirmar o bairro. Confira rua, número, CEP e o nome completo do bairro.");
        focusCheckoutIssue("address");
      } else if (code === "SERVICE_BUSY") {
        setErrorMessage("O sistema de pedidos atingiu o limite temporário do banco. Seu carrinho foi preservado; aguarde alguns minutos e tente novamente.");
      } else if (code === "SERVICE_UNAVAILABLE") {
        setErrorMessage("O serviço de pedidos está temporariamente indisponível. Seu carrinho foi preservado; tente novamente em instantes.");
      } else if (code === "IDEMPOTENCY_CONFLICT") {
        setErrorMessage("Existe uma tentativa anterior deste pedido com informações diferentes. Por segurança, não vamos gerar outra cobrança ou pedido automaticamente. Confira Meus Pedidos antes de iniciar um novo pedido. Seu carrinho foi preservado.");
      } else if (code === "IDEMPOTENCY_REQUIRED") {
        setErrorMessage("Não foi possível identificar esta tentativa de pedido. Seu carrinho foi preservado. Feche e abra o checkout para tentar novamente.");
      } else if (code === "ORDER_TIMEOUT") {
        setErrorMessage("A resposta demorou, mas o pedido pode ter sido registrado. Seu carrinho continua salvo. Confira Meus Pedidos antes de tentar novamente. Se repetir sem alterar os dados, a loja reconhece a mesma tentativa.");
      } else if (code === "ORDER_NETWORK") {
        setErrorMessage("A conexão caiu e não conseguimos confirmar se o pedido foi registrado. Seu carrinho continua salvo. Confira Meus Pedidos; se precisar repetir, mantenha os mesmos dados para recuperar a mesma tentativa.");
      } else if (code === "SERVICE_CONFIG") {
        setErrorMessage("O pedido não pôde ser gravado por uma configuração do servidor. Seu carrinho foi preservado e a loja precisa revisar o acesso ao banco.");
      } else {
        setErrorMessage("Não conseguimos registrar o pedido. Seu carrinho foi preservado. Tente novamente antes de enviar pelo WhatsApp.");
      }
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <ModalBase title={step === 1 ? "Como você quer receber?" : "Confirme seu pedido"} onClose={closeModal}>
      <div className={styles.body}>
        {!isOnline && <div className={styles.offlineBanner} role="status"><strong>Sem conexão</strong><span>Seu carrinho e os dados deste checkout ficam preservados neste aparelho. Reconecte antes de confirmar.</span></div>}
        {draftRecovered && <div className={styles.recoveryBanner} role="status"><div><strong>Seu pedido estava te esperando</strong><span>{draftRecoveredAge === null ? "Recuperamos os dados recentes deste aparelho." : draftRecoveredAge < 1 ? "Recuperamos o que você preenchia agora há pouco." : draftRecoveredAge < 60 ? `Recuperamos seu checkout de há ${draftRecoveredAge} min.` : `Recuperamos seu checkout de há ${Math.floor(draftRecoveredAge / 60)}h.`} Continue sem preencher tudo de novo.</span></div><button type="button" aria-label="Fechar aviso" onClick={() => setDraftRecovered(false)}>×</button></div>}
        {errorMessage && orderOutcomeUncertain && <section className={styles.uncertainOrderAction} role="status" aria-label="Verificação de pedido após instabilidade">
          <strong>Seu pedido pode ter chegado à loja.</strong>
          <p>Antes de tentar novamente, confira se o pedido já aparece no histórico. Não faça um segundo pedido pelo WhatsApp sem confirmar com a loja.</p>
          <button type="button" onClick={() => { haptic("step"); openModal("orders"); }}>Conferir Meus Pedidos</button>
        </section>}
        <div className={styles.steps} aria-label={`Etapa ${step} de 2`}>
          <i data-active="true" /><i data-active={step === 2} />
        </div>
        <div className={styles.stepCaption}><strong>{step === 1 ? "Entrega" : "Pagamento"}</strong><span>{step}/2</span></div>
        {errorMessage && <div className={styles.errorFallback}><div className={styles.error}>{errorMessage}</div>{fallbackWhatsAppUrl && <div className={styles.contingency}><span>FINALIZAÇÃO ALTERNATIVA</span><strong>Seu pedido continua completo</strong><p>Os itens e os dados preenchidos foram preservados. Você pode tentar novamente ou enviar o pedido já organizado para confirmação pelo WhatsApp.</p><button type="button" onClick={() => { haptic("success"); window.location.href = fallbackWhatsAppUrl; }}>Continuar no WhatsApp</button><small>O envio não é automático: confira a mensagem e toque em enviar.</small></div>}</div>}

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
                  <strong>{addressReady && !addressEditorOpen ? "Vamos entregar aqui" : "Informe o endereço da entrega"}</strong>
                  <small>{addressReady && !addressEditorOpen ? "Confira o endereço antes de continuar." : "Salve uma vez e os próximos pedidos ficam mais rápidos."}</small>
                </div>
                {addressReady && !addressEditorOpen && <>
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
                {(!addressReady || addressEditorOpen) && <div className={styles.addressForm}>
                  <div className={styles.newAddressIntro}><strong>{rua.trim() && numero.trim() && !bairro.trim() ? "Complete o endereço" : savedAddresses.length ? "Novo endereço" : "Seu primeiro endereço"}</strong><span>Busque pelo CEP para preencher mais rápido.</span></div>
                  {!manualMode&&<div className={styles.cepAuto}><label><span>CEP</span><input className={styles.input} placeholder="00000-000" value={cep} onChange={e=>{customerEditingRef.current=true;cepRequestRef.current+=1;cepLookupRef.current="";setCep(formatCEPBR(e.target.value));if(!submittingRef.current)setLoading(false)}} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();cepLookupRef.current="";void handleSearchCep()}}} inputMode="numeric" autoComplete="postal-code"/></label><small>{loading?"Buscando endereço…":"Digite os 8 números e encontramos o endereço automaticamente."}</small></div>}
                  <input className={styles.input} placeholder="Rua" value={rua} onChange={e=>{customerEditingRef.current=true;setRua(e.target.value)}} readOnly={!manualMode} data-readonly={!manualMode} autoComplete="address-line1"/>
                  <div className={styles.addressGrid}><input ref={numberInputRef} className={styles.input} placeholder="Nº" value={numero} onChange={e=>{customerEditingRef.current=true;setNumero(e.target.value)}} inputMode="numeric"/><input ref={districtInputRef} className={styles.input} placeholder="Bairro completo" aria-label="Bairro da entrega" aria-invalid={!isPickup && !districtInspection.valid && Boolean(rua.trim() && numero.trim())} value={bairro} onChange={e=>{customerEditingRef.current=true;districtManuallyEditedRef.current=true;setBairro(e.target.value)}} onBlur={()=>{if(manualMode&&bairro.trim()&&districtInspection.valid)void calculateDeliveryFee(bairro);}} readOnly={!manualMode} data-readonly={!manualMode}/></div>
                  <div className={styles.districtHelper} aria-live="polite" data-invalid={(!districtInspection.valid && Boolean(rua.trim() && numero.trim())) || (Boolean(rua.trim()) && rua.trim().length < 4)}>
                    {Boolean(rua.trim() && numero.trim() && !bairro.trim()) && <strong>Falta informar o bairro da entrega. Toque no campo Bairro para completar.</strong>}{Boolean(bairro.trim()) && !districtInspection.valid && <strong>Confira o bairro: use o nome completo, não apenas a inicial.</strong>}
                    {Boolean(rua.trim()) && rua.trim().length < 4 && <strong>Confira a rua: informe o nome completo, não apenas uma letra.</strong>}
                    {districtSuggestions.length > 0 && manualMode && <div className={styles.districtSuggestions} aria-label="Sugestões de bairros"><small>Você quis dizer:</small>{districtSuggestions.map(name=><button type="button" key={name} onClick={()=>{setBairro(name);setDeliveryStatus(`Bairro escolhido: ${name}. Confira rua e número.`);void calculateDeliveryFee(name);}}>{name}</button>)}</div>}
                  </div>
                  <input className={styles.input} placeholder="Complemento (opcional)" value={complemento} onChange={e=>{customerEditingRef.current=true;setComplemento(e.target.value)}} autoComplete="address-line2"/><input className={styles.input} placeholder="Referência (opcional)" value={referencia} onChange={e=>{customerEditingRef.current=true;setReferencia(e.target.value)}}/>{deliveryStatus&&<div className={styles.info} role="status" aria-live="polite">{deliveryStatus}</div>}
                  <div className={styles.addressFormActions}><button className={styles.linkButton} type="button" onClick={()=>setManualMode(v=>!v)}>{manualMode?"← Usar meu CEP":"Não sei meu CEP · preencher endereço manualmente"}</button>{savedAddresses.length>0&&<button className={styles.linkButton} type="button" onClick={()=>{const fallback=savedAddresses.find(a=>a.isDefault)||savedAddresses[0];if(fallback)selectSavedAddress(fallback);}}>Cancelar</button>}</div>
                </div>}
              </section>
              {!isPickup && freeThreshold !== null && !hasFreeDelivery && <div className={styles.freightProgress}>Faltam <strong>{money(missingForFreeDelivery)}</strong> para ganhar entrega grátis.</div>}{hasFreeDelivery && <div className={styles.successHint}>Entrega grátis conquistada para este pedido.</div>}
            </> : <div className={styles.pickupCard}><strong>Retirada no balcão</strong><span>Sem taxa de entrega. O pedido ficará identificado pelo seu nome e referência.</span></div>}
            {shopClosed && (
              <section ref={scheduleSectionRef} className={styles.scheduleCard}>
                <div>
                  <span>LOJA FECHADA AGORA</span>
                  <strong>Escolha quando quer receber</strong>
                  <small>
                    O próximo horário é apenas uma sugestão. Seu pedido só será agendado depois que você escolher.
                  </small>
                </div>

                {scheduleLoading ? (
                  <p>Carregando horários…</p>
                ) : scheduleGroups.length ? (
                  <div className={styles.scheduleDays}>
                    {scheduleGroups.map((group) => (
                      <div
                        className={styles.scheduleDay}
                        key={group.date}
                      >
                        <div
                          className={styles.scheduleDayHead}
                        >
                          <strong>{group.label}</strong>
                          <span>
                            {
                              group.slots.filter(
                                (slot) =>
                                  !slot.disabled,
                              ).length
                            }{" "}
                            horários
                          </span>
                        </div>

                        <div
                          className={styles.scheduleSlots}
                        >
                          {group.slots.map((slot) => {
                            const availability =
                              slot.label
                                .split(" · ")
                                .slice(2)
                                .join(" · ");

                            return (
                              <button
                                type="button"
                                key={slot.value}
                                disabled={slot.disabled}
                                data-active={
                                  scheduledFor ===
                                  slot.value
                                }
                                onClick={() =>
                                  setScheduledFor(
                                    slot.value,
                                  )
                                }
                              >
                                <strong>
                                  {slot.time}
                                </strong>
                                <span>
                                  {availability ||
                                    (slot.disabled
                                      ? "Lotado"
                                      : "Disponível")}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>
                    {scheduleError ||
                      "Nenhum horário disponível nos próximos dias."}
                  </p>
                )}
              </section>
            )}
            <button className={styles.primary} type="button" onClick={() => { setErrorMessage(""); if (canAdvance && (!shopClosed || Boolean(scheduledFor))) setStep(2); else setErrorMessage(!nameReady ? "Informe seu nome para o pedido." : !phoneReady ? "Informe um WhatsApp válido com DDD." : !addressReady ? (!isPickup && !bairro.trim() ? "Falta informar o bairro da entrega. Preencha o campo Bairro." : !districtInspection.valid && !isPickup ? "Informe o nome completo do bairro e confira o endereço." : "Complete o endereço para continuar.") : "Escolha um horário disponível para o agendamento."); if (!isPickup && !addressReady && !districtInspection.valid) { setManualMode(true); setAddressEditorOpen(true); focusCheckoutIssue("district"); } }}>Continuar</button>
          </div>
        ) : (
          <div className={styles.stack}>
            <section className={styles.receiveCard}><div><strong>{customerName || (isPickup ? "Retirada no balcão" : "Entrega no endereço")}</strong><span>{isPickup ? "Retirada no balcão · sem taxa de entrega" : `${rua}, ${numero} - ${bairro}${complemento ? ` · ${complemento}` : ""}${referencia ? ` · Ref.: ${referencia}` : ""}`}</span><small>{userPhone}</small></div><button type="button" onClick={() => setStep(1)}>Editar</button></section>
            <section className={styles.card}><div className={styles.cardTitle}><div><strong>Cupom ou benefício</strong><span>Você também pode usar aqui um código liberado pela fidelidade.</span></div></div><div className={styles.inline}><input className={styles.input} placeholder="Código do cupom" aria-label="Código do cupom ou benefício" value={couponCode} maxLength={32} autoComplete="off" autoCapitalize="characters" spellCheck={false} onChange={(event) => changeCouponCode(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void applyCoupon(); } }}/><button className={styles.yellowButton} type="button" onClick={() => void applyCoupon()} disabled={loading || couponChecking || !couponCode.trim()}>{couponChecking ? "Verificando…" : "Aplicar"}</button></div>{couponMessage && <span className={safeDiscount > 0 ? styles.couponOk : styles.couponError} role={safeDiscount > 0 ? "status" : "alert"}>{couponMessage}</span>}</section>
            <section className={styles.totalCard}><div><span>Subtotal</span><b>{money(subtotal)}</b></div><div><span>{isPickup ? "Retirada" : "Entrega"}</span><b data-free={finalFee === 0}>{isPickup ? "Sem taxa" : finalFee === 0 ? "Grátis" : money(finalFee)}</b></div>{safeDiscount > 0 && <div className={styles.discount}><span>Desconto {appliedCouponCode ? `(${appliedCouponCode})` : ""}</span><b>-{money(safeDiscount)}</b></div>}<div className={styles.total}><strong>Total</strong><strong>{money(total)}</strong></div>{!isPickup && finalFee === 0 && <small>{hasFreeDelivery ? `Você ganhou entrega grátis por atingir o valor mínimo${freeThreshold ? ` de ${money(freeThreshold)}` : ""}.` : deliveryFee === 0 && bairro.trim() ? `Entrega grátis configurada para ${bairro.trim()}.` : "Entrega grátis aplicada a este pedido."}</small>}</section>
            <section><div className={styles.sectionLabel}>Como você quer pagar?</div><div className={styles.paymentTabs}>{(["pix", "cartao", "dinheiro"] as PaymentMethod[]).map((option) => <button type="button" key={option} data-active={method === option} onClick={() => setMethod(option)}>{option === "pix" ? "PIX" : option === "cartao" ? "Cartão" : "Dinheiro"}</button>)}</div></section>
            {method === "pix" && <div className={styles.pixCard}><div><strong>Pagamento via PIX</strong><span>Primeiro registraremos o pedido. Na tela seguinte você poderá copiar a chave, conferir o valor e enviar o comprovante.</span></div></div>}
            {method === "dinheiro" && <label className={styles.label}>Troco para quanto? <span>(opcional)</span><input className={styles.input} placeholder="Ex.: 100,00" value={troco} onChange={(event) => setTroco(event.target.value)} inputMode="decimal"/></label>}
            <label className={styles.label}>Observação do pedido <span>(opcional)</span><textarea className={`${styles.input} ${styles.orderObservation}`} placeholder="Ex.: tocar o interfone, retirar ingrediente de todos os itens…" value={orderObservation} onChange={(event) => setOrderObservation(event.target.value.slice(0, 300))} maxLength={300}/><small className={styles.counter}>{orderObservation.length}/300</small></label>
            <div className={styles.actions}><button className={styles.secondary} type="button" onClick={() => { setErrorMessage(""); setStep(1); }} disabled={loading}>Voltar</button><button className={styles.primary} type="button" onClick={() => void finishOrder()} disabled={loading || !isOnline} aria-busy={loading}>{loading ? "Registrando pedido… não feche esta tela" : !isOnline ? "Reconecte para confirmar" : `Confirmar pedido · ${money(total)}`}</button></div>
            <p className={styles.trust}>Seu WhatsApp fica salvo para as atualizações do pedido. Você também acompanha o andamento pelo site.</p>
          </div>
        )}
      </div>
    </ModalBase>
  );
}
