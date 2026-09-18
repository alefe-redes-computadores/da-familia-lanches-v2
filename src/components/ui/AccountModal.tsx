"use client";

import { useEffect, useRef, useState } from "react";
import { auth } from "@/lib/firebase";
import { ModalBase } from "./ModalBase";
import { useUIStore } from "@/store/ui";
import { useAuthStore } from "@/store/auth.store";
import { useUserProfile } from "@/hooks/useUserProfile";
import {
  formatCEPBR,
  formatPhoneBR,
  MAX_SAVED_ADDRESSES,
  saveUserAddresses,
  saveUserProfile,
  type SavedAddress,
} from "@/lib/userProfile";
import styles from "./AccountModal.module.css";

const digits = (value: string) => value.replace(/\D/g, "");

export function AccountModal() {
  const closeModal = useUIStore((state) => state.closeModal);
  const openModal = useUIStore((state) => state.openModal);
  const currentUser = useAuthStore((state) => state.currentUser);
  const { profile, loading: profileLoading } = useUserProfile(currentUser);
  const hydratedRef = useRef("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [district, setDistrict] = useState("");
  const [complement, setComplement] = useState("");
  const [reference, setReference] = useState("");
  const [manualAddress, setManualAddress] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState("");
  const [addressLabel, setAddressLabel] = useState("Casa");
  const [saving, setSaving] = useState(false);
  const [searchingCep, setSearchingCep] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!currentUser || profileLoading) return;
    const key = JSON.stringify({
      uid: currentUser.uid,
      profile,
      fallbackName: currentUser.displayName,
    });
    if (hydratedRef.current === key) return;
    hydratedRef.current = key;

    setName(profile?.name || currentUser.displayName || "");
    setPhone(profile?.phone || "");
    setCep(profile?.address.cep || "");
    setStreet(profile?.address.street || "");
    setNumber(profile?.address.number || "");
    setDistrict(profile?.address.district || "");
    setComplement(profile?.address.complement || "");
    setReference(profile?.address.reference || "");
    setManualAddress(Boolean(profile?.address.street || profile?.address.district));
  }, [currentUser, profile, profileLoading]);

  const phoneReady = digits(phone).length === 10 || digits(phone).length === 11;
  const hasAnyAddress = Boolean(
    cep.trim() || street.trim() || number.trim() || district.trim() || complement.trim() || reference.trim(),
  );
  const addressReady = !hasAnyAddress || Boolean(street.trim() && number.trim() && district.trim());
  const cepReady = !cep.trim() || digits(cep).length === 8;
  const nameReady = name.trim().length >= 2;
  const canSave = nameReady && phoneReady && addressReady && cepReady && !saving;
  const hasSavedAddress = Boolean(street.trim() || district.trim());
  const addressLine = hasSavedAddress
    ? [street.trim(), number.trim()].filter(Boolean).join(", ")
    : "Nenhum endereço cadastrado";
  const addressMeta = hasSavedAddress
    ? [district.trim(), cep.trim() ? `CEP ${cep.trim()}` : ""].filter(Boolean).join(" · ")
    : "Cadastre seu endereço para agilizar o checkout.";


  const searchCep = async () => {
    const value = digits(cep);
    setMessage("");
    setError("");
    if (value.length !== 8) {
      setError("Digite um CEP com 8 números.");
      return;
    }

    setSearchingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${value}/json/`);
      if (!response.ok) throw new Error(`ViaCEP ${response.status}`);
      const data = await response.json();
      if (data.erro) {
        setManualAddress(true);
        setError("CEP não encontrado. Você pode preencher o endereço manualmente.");
        return;
      }
      setStreet(typeof data.logradouro === "string" ? data.logradouro : "");
      setDistrict(typeof data.bairro === "string" ? data.bairro : "");
      setManualAddress(!(data.logradouro && data.bairro));
      setMessage("Endereço encontrado. Complete o número e confira os dados.");
    } catch (searchError) {
      console.error("Erro ao consultar CEP no perfil", searchError);
      setManualAddress(true);
      setError("Não foi possível consultar o CEP agora. Preencha manualmente.");
    } finally {
      setSearchingCep(false);
    }
  };

  const save = async () => {
    setError("");
    setMessage("");
    if (!currentUser) return;
    if (!nameReady) return setError("Informe seu nome.");
    if (!phoneReady) return setError("Informe um WhatsApp válido com DDD.");
    if (!cepReady) return setError("Confira o CEP informado.");
    if (!addressReady) return setError("Para salvar um endereço, preencha rua, número e bairro.");

    setSaving(true);
    try {
      await saveUserProfile(currentUser, {
        name,
        phone,
        cep,
        street,
        number,
        district,
        complement,
        reference,
      }, "account");
      setMessage("Conta atualizada. Seus próximos pedidos já usarão esses dados.");
    } catch (saveError) {
      console.error("Erro ao salvar perfil", saveError);
      setError("Não foi possível salvar sua conta agora. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const openAddress = (a: SavedAddress) => { setEditingAddressId(a.id); setAddressLabel(a.label); setCep(a.cep); setStreet(a.street); setNumber(a.number); setDistrict(a.district); setComplement(a.complement); setReference(a.reference); setManualAddress(true); setAddressOpen(true); };
  const startNewAddress = () => { if ((profile?.addresses?.length || 0) >= MAX_SAVED_ADDRESSES) return; setEditingAddressId(""); setAddressLabel((profile?.addresses?.length || 0) ? "Outro" : "Casa"); setCep(""); setStreet(""); setNumber(""); setDistrict(""); setComplement(""); setReference(""); setManualAddress(false); setAddressOpen(true); };
  const persistAddress = async () => {
    if (!currentUser || !street.trim() || !number.trim() || !district.trim()) return setError("Preencha rua, número e bairro.");
    const list=profile?.addresses || []; const old=list.find(a=>a.id===editingAddressId);
    if (!old && list.length>=MAX_SAVED_ADDRESSES) return setError("Limite de 3 endereços atingido.");
    const next: SavedAddress={id:editingAddressId||`address-${Date.now()}`,label:addressLabel.trim()||"Endereço",cep,street:street.trim(),number:number.trim(),district:district.trim(),complement:complement.trim(),reference:reference.trim(),isDefault:old?.isDefault ?? list.length===0};
    setSaving(true); try { await saveUserAddresses(currentUser,old?list.map(a=>a.id===old.id?next:a):[...list,next]); setMessage("Endereço salvo."); setAddressOpen(false); } catch(e){console.error(e);setError("Não foi possível salvar o endereço.");} finally{setSaving(false);}
  };
  const makeDefault = async (id:string) => { if(currentUser&&profile?.addresses) await saveUserAddresses(currentUser,profile.addresses.map(a=>({...a,isDefault:a.id===id}))); };
  const removeAddress = async (id:string) => { if(!currentUser||!profile?.addresses)return; let list=profile.addresses.filter(a=>a.id!==id); if(list.length&&!list.some(a=>a.isDefault))list=list.map((a,i)=>({...a,isDefault:i===0})); await saveUserAddresses(currentUser,list); setAddressOpen(false); };

  const logout = async () => {
    try {
      await auth.signOut();
      closeModal();
    } catch (logoutError) {
      console.error("Erro ao sair", logoutError);
      setError("Não foi possível sair da conta agora.");
    }
  };

  if (!currentUser) {
    return (
      <ModalBase title="Minha conta" onClose={closeModal}>
        <div className={styles.guest}>
          <div className={styles.guestIcon}>DFL</div>
          <strong>Entre para cuidar da sua conta</strong>
          <p>Seus dados de entrega, pedidos e benefícios ficam vinculados ao seu login.</p>
          <button type="button" onClick={() => openModal("login", { returnTo: "account" })}>Entrar com Google</button>
        </div>
      </ModalBase>
    );
  }

  const displayName = profile?.name || currentUser.displayName || "Cliente";
  const firstLetter = displayName.trim().slice(0, 1).toUpperCase() || "D";

  return (
    <ModalBase title="Minha conta" onClose={closeModal}>
      <div className={styles.body}>
        <section className={styles.identity}>
          {currentUser.photoURL ? (
            <img src={currentUser.photoURL} alt="" referrerPolicy="no-referrer" />
          ) : (
            <div className={styles.avatar}>{firstLetter}</div>
          )}
          <div className={styles.identityText}>
            <span>CONTA DA FAMÍLIA</span>
            <strong>{displayName}</strong>
            <small>{currentUser.email}</small>
          </div>
        </section>

        <nav className={styles.accountNav}><button type="button" onClick={() => openModal("orders")}><span>Pedidos</span><small>Acompanhar seus pedidos</small><b>›</b></button><button type="button" onClick={() => openModal("rewards")}><span>Recompensas</span><small>Cupons e fidelidade</small><b>›</b></button></nav>

        {error && <div className={styles.error}>{error}</div>}
        {message && <div className={styles.success}>{message}</div>}

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <div><span>SEUS DADOS</span><strong>Dados pessoais</strong></div>
            <button className={styles.textAction} type="button" onClick={() => setEditingProfile((value) => !value)}>
              {editingProfile ? "Fechar" : "Editar"}
            </button>
          </div>

          {!editingProfile ? (
            <div className={styles.profileSummary}>
              <div><span>Nome</span><strong>{name || displayName}</strong></div>
              <div><span>WhatsApp</span><strong>{phone || "Não informado"}</strong></div>
              <div className={styles.emailSummary}><span>E-mail</span><strong>{currentUser.email}</strong></div>
              <small className={profile?.phoneVerified ? styles.verified : styles.unverified}>
                {profile?.phoneVerified ? "WhatsApp verificado" : "WhatsApp informado · ainda não verificado"}
              </small>
            </div>
          ) : (
            <div className={styles.editor}>
              <label className={styles.label}>
                Nome
                <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="Seu nome" />
              </label>
              <label className={styles.label}>
                WhatsApp
                <input value={phone} onChange={(event) => setPhone(formatPhoneBR(event.target.value))} inputMode="tel" autoComplete="tel" placeholder="(34) 99999-9999" />
              </label>
              <label className={styles.label}>
                E-mail da conta Google
                <input value={currentUser.email || ""} readOnly className={styles.readonly} />
              </label>
              <button className={styles.save} type="button" onClick={() => void save()} disabled={!canSave}>
                {saving ? "Salvando…" : "Salvar dados pessoais"}
              </button>
            </div>
          )}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}><div><span>ENTREGA</span><strong>Meus endereços</strong></div><small>{profile?.addresses?.length || 0}/{MAX_SAVED_ADDRESSES}</small></div>
          <div className={styles.wallet}>{(profile?.addresses || []).map(a=><article className={styles.walletCard} key={a.id}><button className={styles.walletMain} type="button" onClick={()=>openAddress(a)}><span className={styles.addressIcon}>⌂</span><span className={styles.addressCopy}><span className={styles.addressTags}><b>{a.label}</b>{a.isDefault&&<em>Padrão</em>}</span><strong>{a.street}, {a.number}</strong><small>{a.district}{a.cep?` · CEP ${a.cep}`:""}</small></span><b className={styles.chevron}>›</b></button>{!a.isDefault&&<button className={styles.defaultAction} type="button" onClick={()=>void makeDefault(a.id)}>Tornar padrão</button>}</article>)}{(profile?.addresses?.length||0)<MAX_SAVED_ADDRESSES&&<button className={styles.newAddress} type="button" onClick={startNewAddress}><span><b>+</b><strong>Adicionar endereço</strong></span><small>Até 3</small></button>}</div>
          {addressOpen&&<div className={styles.addressEditor}><div className={styles.editorTitle}><div><span>ENDEREÇO</span><strong>{editingAddressId?"Editar endereço":"Novo endereço"}</strong></div></div><label className={styles.label}>Nome<input value={addressLabel} onChange={e=>setAddressLabel(e.target.value)} placeholder="Casa, Trabalho, Mãe…"/></label><div className={styles.cepRow}><input value={cep} onChange={e=>setCep(formatCEPBR(e.target.value))} placeholder="CEP"/><button type="button" onClick={()=>void searchCep()} disabled={searchingCep}>{searchingCep?"Buscando…":"Buscar CEP"}</button></div><label className={styles.label}>Rua<input value={street} onChange={e=>setStreet(e.target.value)} readOnly={!manualAddress&&Boolean(street)} className={!manualAddress&&street?styles.readonly:""}/></label><div className={styles.twoColumns}><label className={styles.label}>Número<input value={number} onChange={e=>setNumber(e.target.value)}/></label><label className={styles.label}>Bairro<input value={district} onChange={e=>setDistrict(e.target.value)} readOnly={!manualAddress&&Boolean(district)} className={!manualAddress&&district?styles.readonly:""}/></label></div><label className={styles.label}>Complemento <span>(opcional)</span><input value={complement} onChange={e=>setComplement(e.target.value)}/></label><label className={styles.label}>Referência <span>(opcional)</span><input value={reference} onChange={e=>setReference(e.target.value)}/></label><div className={styles.addressEditorActions}><button className={styles.manualButton} type="button" onClick={()=>setManualAddress(v=>!v)}>{manualAddress?"Usar CEP":"Editar manualmente"}</button><button className={styles.save} type="button" onClick={()=>void persistAddress()} disabled={saving}>{saving?"Salvando…":"Salvar endereço"}</button></div>{editingAddressId&&<button className={styles.deleteAddress} type="button" onClick={()=>void removeAddress(editingAddressId)}>Excluir este endereço</button>}</div>}
        </section>

        <button className={styles.logout} type="button" onClick={() => void logout()} disabled={saving}>Sair da conta</button>
        <p className={styles.privacy}>Seus dados salvos agilizam seus próximos pedidos.</p>
      </div>
    </ModalBase>
  );
}
