"use client";
import { useEffect, useRef, useState } from "react";
import styles from "./AddressMapPreview.module.css";

type PreviewResponse = {ok?:boolean;state?:"confirmed"|"review"|"not_found";message?:string;distanceKm?:number;code?:string};
/** Confirmação geográfica opcional; jamais salva dados nem substitui a validação de frete/pedido. */
export function AddressMapPreview({district,street,number}:{district:string;street:string;number:string}) {
  const [result,setResult]=useState<PreviewResponse|null>(null);
  const [busy,setBusy]=useState(false);
  const controller=useRef<AbortController|null>(null);
  const enabled=process.env.NEXT_PUBLIC_DFL_ADDRESS_PREVIEW_ENABLED === "true";
  useEffect(()=>{
    controller.current?.abort();controller.current=null;
    setResult(null);setBusy(false);
    return ()=>{controller.current?.abort();};
  },[district,street,number]);
  if(!enabled)return null;
  const ready=district.trim().length>=3 && street.trim().length>=4 && Boolean(number.trim());
  const query=async()=>{
    if(!ready||busy)return;
    const abort=new AbortController();controller.current=abort;
    setBusy(true);setResult(null);
    const timeout=window.setTimeout(()=>abort.abort(),8100);
    try {
      const res=await fetch("/api/address/preview",{
        method:"POST",headers:{"content-type":"application/json"},cache:"no-store",
        body:JSON.stringify({district:district.trim(),street:street.trim(),number:number.trim()}),signal:abort.signal,
      });
      const body=await res.json() as PreviewResponse;
      if(abort.signal.aborted)return;
      setResult(res.ok&&body.ok?body:{ok:false,message:body.code==="RATE_LIMITED"?
        "Muitas consultas seguidas. Confira o endereço manualmente ou tente mais tarde.":
        "Conferência por mapa indisponível. Você pode continuar normalmente pelo endereço manual."});
    } catch {
      if(!abort.signal.aborted)setResult({ok:false,message:"Não foi possível conferir agora. Confira rua, bairro e número e continue manualmente."});
    } finally {window.clearTimeout(timeout);if(controller.current===abort){controller.current=null;setBusy(false);}}
  };
  return <section className={styles.root} aria-label="Conferência opcional do endereço no mapa">
    <button type="button" disabled={!ready||busy} onClick={()=>void query()}>
      {busy?"Conferindo endereço…":"Conferir endereço no mapa (opcional)"}
    </button>
    <small>Apenas ajuda na escrita; não altera o frete, a cobertura ou o envio do pedido.</small>
    {result&&<div className={styles.result} data-status={result.state||"unavailable"} role="status">
      <strong>{result.state==="confirmed"?"Localização encontrada":result.state==="review"?"Endereço precisa de atenção":result.state==="not_found"?"Não confirmado no mapa":"Busca indisponível"}</strong>
      <p>{result.message}</p>
      {typeof result.distanceKm==="number" && Number.isFinite(result.distanceKm) && <small>Rota aproximada: {result.distanceKm.toLocaleString("pt-BR")} km pelas ruas. Não é cotação de frete.</small>}
    </div>}
  </section>;
}
