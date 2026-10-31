"use client";

import { useEffect, useMemo, useState } from "react";
import { auth } from "@/lib/firebase";
import { useCatalog } from "@/hooks/useCatalog";
import { prepareCampaignBanner } from "@/lib/campaignImageClient";
import {
  DEFAULT_VISUAL_CAMPAIGNS, SCOPE_OPTIONS, brazilDate, campaignStatusLabel, chooseVisualCampaign,
  colorContrast, isDateISO, normalizeCampaignList, normalizeVisualCampaign,
  type CampaignPalette, type CampaignScope, type VisualCampaign
} from "@/lib/visualCampaigns";
import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronLeft, ChevronRight, Copy, Eye, ImagePlus, Monitor, PauseCircle, Plus, RotateCcw, Save, Smartphone, Sparkles, X } from "lucide-react";
import styles from "./VisualCampaignsAdmin.module.css";

type ColorKey=keyof CampaignPalette;
const COLOR_FIELDS:{key:ColorKey;title:string}[]=[
 {key:"background",title:"Fundo principal"},{key:"surface",title:"Superfícies"},
 {key:"text",title:"Texto principal"},{key:"muted",title:"Texto secundário"},
 {key:"accent",title:"Destaque"},{key:"accentText",title:"Texto do destaque"},
 {key:"button",title:"Botões"},{key:"buttonText",title:"Texto dos botões"},
 {key:"badge",title:"Etiquetas"},{key:"badgeText",title:"Texto das etiquetas"},
];
const COLORS=["#0B0B0D","#18181B","#FACC15","#EAB308","#FAFAFA","#A1A1AA","#103B2D","#C62828","#E9C46A","#FFF8ED","#09090B","#FFFFFF","#C0C0C0","#27272A","#2563EB","#1D4ED8","#166534","#000000"];
function DateDialog({value,onPick,onClose,label}:{value:string;onPick:(value:string)=>void;onClose:()=>void;label:string}){
 const [month,setMonth]=useState(()=>value.slice(0,7));
 const first=new Date(`${month}-01T12:00:00Z`);
 const count=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
 const offset=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth(),1)).getUTCDay();
 const move=(delta:number)=>{const d=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+delta,1));setMonth(d.toISOString().slice(0,7))};
 return <div className={styles.modalBackdrop} onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <div className={styles.calendarDialog} role="dialog" aria-modal="true" aria-label={`Escolher ${label}`}>
    <header><strong>{label}</strong><button type="button" aria-label="Fechar calendário" onClick={onClose}><X size={18}/></button></header>
    <div className={styles.monthNav}><button type="button" onClick={()=>move(-1)} aria-label="Mês anterior"><ChevronLeft size={18}/></button><strong>{first.toLocaleDateString("pt-BR",{timeZone:"UTC",month:"long",year:"numeric"})}</strong><button type="button" onClick={()=>move(1)} aria-label="Próximo mês"><ChevronRight size={18}/></button></div>
    <div className={styles.calendarGrid}>{["D","S","T","Q","Q","S","S"].map((v,i)=><small key={`${i}-${v}`}>{v}</small>)}
      {Array.from({length:offset},(_,i)=><span key={`empty-${i}`}/>)}
      {Array.from({length:count},(_,i)=>{
        const day=`${month}-${String(i+1).padStart(2,"0")}`;
        return <button type="button" key={day} data-selected={day===value} data-today={day===brazilDate()} onClick={()=>{onPick(day);onClose()}} aria-label={new Date(`${day}T12:00:00Z`).toLocaleDateString("pt-BR",{timeZone:"UTC",dateStyle:"full"})}>{i+1}</button>;
      })}</div>
    <button type="button" className={styles.today} onClick={()=>{onPick(brazilDate());onClose()}}>Selecionar hoje</button>
  </div>
 </div>;
}
function ColorDialog({name,value,onPick,onClose}:{name:string;value:string;onPick:(value:string)=>void;onClose:()=>void}){
 const [candidate,setCandidate]=useState(value);
 const valid=/^#[0-9a-f]{6}$/i.test(candidate);
 return <div className={styles.modalBackdrop} onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <div className={styles.colorDialog} role="dialog" aria-modal="true" aria-label={`Cor: ${name}`}>
    <header><strong>{name}</strong><button type="button" onClick={onClose} aria-label="Fechar seleção de cor"><X size={18}/></button></header>
    <p>Escolha uma cor da paleta ou digite um código hexadecimal.</p>
    <div className={styles.swatches}>{COLORS.map(c=><button key={c} type="button" style={{background:c}} aria-label={`Usar cor ${c}`} data-selected={candidate.toUpperCase()===c} onClick={()=>setCandidate(c)}/>)}</div>
    <label>Cor hexadecimal<input value={candidate} maxLength={7} onChange={e=>setCandidate(e.target.value.toUpperCase())} placeholder="#FACC15"/></label>
    <button type="button" className={styles.apply} disabled={!valid} onClick={()=>{onPick(candidate.toUpperCase());onClose()}}>Aplicar cor</button>
  </div>
 </div>;
}
const cloneCampaign=(source:VisualCampaign,nonce:number):VisualCampaign=>({...source,id:`campanha-${nonce}`,name:`Cópia de ${source.name}`,publicName:`${source.publicName} — CÓPIA`,status:"draft",priority:Math.max(0,source.priority-1),palette:{...source.palette},scopes:[...source.scopes],offerProductIds:[],exclusiveShowcase:false,bannerDesktop:"",bannerMobile:"",requiredOfferName:"",requiredOfferPrice:null});

export function VisualCampaignsAdmin(){
 const { products:catalogProducts, source:catalogSource } = useCatalog();
 const catalogOffers=useMemo(()=>catalogProducts.filter(p=>p.disponivel!==false&&typeof p.oldPrice==="number"&&p.oldPrice>p.price),[catalogProducts]);
 const [items,setItems]=useState<VisualCampaign[]>(DEFAULT_VISUAL_CAMPAIGNS);
 const [selectedId,setSelectedId]=useState(DEFAULT_VISUAL_CAMPAIGNS[0].id);
 const [loaded,setLoaded]=useState(false);
 const [savedHash,setSavedHash]=useState("");
 const [busy,setBusy]=useState(false);
 const [uploading,setUploading]=useState<"desktop"|"mobile"|null>(null);
 const [notice,setNotice]=useState("");
 const [preview,setPreview]=useState<"mobile"|"desktop">("desktop");
 const [colorPicker,setColorPicker]=useState<ColorKey|null>(null);
 const [datePicker,setDatePicker]=useState<"startsOn"|"endsOn"|null>(null);
 const [showAdvanced,setShowAdvanced]=useState(false);
 const selected=items.find(i=>i.id===selectedId)||items[0];
 const active=useMemo(()=>chooseVisualCampaign(items),[items]);
 const dirty=JSON.stringify(items)!==savedHash;
 const patch=(p:Partial<VisualCampaign>)=>setItems(prev=>prev.map(i=>i.id===selectedId?{...i,...p}:i));
 useEffect(()=>{
  let mounted=true;
  const load=async()=>{
   try{
    await auth.authStateReady();const u=auth.currentUser;if(!u)throw Error("AUTH_REQUIRED");
    const token=await u.getIdToken();const response=await fetch("/api/admin/visual-campaigns",{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
    const payload=await response.json() as {items?:unknown;ok?:boolean};
    if(!response.ok||!payload.ok)throw Error("CAMPAIGN_READ_FAILED");
    const loadedItems=normalizeCampaignList(payload.items);
    if(mounted){setItems(loadedItems);setSavedHash(JSON.stringify(loadedItems));setSelectedId(loadedItems[0]?.id||"");setLoaded(true);}
   }catch{if(mounted){setNotice("Não foi possível carregar as campanhas da nuvem. Publicação bloqueada; confira a conexão.");setLoaded(false);}}
  };
  void load();return()=>{mounted=false};
 },[]);
 const save=async()=>{
  if(!loaded||busy)return;
  setBusy(true);setNotice("");
  try{
    const safe=normalizeCampaignList(items);
    await auth.authStateReady();const u=auth.currentUser;if(!u)throw Error("AUTH_REQUIRED");
    const token=await u.getIdToken();
    const response=await fetch("/api/admin/visual-campaigns",{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({items:safe})});
    const payload=await response.json() as {ok?:boolean;error?:string};
    if(!response.ok||!payload.ok)throw Error(payload.error||"CAMPAIGN_SAVE_FAILED");
    setSavedHash(JSON.stringify(safe));
    setNotice("Campanhas publicadas na nuvem. A vitrine pode usar cache por até 2 minutos; não altera preços nem pedidos.");
  }catch(error){setNotice(`Não foi possível publicar: ${error instanceof Error?error.message:"erro inesperado"}. Nada foi gravado por este envio.`);}
  finally{setBusy(false)};
 };
 const upload=async(file:File,variant:"desktop"|"mobile")=>{
  if(!selected||!loaded||uploading||busy)return;
  setUploading(variant);setNotice("");
  try{
   await auth.authStateReady();const u=auth.currentUser;if(!u)throw Error("AUTH_REQUIRED");
   const prepared=await prepareCampaignBanner(file);
   const form=new FormData();form.set("file",prepared);form.set("campaignId",selected.id);form.set("variant",variant);
   const response=await fetch("/api/admin/visual-campaign-image",{method:"POST",headers:{Authorization:`Bearer ${await u.getIdToken()}`},body:form});
   const payload=await response.json() as {ok?:boolean;url?:string;error?:string};
   if(!response.ok||!payload.ok||!payload.url)throw Error(payload.error||"CAMPAIGN_UPLOAD_FAILED");
   patch(variant==="desktop"?{bannerDesktop:payload.url}:{bannerMobile:payload.url});
   setNotice(`Imagem ${variant==="desktop"?"horizontal":"mobile"} otimizada e enviada. Clique em Salvar campanhas para publicar o vínculo.`);
  }catch(error){setNotice(`Falha no envio: ${error instanceof Error?error.message:"erro inesperado"}. O banner anterior foi preservado.`);}
  finally{setUploading(null)};
 };
 if(!selected)return <section className={styles.root}>Nenhuma campanha disponível.</section>;
 const contrastOk=colorContrast(selected.palette.button,selected.palette.buttonText)>=4.5 && colorContrast(selected.palette.background,selected.palette.text)>=4.5 && colorContrast(selected.palette.badge,selected.palette.badgeText)>=4.5;
 const setPalette=(key:ColorKey,v:string)=>patch({palette:{...selected.palette,[key]:v}});
 const add=()=>{const copy=cloneCampaign(DEFAULT_VISUAL_CAMPAIGNS[0],Date.now());setItems(p=>[...p,copy]);setSelectedId(copy.id);setNotice("Nova campanha criada como rascunho. Envie sua arte e salve para publicar.")};
 const duplicate=()=>{const copy=cloneCampaign(selected,Date.now());setItems(p=>[...p,copy]);setSelectedId(copy.id);setNotice("Cópia criada em rascunho, sem banner. Salve para publicar.")};
 return <section className={styles.root}>
   <div className={styles.hero}><div className={styles.heroIcon}><Sparkles size={24}/></div><div><span>MARKETING VISUAL • SEM ALTERAR CHECKOUT</span><h3>Central de Campanhas</h3><p>Crie, programe, duplique e personalize a identidade do site sem mexer no código. Até 20 campanhas.</p></div></div>
   <div className={styles.statusBar}><span>Hoje em Brasília: <strong>{brazilDate().split("-").reverse().join("/")}</strong></span><span>Tema após salvar: <strong>{active?.publicName||"Identidade padrão DFL"}</strong></span></div>
   {dirty&&loaded&&<p className={styles.notice} role="status">Alterações não salvas: o site público só muda depois que você tocar em Salvar campanhas.</p>}
   <button type="button" className={styles.advancedToggle} onClick={()=>{setItems(prev=>prev.map(c=>c.status==="active"||c.status==="scheduled"?{...c,status:"paused"}:c));setNotice("Todas as campanhas foram pausadas no rascunho. Salve para restaurar o tema padrão no site.")}} disabled={!loaded||busy||!items.some(c=>c.status==="active"||c.status==="scheduled")}><RotateCcw size={16}/> Pausar campanhas e restaurar tema padrão</button>
   <div className={styles.listHead}><strong>Campanhas cadastradas</strong><button type="button" disabled={!loaded||items.length>=20||busy} onClick={add}><Plus size={15}/> Nova campanha</button></div>
   <div className={styles.campaignList}>{items.map(c=><button key={c.id} type="button" data-active={selected.id===c.id} onClick={()=>setSelectedId(c.id)}><strong>{c.name}</strong><small>{campaignStatusLabel(c)} · {c.startsOn.split("-").reverse().join("/")} – {c.endsOn.split("-").reverse().join("/")}</small></button>)}</div>
   <div className={styles.editHead}><div><span>EDITOR DE CAMPANHA</span><h4>{selected.name}</h4></div><button type="button" onClick={duplicate} disabled={!loaded||items.length>=20||busy}><Copy size={15}/> Duplicar</button></div>
   <div className={styles.statusChoices} role="group" aria-label="Situação da campanha">{(["draft","scheduled","active","paused"] as const).map(st=><button type="button" key={st} data-active={selected.status===st} onClick={()=>patch({status:st})}>{st==="draft"?"Rascunho":st==="scheduled"?"Agendar":st==="active"?"Ativar":"Pausar"}</button>)}</div>
   <div className={styles.formGrid}>
     <label>Nome interno<input value={selected.name} maxLength={90} onChange={e=>patch({name:e.target.value})}/></label>
     <label>Nome público<input value={selected.publicName} maxLength={100} onChange={e=>patch({publicName:e.target.value})}/></label>
     <label>Título principal<input value={selected.headline} maxLength={130} onChange={e=>patch({headline:e.target.value})}/></label>
     <label>Slogan<input value={selected.slogan} maxLength={160} onChange={e=>patch({slogan:e.target.value})}/></label>
     <label className={styles.wide}>Subtítulo<textarea rows={2} value={selected.subtitle} maxLength={240} onChange={e=>patch({subtitle:e.target.value})}/></label>
     <div className={styles.dateField}><span>Começa em</span><button type="button" onClick={()=>setDatePicker("startsOn")}><CalendarDays size={16}/>{selected.startsOn.split("-").reverse().join("/")}</button></div>
     <div className={styles.dateField}><span>Termina em (inclusive)</span><button type="button" onClick={()=>setDatePicker("endsOn")}><CalendarDays size={16}/>{selected.endsOn.split("-").reverse().join("/")}</button></div>
     <label>Prioridade (0–999)<input type="number" min={0} max={999} value={selected.priority} onChange={e=>patch({priority:Number(e.target.value)})}/></label>
     <label>Destino do banner<select value={selected.destination} onChange={e=>patch({destination:e.target.value as VisualCampaign["destination"]})}><option value="offers">Ofertas da Família</option><option value="combos">Buscar combos</option><option value="menu">Cardápio</option><option value="url">Página do próprio site</option><option value="none">Sem ação</option></select></label>
     {selected.destination==="url"&&<label className={styles.wide}>Caminho interno (ex.: /combos)<input value={selected.destinationUrl} onChange={e=>patch({destinationUrl:e.target.value})} placeholder="/"/></label>}
     <label>Texto do botão<input value={selected.cta} maxLength={45} onChange={e=>patch({cta:e.target.value})}/></label>
     <label>Nome da seção de ofertas<input value={selected.offersTitle} maxLength={100} onChange={e=>patch({offersTitle:e.target.value})}/></label>
     <label>Etiqueta promocional<input value={selected.badgeLabel} maxLength={36} onChange={e=>patch({badgeLabel:e.target.value})}/></label>
   </div>
   <div className={styles.section}><div><strong>Banners otimizados</strong><small>JPG/PNG/WebP até 12 MB; compressão local para WebP. A imagem atual nunca é apagada ao trocar.</small></div>
     <div className={styles.uploadGrid}>{(["desktop","mobile"] as const).map(variant=><div key={variant} className={styles.uploadCard}><span>{variant==="desktop"?<Monitor size={17}/>:<Smartphone size={17}/>} Banner {variant==="desktop"?"horizontal":"mobile opcional"}</span><label><ImagePlus size={16}/>{uploading===variant?"Otimizando e enviando…":"Enviar imagem"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={!!uploading||busy||!loaded} onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file,variant);e.target.value=""}}/></label><small>{variant==="desktop"?selected.bannerDesktop||"Sem banner":"Versão mobile usa horizontal caso não configurada"}</small></div>)}</div>
   </div>
   <div className={styles.section}><div><strong>Áreas com detalhes da campanha</strong><small>Personalização protegida: NÃO troca fundos da Home, cores de texto dos cards, estrutura, preços, ou botões principais de compra. Selecione apenas elementos de marketing.</small></div>
     <div className={styles.scopes}>{SCOPE_OPTIONS.map(({key,label})=><label key={key}><input type="checkbox" checked={selected.scopes.includes(key)} onChange={e=>patch({scopes:e.target.checked?[...selected.scopes,key]:selected.scopes.filter(s=>s!==key)})}/><span>{label}</span>{selected.scopes.includes(key)&&<Check size={16}/>}</label>)}</div>
   </div>
   <div className={styles.section}>
     <div><strong>Vitrine exclusiva de ofertas</strong><small>Até 12 produtos identificados pelos IDs reais. Apenas itens disponíveis e com desconto válido são exibidos; busca, links e checkout continuam intactos.</small></div>
     <label className={styles.exclusiveToggle}><input type="checkbox" checked={selected.exclusiveShowcase} onChange={e=>patch({exclusiveShowcase:e.target.checked})}/><span>Não repetir produtos desta vitrine nas seções comuns enquanto a campanha estiver ativa e a busca vazia.</span></label>
     <div className={styles.offerSelectionHead}><strong>{selected.offerProductIds.length ? `${selected.offerProductIds.length} selecionado(s)` : "Seleção automática: seis ofertas atuais"}</strong><button type="button" disabled={catalogSource!=="hybrid"} onClick={()=>patch({offerProductIds:catalogOffers.slice(0,6).map(p=>p.id)})}>Selecionar seis atuais</button><button type="button" onClick={()=>patch({offerProductIds:[]})}>Automático</button></div>
     {catalogSource!=="hybrid"?<p className={styles.notice}>Cardápio confirmado ainda não carregado. A seleção por ID está indisponível até sincronizar.</p>:<div className={styles.offerSelections} role="group" aria-label="Participantes da vitrine promocional">
       {catalogOffers.map(product=><label key={product.id}><input type="checkbox" disabled={!selected.offerProductIds.includes(product.id)&&selected.offerProductIds.length>=12} checked={selected.offerProductIds.includes(product.id)} onChange={e=>patch({offerProductIds:e.target.checked?[...selected.offerProductIds,product.id]:selected.offerProductIds.filter(id=>id!==product.id)})}/><span><strong>{product.name}</strong><small>{product.id} · R$ {product.price.toFixed(2).replace(".",",")}</small></span></label>)}
     </div>}
     <small className={styles.scopeDisclaimer}>Ao desativar a campanha, os itens voltam automaticamente para as seções normais do catálogo. A busca nunca é filtrada.</small>
   </div>
   {selected.requiredOfferName&&<p className={styles.notice}>Banner protegido por oferta: só será exibido quando {selected.requiredOfferName} estiver disponível pelo preço de {selected.requiredOfferPrice!=null?`R$ ${selected.requiredOfferPrice.toFixed(2).replace(".",",")}`:"catálogo"}. Não altera o preço no checkout.</p>}
   <div className={styles.section}><div><strong>Paleta dos detalhes promocionais</strong><small>Fundo/superfície/texto definem apenas a prévia e os elementos da campanha; nunca substituem o fundo nem o texto do site. Personalize etiqueta e destaque sem afetar os cards.</small></div>
     <div className={styles.colors}>{COLOR_FIELDS.map(({key,title})=><button type="button" key={key} onClick={()=>setColorPicker(key)}><i style={{background:selected.palette[key]}}/><span>{title}<small>{selected.palette[key]}</small></span></button>)}</div>
     <p className={contrastOk?styles.goodContrast:styles.badContrast}>{contrastOk?"Contraste mínimo de botões, etiquetas e textos principais aprovado.":"Contraste insuficiente: ajuste cores de texto e fundo antes de publicar."}</p>
   </div>
   <div className={styles.previewHead}><div><Eye size={18}/><strong>Prévia do tema</strong></div><div className={styles.previewSwitch}><button type="button" data-active={preview==="desktop"} onClick={()=>setPreview("desktop")}><Monitor size={15}/>Desktop</button><button type="button" data-active={preview==="mobile"} onClick={()=>setPreview("mobile")}><Smartphone size={15}/>Mobile</button></div></div>
   <div className={styles.previewOuter}><div className={styles.previewDevice} data-mobile={preview==="mobile"} style={{background:"#f5f3ef",color:"#171717"}}><div className={styles.previewHeader} style={{background:"#fff",color:"#171717"}}><strong>DA FAMÍLIA LANCHES</strong><small>Prévia</small></div>{(preview==="mobile"?selected.bannerMobile||selected.bannerDesktop:selected.bannerDesktop)?<img className={styles.previewBanner} src={preview==="mobile"?selected.bannerMobile||selected.bannerDesktop:selected.bannerDesktop} alt="Prévia do banner"/>:<div className={styles.previewPlaceholder}>Envie um banner para visualizar a campanha.</div>}<div className={styles.previewCopy} style={{background:"#171717",color:"#fff"}}><small style={{color:selected.palette.accent}}>{selected.slogan}</small><strong>{selected.headline}</strong><span style={{color:"#ccc"}}>{selected.subtitle}</span><button type="button" style={{background:selected.palette.button,color:selected.palette.buttonText}}>{selected.cta||"Ver ofertas"}<ArrowRight size={15}/></button><em style={{background:selected.palette.badge,color:selected.palette.badgeText}}>{selected.badgeLabel||"OFERTA"}</em></div></div></div>
   <p className={styles.scopeDisclaimer}>Prévia R104: fundo padrão permanece intacto. Somente banner, badges e elementos pontuais recebem cores de campanha.</p>
   <button type="button" className={styles.advancedToggle} aria-expanded={showAdvanced} onClick={()=>setShowAdvanced(s=>!s)}>{showAdvanced?"Ocultar opções avançadas":"Título da Home, requisitos da oferta e mais opções"}<ChevronRight size={16}/></button>
   {showAdvanced&&<div className={styles.formGrid}>
     <label className={styles.wide}>Título da Home (não muda páginas de produto)<input value={selected.seoTitle} onChange={e=>patch({seoTitle:e.target.value})} maxLength={130}/></label>
     <label className={styles.wide}>Descrição da Home<input value={selected.seoDescription} onChange={e=>patch({seoDescription:e.target.value})} maxLength={200}/></label>
     <label>Oferta exigida para mostrar o banner<input value={selected.requiredOfferName} onChange={e=>patch({requiredOfferName:e.target.value})} placeholder="Ex.: 5 UAI"/></label>
     <label>Preço exigido (R$)<input type="number" min={0} step="0.01" value={selected.requiredOfferPrice??""} onChange={e=>patch({requiredOfferPrice:e.target.value===""?null:Number(e.target.value)})}/></label>
     <button type="button" className={styles.restore} onClick={()=>{const preset=DEFAULT_VISUAL_CAMPAIGNS.find(x=>x.id===selected.id);if(preset)patch({...preset,palette:{...preset.palette},scopes:[...preset.scopes]})}} disabled={!DEFAULT_VISUAL_CAMPAIGNS.some(x=>x.id===selected.id)}><RotateCcw size={16}/> Restaurar modelo original desta campanha</button>
   </div>}
   {notice&&<p className={styles.notice} role="status">{notice}</p>}
   <div className={styles.publishBar}><div><strong>{loaded?"Publicação segura":"Carregamento pendente"}</strong><small>{items.length} campanha(s) · nenhuma alteração em pedidos, preços ou regras comerciais</small></div><button type="button" disabled={!loaded||busy||!!uploading||!contrastOk||!isDateISO(selected.startsOn)||!isDateISO(selected.endsOn)||selected.endsOn<selected.startsOn} onClick={()=>void save()}><Save size={18}/>{busy?"Salvando na nuvem…":"Salvar campanhas"}</button></div>
   {datePicker&&<DateDialog key={`${datePicker}-${selectedId}`} value={selected[datePicker]} label={datePicker==="startsOn"?"Data de início":"Data de término"} onPick={v=>patch({[datePicker]:v})} onClose={()=>setDatePicker(null)}/>}
   {colorPicker&&<ColorDialog key={`${colorPicker}-${selectedId}`} name={COLOR_FIELDS.find(c=>c.key===colorPicker)?.title||"Cor"} value={selected.palette[colorPicker]} onPick={v=>setPalette(colorPicker,v)} onClose={()=>setColorPicker(null)}/>}
 </section>;
}
