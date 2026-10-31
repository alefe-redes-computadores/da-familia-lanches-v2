"use client";

import { ArrowRight, Sparkles } from "lucide-react";
import { useVisualCampaign } from "@/components/layout/VisualCampaignProvider";
import { CATALOG_SEARCH_EVENT } from "@/lib/catalogSearch";
import styles from "./VisualCampaignBanner.module.css";

export function VisualCampaignBanner({show=true}:{show?:boolean}){
 const campaign=useVisualCampaign();
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
 const image=<picture>
   {campaign.bannerMobile&&<source media="(max-width: 620px)" srcSet={campaign.bannerMobile}/>}
   <img src={campaign.bannerDesktop} width={1536} height={512} alt={`${campaign.publicName}. ${campaign.subtitle}`} loading="eager" fetchPriority="high" decoding="async"/>
 </picture>;
 return <section className={styles.wrap} aria-label={campaign.publicName} data-dfl-campaign-banner="true">
   {campaign.destination==="none"?<div className={styles.media}>{image}</div>:<button type="button" className={styles.media} onClick={activate} aria-label={`${campaign.cta||"Ver campanha"}: ${campaign.publicName}`}>{image}</button>}
   <div className={styles.caption}>
     <div><span><Sparkles size={15} aria-hidden="true"/>{campaign.slogan||campaign.publicName}</span></div>
     {campaign.destination!=="none"&&<button type="button" onClick={activate}>{campaign.cta||"Ver ofertas"}<ArrowRight size={17}/></button>}
   </div>
 </section>;
}
