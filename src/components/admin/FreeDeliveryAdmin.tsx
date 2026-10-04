"use client";
import { useEffect, useState } from "react";
import { Truck, Save } from "lucide-react";
import { haptic } from "@/lib/haptics";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { DEFAULT_COMMERCIAL_SETTINGS, getCommercialSettings, type CommercialSettings } from "@/lib/commercialSettings";
import styles from "./FreeDeliveryAdmin.module.css";

const moneyTyping = (value: string) => {
  const digits=value.replace(/\D/g,"").slice(0,10);
  return digits ? (Number(digits)/100).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2}) : "";
};
const moneyNumber = (value: string) => {
  const normalized=value.replace(/\./g,"").replace(",",".").replace(/[^\d.]/g,"");
  const parsed=Number(normalized);
  return Number.isFinite(parsed)?Math.max(0,parsed):0;
};
const moneyText = (value: number) =>
  Number(value||0).toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});

export function FreeDeliveryAdmin() {
  const [draft, setDraft] = useState<CommercialSettings>(DEFAULT_COMMERCIAL_SETTINGS);
  const [districts, setDistricts] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [globalMinimumText,setGlobalMinimumText]=useState("");
  const [neighborhoodMinimumText,setNeighborhoodMinimumText]=useState("");
  useEffect(() => { void getCommercialSettings().then((value) => {
    setDraft(value); setDistricts(value.freeNeighborhoods.join("\n")); setGlobalMinimumText(moneyText(value.globalMinimum)); setNeighborhoodMinimumText(moneyText(value.neighborhoodMinimum));
  }).catch(() => setMessage("Não foi possível carregar a promoção de entrega.")); }, []);
  const save = async () => {
    setSaving(true); setMessage("");
    try {
      const freeNeighborhoods = [...new Set(districts.split(/[\n,;]+/).map((v) => v.trim()).filter(Boolean))].slice(0,100);
      const next = {...draft, globalMinimum: moneyNumber(globalMinimumText), neighborhoodMinimum: moneyNumber(neighborhoodMinimumText), freeNeighborhoods};
      await setDoc(doc(db,"settings","commercial"), {...next,schemaVersion:1,updatedAt:serverTimestamp()},{merge:true});
      setDraft(next); setDistricts(freeNeighborhoods.join("\n")); setMessage("Promoção de entrega atualizada."); haptic("success");
    } catch (error) { console.error(error); setMessage("Não foi possível salvar a promoção de entrega."); haptic("error"); }
    finally { setSaving(false); }
  };
  return <section className={styles.card}>
    <div className={styles.head}><div><span>ENTREGA GRÁTIS</span><strong><Truck size={17}/>Regra comercial</strong></div><label><input type="checkbox" checked={draft.freeDeliveryEnabled} onChange={(e)=>{haptic("step");setDraft(v=>({...v,freeDeliveryEnabled:e.target.checked}))}}/> Ativa</label></div>
    <p>Configure o mínimo geral e bairros com regra especial. O carrinho usa esta mesma configuração para mostrar quanto falta para o benefício.</p>
    <div className={styles.preview} data-active={draft.freeDeliveryEnabled}><span>PRÉVIA DA CAMPANHA</span><strong>{draft.freeDeliveryEnabled ? `Frete grátis a partir de R$ ${Number(draft.globalMinimum || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "Campanha pausada"}</strong><i /></div>
    <div className={styles.grid}>
      <label><span>Mínimo geral (R$)</span><input inputMode="decimal" value={globalMinimumText} onChange={(e)=>setGlobalMinimumText(moneyTyping(e.target.value))} onBlur={()=>setGlobalMinimumText(moneyText(moneyNumber(globalMinimumText)))}/></label>
      <label><span>Mínimo nos bairros selecionados (R$)</span><input inputMode="decimal" value={neighborhoodMinimumText} onChange={(e)=>setNeighborhoodMinimumText(moneyTyping(e.target.value))} onBlur={()=>setNeighborhoodMinimumText(moneyText(moneyNumber(neighborhoodMinimumText)))}/></label>
    </div>
    <label className={styles.full}><span>Bairros com regra especial · um por linha</span><textarea rows={5} value={districts} onChange={(e)=>setDistricts(e.target.value)} placeholder={"Jardim Quebec\nCentro\nCaramuru"}/></label>
    <small>Use 0 no mínimo especial para deixar os bairros selecionados com entrega grátis independentemente do subtotal.</small>
    {message && <div className={styles.feedback}>{message}</div>}
    <button type="button" disabled={saving} onClick={()=>void save()}>{saving?"Salvando…":<><Save size={15}/>Salvar regra de entrega</>}</button>
  </section>;
}
