"use client";
import { useMemo, useState } from "react";
import { BarChart3, Image as ImageIcon, Tags, Layers3 } from "lucide-react";
import type { Product } from "@/data/products";
import type { CatalogCategory } from "@/lib/catalogCategories";
import { summarizeCatalogConversion } from "@/lib/catalogConversionSummary";
import styles from "./CatalogConversionPulse.module.css";

/** Painel agregado e somente leitura; auditoria detalhada permanece no CatalogQualityPanel. */
export function CatalogConversionPulse({products,categories,source}:{products:Product[];categories:CatalogCategory[];source:string}){
  const report=useMemo(()=>summarizeCatalogConversion(products,categories),[products,categories]);
  const [copyStatus,setCopyStatus]=useState<"idle"|"done"|"failed">("idle");
  const copySnapshot=async()=>{
    const lines=["Da Familia Lanches — Diagnostico editorial (nao representa vendas)",
      `Visiveis: ${report.visible}; fora das categorias: ${report.hidden}`,
      `Com foto: ${report.withImage}/${report.visible}; descricoes: ${report.withDescription}/${report.visible}`,
      `Ofertas validas: ${report.activeOffers}; combos integros: ${report.completeBundles}/${report.bundleCount}`,
      ...report.suggestions.map(text=>`- ${text}`)];
    try{await navigator.clipboard.writeText(lines.join("\n"));setCopyStatus("done")}
    catch{setCopyStatus("failed")}
  };
  const rate=(n:number)=>report.visible ? `${Math.round(n/report.visible*100)}%` : "—";
  const cards=[
    {key:"images",label:"Com foto",value:rate(report.withImage),detail:`${report.withImage} de ${report.visible}`,Icon:ImageIcon},
    {key:"descriptions",label:"Descrição completa",value:rate(report.withDescription),detail:"35+ caracteres",Icon:BarChart3},
    {key:"offers",label:"Ofertas válidas",value:String(report.activeOffers),detail:"Desconto verificável",Icon:Tags},
    {key:"bundles",label:"Combos íntegros",value:`${report.completeBundles}/${report.bundleCount}`,detail:"Componentes disponíveis",Icon:Layers3},
  ];
  return <section className={styles.root} aria-label="Panorama de apresentação comercial">
    <header className={styles.header}>
      <div><span>APRESENTAÇÃO COMERCIAL</span><strong>Prontidão do cardápio</strong><small>Indicadores calculados dos dados já carregados. Não são métricas de conversão ou vendas.</small></div>
      <b>{source==="hybrid"?"Catálogo conectado":"Base de contingência"}</b>
    </header>
    <div className={styles.r36CopyRow}><small>Resumo editorial agregado, sem dados de clientes ou historico de pedidos.</small><button type="button" onClick={()=>void copySnapshot()}>Copiar diagnostico</button></div>
    {copyStatus!=="idle"&&<small className={styles.r36CopyResult} role="status">{copyStatus==="done"?"Resumo copiado. Verifique antes de compartilhar.":"Nao foi possivel copiar automaticamente. Confira a permissao do navegador."}</small>}
    <div className={styles.metrics}>{cards.map(({key,label,value,detail,Icon})=><div className={styles.metric} key={key}><Icon size={17} aria-hidden="true"/><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>)}</div>
    <details className={styles.details}><summary>{report.suggestions.length?`${report.suggestions.length} pontos de revisão editorial`:`Nenhuma recomendação editorial neste recorte`} <span aria-hidden="true">›</span></summary>
      {report.suggestions.length?<ul>{report.suggestions.map(text=><li key={text}>{text}</li>)}</ul>:<p>As informações básicas deste recorte foram identificadas. Continue usando a auditoria detalhada do catálogo para conferir regras e adicionais.</p>}
      <p>Somente leitura. Nenhum produto, preço ou disponibilidade será alterado por esta análise.</p>
    </details>
  </section>;
}
// DFL-R36-CATALOG-COPY
