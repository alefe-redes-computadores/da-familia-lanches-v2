"use client";

import { useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { useVisualCampaign } from "@/components/layout/VisualCampaignProvider";
import { CATALOG_SEARCH_EVENT } from "@/lib/catalogSearch";
import styles from "./VisualCampaignBanner.module.css";

export function VisualCampaignBanner({show=true}:{show?:boolean}){
 const campaign=useVisualCampaign();
 // R77: visitante pode recolher arte sazonal; CTA e campanha permanecem acessiveis.
 const [collapsed,setCollapsed]=useState(false);
 if(!campaign||!show||!campaign.bannerDesktop)return null;
 const activate=()=>{
  if(campaign.destination==="none")return;
  if(campaign.destination==="url"){
    if(campaign.destinationUrl.startsWith("/")&&!campaign.destinationUrl.startsWith("//"))window.location.assign(campaign.destinationUrl);
    return;
  }
  if(campaign.destination==="combos"){
    window.dispatchEvent(new CustomEvent(CATALOG_SEARCH_EVENT,{detail:"combo"}));
    document.getElementById("dfl-family-catalog")?.scrollIntoView({behavior:"smooth",block:"start"});
    return;
  }
  if(campaign.destination==="offers"){
    window.dispatchEvent(new Event("dfl:campaign-offers-open"));
    return;
  }
  document.getElementById("dfl-family-catalog")?.scrollIntoView({behavior:"smooth",block:"start"});
 };
 // R84: CTA fiel ao destino real. Evita "rolar para ofertas" sem ação clara.
 const fallbackCta=campaign.destination==="combos"?"Ver combos":campaign.destination==="offers"?"Ver ofertas":campaign.destination==="url"?"Conhecer": "Ver cardápio";
 const ctaText=/^(rolar (para )?(as )?ofertas|role para ofertas)$/i.test((campaign.cta||"").trim())?"Ver ofertas":campaign.cta?.trim()||fallbackCta;
 const image=<picture>
   {campaign.bannerMobile&&<source media="(max-width: 620px)" srcSet={campaign.bannerMobile}/>}
   <img src={campaign.bannerDesktop} width={1536} height={512} alt={`${campaign.publicName}. ${campaign.subtitle}`} loading="eager" fetchPriority="high" decoding="async"/>
 </picture>;
 return <section className={styles.wrap} aria-label={campaign.publicName} data-dfl-campaign-banner="true" data-collapsed={collapsed?"true":"false"}>
   {!collapsed && (campaign.destination==="none"?<div className={styles.media}>{image}</div>:<button type="button" className={styles.media} onClick={activate} aria-label={`${ctaText}: ${campaign.publicName}`}>{image}</button>)}
   <div className={styles.caption}>
     <div><span><Sparkles size={15} aria-hidden="true"/>{campaign.slogan||campaign.publicName}</span></div>
     <div className={styles.captionActions}><button type="button" className={styles.collapseToggle} aria-expanded={!collapsed} onClick={()=>setCollapsed(v=>!v)}>{collapsed?"Mostrar arte":"Recolher arte"}</button>{campaign.destination!=="none"&&<button type="button" onClick={activate}>{ctaText}<ArrowRight size={17}/></button>}</div>
   </div>
 </section>;
}
