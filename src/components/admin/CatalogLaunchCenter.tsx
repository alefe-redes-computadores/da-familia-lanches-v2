"use client";
import {useDeferredValue,useMemo,useState} from "react";
import {AlertCircle,CheckCircle2,ChevronDown,ClipboardCheck,Copy,Search,ShieldAlert,TrendingUp} from "lucide-react";
import type {Product} from "@/data/products";
import type {Addon} from "@/data/addons";
import type {CatalogCategory} from "@/lib/catalogCategories";
import {inspectCatalogLaunch,launchReportText,type LaunchSeverity} from "@/lib/catalogLaunchAudit";
import styles from "./CatalogLaunchCenter.module.css";

type Props={products:Product[];addons:Addon[];categories:CatalogCategory[];source:string;onEdit:(product:Product)=>void};
type Filter="all"|LaunchSeverity;
const label:Record<LaunchSeverity,string>={critical:"Crítico",warning:"Atenção",opportunity:"Melhoria"};
export function CatalogLaunchCenter({products,addons,categories,source,onEdit}:Props){
 const [open,setOpen]=useState(false);
 const [filter,setFilter]=useState<Filter>("all");
 const [term,setTerm]=useState("");
 const [showMore,setShowMore]=useState(false);
 const [feedback,setFeedback]=useState("");
 const query=useDeferredValue(term);
 const report=useMemo(()=>inspectCatalogLaunch(products,addons,categories),[products,addons,categories]);
 const byId=useMemo(()=>new Map(products.map(p=>[p.id,p])),[products]);
 const normalized=query.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR").trim();
 const filtered=useMemo(()=>report.issues.filter(issue=>{
   if(filter!=="all"&&issue.severity!==filter)return false;
   if(!normalized)return true;
   const match=`${issue.productName} ${issue.productId} ${issue.title} ${issue.category}`.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR");
   return match.includes(normalized);
 }),[filter,normalized,report.issues]);
 const visible=showMore?filtered:filtered.slice(0,14);
 const copy=async()=>{
  try{if(!navigator.clipboard?.writeText)throw new Error("clipboard unavailable");await navigator.clipboard.writeText(launchReportText(report,source));setFeedback("Diagnóstico copiado. Nenhum dado foi enviado.");}
  catch{setFeedback("Não foi possível copiar automaticamente. Você pode revisar os alertas nesta tela.");}
 };
 return <section className={styles.root} aria-label="Central de prontidão do catálogo">
  <button type="button" className={styles.heading} aria-expanded={open} onClick={()=>setOpen(value=>!value)}>
   <span className={styles.logo}><ClipboardCheck size={20}/></span>
   <span className={styles.headingText}><strong>Prontidão do cardápio</strong><small>Revisão de lançamento · sem alterar produtos</small></span>
   <span className={styles.headMetric} data-critical={report.critical>0}>{report.critical?`${report.critical} críticos`:"Sem críticos"}</span>
   <ChevronDown size={18} data-open={open} className={styles.chevron}/>
  </button>
  {open&&<div className={styles.content}>
   <div className={styles.intro}><div><strong>Antes de abrir ou divulgar</strong><p>Confira se combos, preços, fotos, categorias e personalizações estão coerentes. Os alertas utilizam apenas os dados já carregados nesta página.</p></div><span className={styles.score} aria-label={`Nota indicativa ${report.score} de 100`}><b>{report.score}</b><small>/100*</small></span></div>
   <div className={styles.metrics}>
    <div data-tone="critical"><ShieldAlert size={16}/><b>{report.critical}</b><span>Críticos</span></div>
    <div data-tone="warning"><AlertCircle size={16}/><b>{report.warnings}</b><span>Atenções</span></div>
    <div data-tone="opportunity"><TrendingUp size={16}/><b>{report.opportunities}</b><span>Melhorias</span></div>
    <div data-tone="ok"><CheckCircle2 size={16}/><b>{report.visible}</b><span>Visíveis</span></div>
   </div>
   {source!=="hybrid"&&<p className={styles.warning} role="status">Catálogo remoto não confirmado. Resultado baseado no fallback local: não use esta nota para liberar alterações comerciais.</p>}
   {report.critical>0&&<p className={styles.warning}>Há itens que merecem revisão antes de divulgar o cardápio. Isso não significa que um deploy esteja bloqueado automaticamente.</p>}
   <div className={styles.toolbar}><div className={styles.filters} role="group" aria-label="Filtrar alertas">
    {([['all','Todos'],['critical','Críticos'],['warning','Atenção'],['opportunity','Melhorias']] as const).map(([id,name])=><button type="button" key={id} data-active={filter===id} onClick={()=>{setFilter(id);setShowMore(false);}}>{name}</button>)}
   </div><label className={styles.search}><Search size={16}/><input type="search" value={term} onChange={event=>{setTerm(event.target.value);setShowMore(false);}} placeholder="Produto ou problema" aria-label="Pesquisar alertas" /></label></div>
   <div className={styles.count}>{filtered.length} alerta(s) no filtro · {report.affected} produto(s) precisam de revisão</div>
   <div className={styles.list}>{visible.map(issue=><article key={issue.id} className={styles.issue} data-severity={issue.severity}>
    <div className={styles.issueMain}><span className={styles.chip}>{label[issue.severity]}</span><div><strong>{issue.title}</strong><small>{issue.productName} · {issue.productId}</small><p>{issue.detail}</p></div></div>
    <button type="button" onClick={()=>{const product=byId.get(issue.productId);if(product)onEdit(product);}} disabled={!byId.has(issue.productId)} aria-label={`Editar ${issue.productName}`}>Revisar produto</button>
   </article>)}{filtered.length===0&&<div className={styles.empty}><CheckCircle2 size={19}/><strong>Nenhum alerta neste filtro.</strong><span>Ainda vale conferir manualmente fotos, horários, taxas e preços.</span></div>}</div>
   {filtered.length>14&&!showMore&&<button type="button" className={styles.more} onClick={()=>setShowMore(true)}>Mostrar outros {filtered.length-14} alertas</button>}
   <div className={styles.footer}><p>*Nota heurística de triagem, não representa vendas, qualidade gastronômica ou aprovação para publicar. Nenhuma alteração é feita automaticamente.</p>
    <button type="button" onClick={()=>void copy()}><Copy size={16}/>Copiar diagnóstico</button></div>
   {feedback&&<p role="status" className={styles.feedback}>{feedback}</p>}
  </div>}
 </section>;
}
