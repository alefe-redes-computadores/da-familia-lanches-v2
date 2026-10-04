"use client";

import { useEffect, useState } from "react";
import { Gift, Pause, Play, Save } from "lucide-react";
import { getDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  DEFAULT_REWARDS_CONFIG,
  normalizeRewardsConfig,
  REWARDS_CONFIG_COLLECTION,
  REWARDS_CONFIG_ID,
  type RewardDiscountType,
} from "@/lib/rewards";
import styles from "./RewardsAdmin.module.css";

import { haptic } from "@/lib/haptics";
const numberValue = (value: string, fallback: number) => {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
};
const moneyTyping = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  return digits ? (Number(digits) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
};
const moneyDraft = (value: string) =>
  numberValue(value, 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });


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

  useEffect(() => {
    let alive = true;

    void getDoc(
      doc(
        db,
        REWARDS_CONFIG_COLLECTION,
        REWARDS_CONFIG_ID,
      ),
    )
      .then((snapshot) => {
        if (!alive) return;

        const config = snapshot.exists()
          ? normalizeRewardsConfig(snapshot.data())
          : DEFAULT_REWARDS_CONFIG;

        setActive(config.active);
        setTitle(config.title);
        setDescription(config.description);
        setEveryOrders(String(config.everyOrders));
        setDiscountType(config.discountType);
        setDiscountValue(String(config.discountValue));
        setMinOrder(String(config.minOrder));
        setExpiresDays(String(config.expiresDays));
      })
      .catch((error) => {
        console.error(
          "[admin-rewards] load",
          error,
        );

        if (alive) {
          setFeedback(
            "Não foi possível carregar a campanha.",
          );
        }
      });

    return () => {
      alive = false;
    };
  }, []);

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
      haptic("success");
    } catch (error) {
      console.error(error);
      setFeedback("Não foi possível salvar a campanha.");
      haptic("error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <section className={styles.statusCard} data-active={active}>
        <div><span>CAMPANHA</span><strong><Gift size={18}/>{active ? "Fidelidade ativa" : "Fidelidade pausada"}</strong><p>Somente pedidos marcados como Finalizado contam para o próximo marco.</p></div>
        <button type="button" onClick={() => { haptic("step"); setActive((value) => !value); }}>{active ? <><Pause size={15}/>Pausar</> : <><Play size={15}/>Ativar</>}</button>
      </section>

      <section className={styles.card}>
        <label><span>Nome da campanha</span><input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label><span>Descrição para o cliente</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} /></label>

        <div className={styles.grid}>
          <label><span>A cada quantos pedidos finalizados?</span><input value={everyOrders} onChange={(event) => setEveryOrders(event.target.value)} inputMode="numeric" /></label>
          <label><span>Tipo de benefício</span><select value={discountType} onChange={(event) => setDiscountType(event.target.value as RewardDiscountType)}><option value="fixed">Valor em R$</option><option value="percent">Porcentagem</option></select></label>
          <label><span>{discountType === "percent" ? "Desconto (%)" : "Desconto (R$)"}</span><input value={discountValue} onChange={(event) => setDiscountValue(discountType === "fixed" ? moneyTyping(event.target.value) : event.target.value.replace(/[^\d,.]/g, ""))} onBlur={() => discountType === "fixed" && setDiscountValue(moneyDraft(discountValue))} inputMode="decimal" /></label>
          <label><span>Pedido mínimo (R$)</span><input value={minOrder} onChange={(event) => setMinOrder(moneyTyping(event.target.value))} onBlur={() => setMinOrder(moneyDraft(minOrder))} inputMode="decimal" /></label>
          <label><span>Validade após ganhar (dias)</span><input value={expiresDays} onChange={(event) => setExpiresDays(event.target.value)} inputMode="numeric" /></label>
        </div>

        <div className={styles.notice}><strong>Regra operacional</strong><p>A recompensa é criada quando o Admin conclui o pedido que fecha um marco. O documento é único por marco e não duplica o benefício.</p></div>
        {feedback && <div className={styles.feedback}>{feedback}</div>}
        <button className={styles.save} type="button" onClick={() => void save()} disabled={saving}>{saving ? "Salvando…" : <><Save size={15}/>Salvar campanha</>}</button>
      </section>
    </div>
  );
}
