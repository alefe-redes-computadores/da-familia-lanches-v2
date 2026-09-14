"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  DEFAULT_REWARDS_CONFIG,
  normalizeRewardsConfig,
  REWARDS_CONFIG_COLLECTION,
  REWARDS_CONFIG_ID,
  type RewardDiscountType,
} from "@/lib/rewards";
import styles from "./RewardsAdmin.module.css";

const numberValue = (value: string, fallback: number) => {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function RewardsAdmin() {
  const [active, setActive] = useState(false);
  const [title, setTitle] = useState(DEFAULT_REWARDS_CONFIG.title);
  const [description, setDescription] = useState(DEFAULT_REWARDS_CONFIG.description);
  const [everyOrders, setEveryOrders] = useState(String(DEFAULT_REWARDS_CONFIG.everyOrders));
  const [discountType, setDiscountType] = useState<RewardDiscountType>("fixed");
  const [discountValue, setDiscountValue] = useState(String(DEFAULT_REWARDS_CONFIG.discountValue));
  const [minOrder, setMinOrder] = useState(String(DEFAULT_REWARDS_CONFIG.minOrder));
  const [expiresDays, setExpiresDays] = useState(String(DEFAULT_REWARDS_CONFIG.expiresDays));
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => onSnapshot(
    doc(db, REWARDS_CONFIG_COLLECTION, REWARDS_CONFIG_ID),
    (snapshot) => {
      const config = snapshot.exists() ? normalizeRewardsConfig(snapshot.data()) : DEFAULT_REWARDS_CONFIG;
      setActive(config.active);
      setTitle(config.title);
      setDescription(config.description);
      setEveryOrders(String(config.everyOrders));
      setDiscountType(config.discountType);
      setDiscountValue(String(config.discountValue));
      setMinOrder(String(config.minOrder));
      setExpiresDays(String(config.expiresDays));
    },
  ), []);

  const save = async () => {
    setSaving(true);
    setFeedback("");
    try {
      await setDoc(doc(db, REWARDS_CONFIG_COLLECTION, REWARDS_CONFIG_ID), {
        active,
        title: title.trim() || DEFAULT_REWARDS_CONFIG.title,
        description: description.trim() || DEFAULT_REWARDS_CONFIG.description,
        everyOrders: Math.max(1, Math.floor(numberValue(everyOrders, DEFAULT_REWARDS_CONFIG.everyOrders))),
        discountType,
        discountValue: Math.max(0.01, numberValue(discountValue, DEFAULT_REWARDS_CONFIG.discountValue)),
        minOrder: Math.max(0, numberValue(minOrder, 0)),
        expiresDays: Math.max(0, Math.floor(numberValue(expiresDays, DEFAULT_REWARDS_CONFIG.expiresDays))),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setFeedback("Campanha salva.");
    } catch (error) {
      console.error(error);
      setFeedback("Não foi possível salvar a campanha.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <section className={styles.statusCard} data-active={active}>
        <div><span>CAMPANHA</span><strong>{active ? "Fidelidade ativa" : "Fidelidade pausada"}</strong><p>Somente pedidos marcados como Finalizado contam para o próximo marco.</p></div>
        <button type="button" onClick={() => setActive((value) => !value)}>{active ? "Pausar" : "Ativar"}</button>
      </section>

      <section className={styles.card}>
        <label><span>Nome da campanha</span><input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label><span>Descrição para o cliente</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} /></label>

        <div className={styles.grid}>
          <label><span>A cada quantos pedidos finalizados?</span><input value={everyOrders} onChange={(event) => setEveryOrders(event.target.value)} inputMode="numeric" /></label>
          <label><span>Tipo de benefício</span><select value={discountType} onChange={(event) => setDiscountType(event.target.value as RewardDiscountType)}><option value="fixed">Valor em R$</option><option value="percent">Porcentagem</option></select></label>
          <label><span>{discountType === "percent" ? "Desconto (%)" : "Desconto (R$)"}</span><input value={discountValue} onChange={(event) => setDiscountValue(event.target.value)} inputMode="decimal" /></label>
          <label><span>Pedido mínimo (R$)</span><input value={minOrder} onChange={(event) => setMinOrder(event.target.value)} inputMode="decimal" /></label>
          <label><span>Validade após ganhar (dias)</span><input value={expiresDays} onChange={(event) => setExpiresDays(event.target.value)} inputMode="numeric" /></label>
        </div>

        <div className={styles.notice}><strong>Regra operacional</strong><p>A recompensa é criada quando o Admin conclui o pedido que fecha um marco. O documento é único por marco e não duplica o benefício.</p></div>
        {feedback && <div className={styles.feedback}>{feedback}</div>}
        <button className={styles.save} type="button" onClick={() => void save()} disabled={saving}>{saving ? "Salvando…" : "Salvar campanha"}</button>
      </section>
    </div>
  );
}
