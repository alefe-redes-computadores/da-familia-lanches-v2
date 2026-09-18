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
  saveUserProfile,
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

        <div className={styles.quickActions}>
          <button className={styles.ordersAction} type="button" onClick={() => openModal("orders")}>
            <i aria-hidden="true">01</i>
            <span><strong>Pedidos</strong><small>Acompanhar e repetir</small></span>
            <b aria-hidden="true">›</b>
          </button>
          <button className={styles.rewardsAction} type="button" onClick={() => openModal("rewards")}>
            <i aria-hidden="true">★</i>
            <span><strong>Fidelidade</strong><small>Progresso e benefícios</small></span>
            <b aria-hidden="true">›</b>
          </button>
        </div>

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
          <div className={styles.sectionHead}>
            <div><span>ENTREGA</span><strong>Meus endereços</strong></div>
            <small>Carteira preparada</small>
          </div>

          <button className={styles.addressCard} data-empty={!hasSavedAddress} type="button" onClick={() => setAddressOpen((value) => !value)}>
            <span className={styles.addressIcon} aria-hidden="true">⌂</span>
            <span className={styles.addressCopy}>
              <span className={styles.addressTags}>
                <b>Casa</b>
                {hasSavedAddress && <em>Padrão</em>}
              </span>
              <strong>{addressLine}</strong>
              <small>{addressMeta}</small>
            </span>
            <b className={styles.chevron} aria-hidden="true">{addressOpen ? "⌃" : "›"}</b>
          </button>

          {addressOpen && (
            <div className={styles.addressEditor}>
              <div className={styles.editorTitle}>
                <div><span>CASA</span><strong>Endereço padrão</strong></div>
                <small>Abra somente quando quiser consultar ou editar.</small>
              </div>

              <div className={styles.cepRow}>
                <input value={cep} onChange={(event) => setCep(formatCEPBR(event.target.value))} onBlur={() => { if (digits(cep).length === 8 && !street.trim()) void searchCep(); }} inputMode="numeric" autoComplete="postal-code" placeholder="CEP" />
                <button type="button" onClick={() => void searchCep()} disabled={searchingCep}>{searchingCep ? "Buscando…" : "Buscar CEP"}</button>
              </div>

              <label className={styles.label}>Rua<input value={street} onChange={(event) => setStreet(event.target.value)} readOnly={!manualAddress && Boolean(street)} className={!manualAddress && street ? styles.readonly : ""} autoComplete="address-line1" placeholder="Rua" /></label>

              <div className={styles.twoColumns}>
                <label className={styles.label}>Número<input value={number} onChange={(event) => setNumber(event.target.value)} inputMode="numeric" placeholder="Nº" /></label>
                <label className={styles.label}>Bairro<input value={district} onChange={(event) => setDistrict(event.target.value)} readOnly={!manualAddress && Boolean(district)} className={!manualAddress && district ? styles.readonly : ""} placeholder="Bairro" /></label>
              </div>

              <label className={styles.label}>Complemento <span>(opcional)</span><input value={complement} onChange={(event) => setComplement(event.target.value)} autoComplete="address-line2" placeholder="Apto, bloco, fundos…" /></label>
              <label className={styles.label}>Referência <span>(opcional)</span><input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Ex.: portão preto, ao lado da praça" /></label>

              <div className={styles.addressEditorActions}>
                <button className={styles.manualButton} type="button" onClick={() => setManualAddress((value) => !value)}>
                  {manualAddress ? "Usar endereço do CEP" : "Editar rua e bairro"}
                </button>
                <button className={styles.save} type="button" onClick={() => void save()} disabled={!canSave}>
                  {saving ? "Salvando…" : "Salvar endereço"}
                </button>
              </div>
              <p className={styles.futureDelete}>Editar e excluir cada endereço será habilitado quando ativarmos a carteira múltipla.</p>
            </div>
          )}

          <button className={styles.newAddress} type="button" disabled>
            <span><b>+</b><strong>Adicionar novo endereço</strong></span>
            <small>Em breve</small>
          </button>
        </section>

        <button className={styles.logout} type="button" onClick={() => void logout()} disabled={saving}>Sair da conta</button>
        <p className={styles.privacy}>Seus dados salvos agilizam seus próximos pedidos.</p>
      </div>
    </ModalBase>
  );
}
