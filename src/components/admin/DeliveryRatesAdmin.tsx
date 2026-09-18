"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getDefaultDeliveryFee, SAFE_DEFAULT_DELIVERY_FEE, type DeliveryRate } from "@/lib/deliveryRates";
import styles from "./DeliveryRatesAdmin.module.css";

type EditableRate = DeliveryRate & { _key: string };
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const parseMoney = (value: string | number | undefined) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const parsed = Number(normalized.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

const moneyDraft = (value: string | number | undefined) =>
  parseMoney(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moneyTyping = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  return digits ? (Number(digits) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
};

export function DeliveryRatesAdmin() {
  const [rates, setRates] = useState<EditableRate[]>([]);
  const [defaultFee, setDefaultFee] = useState(String(SAFE_DEFAULT_DELIVERY_FEE).replace(".", ","));
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [newFee, setNewFee] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [removeConfirmKey, setRemoveConfirmKey] = useState("");

  const load = async () => {
    setLoading(true);
    setMessage("");
    try {
      const [snap, fallback] = await Promise.all([
        getDoc(doc(db, "TaxasDeEntrega", "bairros", "lista", "tabela")),
        getDefaultDeliveryFee(),
      ]);
      const rateData = snap.data()?.data;
      const list = Array.isArray(rateData) ? (rateData as DeliveryRate[]) : [];
      setRates(list.map((item, index) => ({ ...item, _key: `${normalize(String(item.nome ?? ""))}-${index}` })));
      setDefaultFee(moneyDraft(fallback));
    } catch (error) {
      console.error("Erro ao carregar taxas", error);
      setMessage("Não foi possível carregar a tabela de bairros.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const sorted = useMemo(() => rates
    .filter((item) => !search.trim() || normalize(String(item.nome ?? "")).includes(normalize(search)))
    .sort((a, b) => String(a.nome ?? "").localeCompare(String(b.nome ?? ""), "pt-BR")), [rates, search]);

  const invalidCount = rates.filter((item) => !String(item.nome ?? "").trim() || !Number.isFinite(Number(item.taxa)) || Number(item.taxa) < 0).length;

  const updateRate = (key: string, patch: Partial<DeliveryRate>) =>
    setRates((current) => current.map((item) => item._key === key ? { ...item, ...patch } : item));

  const removeRate = (key: string, name: string) => {
    if (removeConfirmKey !== key) {
      setRemoveConfirmKey(key);
      setMessage(`Toque novamente em excluir para remover ${name}.`);
      return;
    }
    setRates((current) => current.filter((item) => item._key !== key));
    setRemoveConfirmKey("");
    setMessage(`${name} removido da edição. Salve para publicar.`);
  };

  const addRate = () => {
    const name = newName.trim();
    const fee = parseMoney(newFee);
    if (!name) return setMessage("Informe o nome do bairro.");
    if (rates.some((item) => normalize(String(item.nome ?? "")) === normalize(name))) return setMessage("Esse bairro já está cadastrado.");
    setRates((current) => [...current, { nome: name, taxa: fee, _key: `new-${Date.now()}` }]);
    setNewName(""); setNewFee(""); setMessage("Bairro adicionado à edição. Salve para publicar.");
  };

  const save = async () => {
    const clean = rates.map(({ _key, ...item }) => ({ ...item, nome: String(item.nome ?? "").trim(), taxa: parseMoney(item.taxa) })).filter((item) => item.nome);
    const seen = new Set<string>();
    for (const item of clean) {
      const key = normalize(item.nome || "");
      if (seen.has(key)) return setMessage(`Bairro duplicado: ${item.nome}.`);
      seen.add(key);
    }
    const fallback = parseMoney(defaultFee);
    setSaving(true); setMessage("");
    try {
      await Promise.all([
        setDoc(doc(db, "TaxasDeEntrega", "bairros", "lista", "tabela"), { data: clean, updatedAt: serverTimestamp() }, { merge: true }),
        setDoc(doc(db, "settings", "delivery"), { schemaVersion: 1, defaultFee: fallback, updatedAt: serverTimestamp() }, { merge: true }),
      ]);
      setRates(clean.map((item, index) => ({ ...item, _key: `${normalize(item.nome || "")}-${index}` })));
      setDefaultFee(moneyDraft(fallback));
      setMessage("Taxas de entrega publicadas.");
    } catch (error) {
      console.error("Erro ao salvar taxas", error);
      setMessage("Não foi possível salvar as taxas.");
    } finally { setSaving(false); }
  };

  return <section className={styles.card}>
    <div className={styles.head}>
      <div><span>ENTREGA & FRETE</span><strong>Tabela de bairros</strong><p>A mesma tabela usada pelo checkout.</p></div>
      <b>{rates.length} bairros</b>
    </div>

    <div className={styles.summary}>
      <label><span>TAXA PADRÃO / FALLBACK</span><div className={styles.moneyInput}><i>R$</i><input inputMode="decimal" value={defaultFee} onChange={(e) => setDefaultFee(moneyTyping(e.target.value))} onBlur={() => setDefaultFee(moneyDraft(defaultFee))} placeholder="0,00" /></div><small>Usada quando o bairro não está na tabela ou a consulta falha.</small></label>
      <div className={styles.health} data-warning={invalidCount > 0}><span>QUALIDADE DA TABELA</span><strong>{invalidCount ? `${invalidCount} item(ns) para revisar` : "Tudo certo"}</strong><small>{invalidCount ? "Há nome ou taxa inválida." : "Bairros prontos para cobrança."}</small></div>
    </div>

    <div className={styles.toolbar}>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar bairro…" />
      <span>{sorted.length} exibidos</span>
    </div>

    {loading ? <div className={styles.empty}>Carregando tabela…</div> : (
      <div className={styles.list}>
        {sorted.map((item) => <div className={styles.row} key={item._key}>
          <input className={styles.name} value={String(item.nome ?? "")} onChange={(e) => updateRate(item._key, { nome: e.target.value })} aria-label="Nome do bairro" />
          <div className={styles.rate}><span>R$</span><input inputMode="decimal" value={typeof item.taxa === "string" ? item.taxa : moneyDraft(item.taxa)} onChange={(e) => updateRate(item._key, { taxa: moneyTyping(e.target.value) })} onBlur={() => updateRate(item._key, { taxa: moneyDraft(item.taxa) })} aria-label={`Taxa de ${item.nome ?? "bairro"}`} /></div>
          <button type="button" className={styles.remove} data-confirm={removeConfirmKey===item._key} onClick={() => removeRate(item._key, String(item.nome ?? "Bairro"))} aria-label={`Remover ${item.nome ?? "bairro"}`}>{removeConfirmKey===item._key ? "Confirmar" : "Excluir"}</button>
        </div>)}
        {!sorted.length && <div className={styles.empty}>Nenhum bairro encontrado.</div>}
      </div>
    )}

    <div className={styles.add}>
      <div><span>NOVO BAIRRO</span><strong>Adicionar à tabela</strong></div>
      <div className={styles.addFields}><input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome do bairro" /><div className={styles.rate}><span>R$</span><input inputMode="decimal" value={newFee} onChange={(e) => setNewFee(moneyTyping(e.target.value))} onBlur={() => newFee && setNewFee(moneyDraft(newFee))} placeholder="0,00" /></div><button type="button" onClick={addRate}>Adicionar</button></div>
    </div>

    {message && <div className={styles.feedback}>{message}</div>}
    <button type="button" className={styles.save} disabled={saving || loading} onClick={() => void save()}>{saving ? "Publicando…" : `Salvar tabela · fallback ${money(parseMoney(defaultFee))}`}</button>
  </section>;
}
