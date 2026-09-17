"use client";
import { useEffect, useState } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DEFAULT_COMMERCIAL_SETTINGS, getCommercialSettings, type CommercialSettings } from "@/lib/commercialSettings";
import styles from "./FreeDeliveryAdmin.module.css";

export function FreeDeliveryAdmin() {
  const [draft, setDraft] = useState<CommercialSettings>(DEFAULT_COMMERCIAL_SETTINGS);
  const [districts, setDistricts] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => { void getCommercialSettings().then((value) => {
    setDraft(value); setDistricts(value.freeNeighborhoods.join("\n"));
  }).catch(() => setMessage("Não foi possível carregar a promoção de entrega.")); }, []);
  const save = async () => {
    setSaving(true); setMessage("");
    try {
      const freeNeighborhoods = [...new Set(districts.split(/[\n,;]+/).map((v) => v.trim()).filter(Boolean))].slice(0,100);
      const next = {...draft, globalMinimum: Math.max(0, Number(draft.globalMinimum)||0), neighborhoodMinimum: Math.max(0, Number(draft.neighborhoodMinimum)||0), freeNeighborhoods};
      await setDoc(doc(db,"settings","commercial"), {...next,schemaVersion:1,updatedAt:serverTimestamp()},{merge:true});
      setDraft(next); setDistricts(freeNeighborhoods.join("\n")); setMessage("Promoção de entrega atualizada.");
    } catch (error) { console.error(error); setMessage("Não foi possível salvar a promoção de entrega."); }
    finally { setSaving(false); }
  };
  return <section className={styles.card}>
    <div className={styles.head}><div><span>ENTREGA GRÁTIS</span><strong>Regra comercial</strong></div><label><input type="checkbox" checked={draft.freeDeliveryEnabled} onChange={(e)=>setDraft(v=>({...v,freeDeliveryEnabled:e.target.checked}))}/> Ativa</label></div>
    <p>Configure o mínimo geral e bairros com regra especial. Sem configuração, o comportamento seguro continua em R$ 80.</p>
    <div className={styles.grid}>
      <label><span>Mínimo geral (R$)</span><input inputMode="decimal" value={draft.globalMinimum} onChange={(e)=>setDraft(v=>({...v,globalMinimum:Number(e.target.value.replace(",","."))||0}))}/></label>
      <label><span>Mínimo nos bairros selecionados (R$)</span><input inputMode="decimal" value={draft.neighborhoodMinimum} onChange={(e)=>setDraft(v=>({...v,neighborhoodMinimum:Number(e.target.value.replace(",","."))||0}))}/></label>
    </div>
    <label className={styles.full}><span>Bairros com regra especial · um por linha</span><textarea rows={5} value={districts} onChange={(e)=>setDistricts(e.target.value)} placeholder={"Jardim Quebec\nCentro\nCaramuru"}/></label>
    <small>Use 0 no mínimo especial para deixar os bairros selecionados com entrega grátis independentemente do subtotal.</small>
    {message && <div className={styles.feedback}>{message}</div>}
    <button type="button" disabled={saving} onClick={()=>void save()}>{saving?"Salvando…":"Salvar regra de entrega"}</button>
  </section>;
}
