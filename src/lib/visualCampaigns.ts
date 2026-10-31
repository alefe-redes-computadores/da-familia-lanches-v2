/** DFL R103 — Campanhas visuais. Nenhuma regra de precificação ou checkout aqui. */
export type CampaignStatus = "draft" | "scheduled" | "active" | "paused";
export type CampaignDestination = "offers" | "combos" | "menu" | "none" | "url";
export type CampaignScope = "header" | "home" | "offers" | "catalog" | "checkout" | "footer";
export type CampaignPalette = {
  background: string; surface: string; text: string; muted: string;
  accent: string; accentText: string; button: string; buttonText: string;
  badge: string; badgeText: string;
};
export type VisualCampaign = {
  id: string; name: string; publicName: string; slogan: string;
  headline: string; subtitle: string; bannerDesktop: string; bannerMobile: string;
  startsOn: string; endsOn: string; status: CampaignStatus; priority: number;
  palette: CampaignPalette; scopes: CampaignScope[];
  destination: CampaignDestination; destinationUrl: string; cta: string;
  offersTitle: string; badgeLabel: string; seoTitle: string; seoDescription: string;
  // O anúncio da promoção com preço só é mostrado quando coincide com o catálogo.
  requiredOfferName: string; requiredOfferPrice: number | null;
  /** R104: seleção por IDs reais e exclusividade APENAS na vitrine, não na busca/compra. */
  offerProductIds: string[]; exclusiveShowcase: boolean;
};

export const BRAZIL_ZONE = "America/Sao_Paulo";
export const SCOPE_OPTIONS: {key:CampaignScope;label:string}[] = [
  {key:"header",label:"Cabeçalho"},{key:"home",label:"Home"},
  {key:"offers",label:"Ofertas da Família"},{key:"catalog",label:"Cards de produtos"},
  {key:"checkout",label:"Carrinho e checkout"},{key:"footer",label:"Rodapé"},
];
const BF_PALETTE: CampaignPalette = {
  background:"#0B0B0D",surface:"#18181B",text:"#FAFAFA",muted:"#A1A1AA",
  accent:"#FACC15",accentText:"#0B0B0D",button:"#FACC15",buttonText:"#0B0B0D",
  badge:"#18181B",badgeText:"#FACC15",
};
const CHRISTMAS_PALETTE: CampaignPalette = {
  background:"#103B2D",surface:"#184B39",text:"#FFF8ED",muted:"#D8E6D9",
  accent:"#E9C46A",accentText:"#103B2D",button:"#C62828",buttonText:"#FFFFFF",
  badge:"#E9C46A",badgeText:"#103B2D",
};
const NEW_YEAR_PALETTE: CampaignPalette = {
  background:"#09090B",surface:"#27272A",text:"#FFFFFF",muted:"#C0C0C0",
  accent:"#C0C0C0",accentText:"#09090B",button:"#FFFFFF",buttonText:"#09090B",
  badge:"#FFFFFF",badgeText:"#09090B",
};
export const DEFAULT_VISUAL_CAMPAIGNS: VisualCampaign[] = [
  {id:"black-friday-da-familia-2026",name:"Black Friday 2026",publicName:"BLACK FRIDAY DA FAMÍLIA",
    slogan:"Uai, que oferta!",headline:"Black Friday da Família",
    subtitle:"Quem disse que lanche não entra na Black Friday, uai?",
    bannerDesktop:"/img/campaign/black-friday-da-familia.webp",bannerMobile:"",
    startsOn:"2026-10-30",endsOn:"2026-11-30",status:"active",priority:100,
    palette:BF_PALETTE,scopes:["header","home","offers","catalog","checkout","footer"],
    destination:"offers",destinationUrl:"",cta:"Ver ofertas",offersTitle:"Ofertas da Família — Especial Black Friday",badgeLabel:"BLACK FRIDAY",
    seoTitle:"Da Família Lanches | Black Friday em Patos de Minas",
    seoDescription:"A Black Friday chegou à Da Família Lanches! Confira ofertas especiais em hambúrgueres e combos. Peça online em Patos de Minas.",
    requiredOfferName:"5 UAI",requiredOfferPrice:49.99,offerProductIds:[],exclusiveShowcase:true},
  {id:"natal-da-familia-2026",name:"Natal da Família 2026",publicName:"NATAL DA FAMÍLIA",
    slogan:"O melhor presente é reunir quem a gente ama!",headline:"Natal da Família",
    subtitle:"Ofertas para compartilhar com quem faz parte da sua história.",
    bannerDesktop:"",bannerMobile:"",startsOn:"2026-12-01",endsOn:"2026-12-25",status:"draft",priority:90,
    palette:CHRISTMAS_PALETTE,scopes:["header","home","offers","catalog","checkout","footer"],
    destination:"offers",destinationUrl:"",cta:"Ver ofertas",offersTitle:"Natal da Família — Ofertas para compartilhar",badgeLabel:"NATAL DA FAMÍLIA",
    seoTitle:"Natal da Família | Hambúrgueres e Combos em Patos de Minas",seoDescription:"Celebre o Natal com a Da Família Lanches.",
    requiredOfferName:"",requiredOfferPrice:null,offerProductIds:[],exclusiveShowcase:false},
  {id:"virada-da-familia-2027",name:"Virada da Família 2027",publicName:"VIRADA DA FAMÍLIA",
    slogan:"Ano novo, fome de coisa boa!",headline:"Comece o ano com sabor de Família",
    subtitle:"Ano novo, fome de coisa boa!",bannerDesktop:"",bannerMobile:"",
    startsOn:"2026-12-26",endsOn:"2027-01-05",status:"draft",priority:80,
    palette:NEW_YEAR_PALETTE,scopes:["header","home","offers","catalog","checkout","footer"],
    destination:"offers",destinationUrl:"",cta:"Ver ofertas",offersTitle:"Virada da Família — Ofertas especiais",badgeLabel:"VIRADA DA FAMÍLIA",
    seoTitle:"Ano Novo na Da Família Lanches | Patos de Minas",seoDescription:"Comece o ano com sabor de Família.",
    requiredOfferName:"",requiredOfferPrice:null,offerProductIds:[],exclusiveShowcase:false},
];

export function brazilDate(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {timeZone:BRAZIL_ZONE,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
  const part=(type:string)=>parts.find(p=>p.type===type)?.value||"";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function isDateISO(s:string):boolean {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T12:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10)===s;
}
export function isCampaignInPeriod(c:VisualCampaign, today:string):boolean {
  return (c.status==="active"||c.status==="scheduled") && c.startsOn<=today && c.endsOn>=today;
}
export function chooseVisualCampaign(items:VisualCampaign[],today:string=brazilDate()):VisualCampaign|null {
  return [...items].filter(c=>isCampaignInPeriod(c,today))
    .sort((a,b)=>b.priority-a.priority||b.startsOn.localeCompare(a.startsOn)||a.id.localeCompare(b.id))[0]??null;
}
export function campaignStatusLabel(c:VisualCampaign,today:string=brazilDate()):string {
  if(c.status==="paused")return "Pausada";
  if(c.status==="draft")return "Rascunho";
  if(c.endsOn<today)return "Encerrada";
  if(c.startsOn>today)return "Agendada";
  return "Ativa";
}
function text(v:unknown,max:number):string {return typeof v==="string"?v.trim().slice(0,max):"";}
function color(v:unknown):string {return typeof v==="string"&&/^#[0-9a-f]{6}$/i.test(v)?v.toUpperCase():"";}
export function colorContrast(a:string,b:string):number {
  const luminance=(hex:string)=>{
    const values=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(x=>x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4));
    return values[0]*.2126+values[1]*.7152+values[2]*.0722;
  };
  const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
export function validCampaignImage(value:unknown):boolean {
  if(value==="")return true;
  if(typeof value!=="string"||value.length>420)return false;
  if(/^\/img\/campaign\/[a-z0-9_-]+\.webp$/i.test(value))return true;
  try {
    const u=new URL(value);
    return u.protocol==="https:" && u.hostname==="raw.githubusercontent.com" &&
      u.pathname.startsWith("/alefe-redes-computadores/da-familia-lanches-v2/") &&
      /^\/alefe-redes-computadores\/da-familia-lanches-v2\/[\w-]+\/public\/img\/campaign\/[\w-]+\.webp$/.test(u.pathname);
  }catch {return false;}
}
export function normalizeVisualCampaign(raw:unknown):VisualCampaign {
  if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("CAMPAIGN_OBJECT_INVALID");
  const r=raw as Record<string,unknown>;
  const id=text(r.id,70);
  if(!/^[a-z0-9][a-z0-9_-]{2,69}$/.test(id))throw Error("CAMPAIGN_ID_INVALID");
  const name=text(r.name,90),publicName=text(r.publicName,100),headline=text(r.headline,130);
  if(!name||!publicName||!headline)throw Error("CAMPAIGN_TITLE_REQUIRED");
  const startsOn=text(r.startsOn,10),endsOn=text(r.endsOn,10);
  if(!isDateISO(startsOn)||!isDateISO(endsOn)||endsOn<startsOn)throw Error("CAMPAIGN_DATE_INVALID");
  const status=r.status;
  if(!["draft","scheduled","active","paused"].includes(String(status)))throw Error("CAMPAIGN_STATUS_INVALID");
  const destination=r.destination;
  if(!["offers","combos","menu","none","url"].includes(String(destination)))throw Error("CAMPAIGN_DESTINATION_INVALID");
  const destinationUrl=text(r.destinationUrl,300);
  if(destination==="url" && (!/^\/(?!\/)[a-z0-9\-\/_?#=&%.]*$/i.test(destinationUrl)||destinationUrl.startsWith("/api/")))throw Error("CAMPAIGN_URL_INVALID");
  const bannerDesktop=text(r.bannerDesktop,420),bannerMobile=text(r.bannerMobile,420);
  if(!validCampaignImage(bannerDesktop)||!validCampaignImage(bannerMobile))throw Error("CAMPAIGN_IMAGE_INVALID");
  const palette=r.palette && typeof r.palette==="object"?r.palette as Record<string,unknown>:{};
  const p={} as CampaignPalette;
  const keys:(keyof CampaignPalette)[]=["background","surface","text","muted","accent","accentText","button","buttonText","badge","badgeText"];
  for(const key of keys){const v=color(palette[key]);if(!v)throw Error(`CAMPAIGN_COLOR_INVALID_${key}`);p[key]=v;}
  if(colorContrast(p.button,p.buttonText)<4.5||colorContrast(p.badge,p.badgeText)<4.5||colorContrast(p.background,p.text)<4.5)throw Error("CAMPAIGN_CONTRAST_INSUFFICIENT");
  const scopes=Array.isArray(r.scopes)?[...new Set(r.scopes.filter((v):v is CampaignScope=>typeof v==="string"&&SCOPE_OPTIONS.some(x=>x.key===v)))]:[];
  const priority=r.priority;
  if(typeof priority!=="number"||!Number.isInteger(priority)||priority<0||priority>999)throw Error("CAMPAIGN_PRIORITY_INVALID");
  if(r.offerProductIds!==undefined && !Array.isArray(r.offerProductIds)) throw Error("CAMPAIGN_OFFER_IDS_INVALID");
  const offerProductIds=Array.isArray(r.offerProductIds)?r.offerProductIds:[];
  if(offerProductIds.length>12 || offerProductIds.some(v=>typeof v!=="string" || !/^[a-z0-9_-]{1,100}$/i.test(v)) || new Set(offerProductIds).size!==offerProductIds.length) throw Error("CAMPAIGN_OFFER_IDS_INVALID");
  if(r.exclusiveShowcase!==undefined && typeof r.exclusiveShowcase!=="boolean") throw Error("CAMPAIGN_EXCLUSIVE_INVALID");
  // Migração de campanhas R103 armazenadas: troca badge amarelo antigo sem mexer na escolha manual posterior.
  if(id==="black-friday-da-familia-2026" && p.badge==="#FACC15" && p.badgeText==="#0B0B0D"){
    p.badge="#18181B"; p.badgeText="#FACC15";
  }
  const requiredOfferName=text(r.requiredOfferName,70);
  const requiredOfferPrice=r.requiredOfferPrice===null||r.requiredOfferPrice===undefined?null:r.requiredOfferPrice;
  if(requiredOfferPrice!==null && (typeof requiredOfferPrice!=="number"||!Number.isFinite(requiredOfferPrice)||requiredOfferPrice<0||requiredOfferPrice>100000))throw Error("CAMPAIGN_OFFER_PRICE_INVALID");
  return {id,name,publicName,headline,slogan:text(r.slogan,160),subtitle:text(r.subtitle,240),
    bannerDesktop,bannerMobile,startsOn,endsOn,status:status as CampaignStatus,priority,palette:p,scopes,
    destination:destination as CampaignDestination,destinationUrl:destination==="url"?destinationUrl:"",cta:text(r.cta,45),
    offersTitle:text(r.offersTitle,100),badgeLabel:text(r.badgeLabel,36),seoTitle:text(r.seoTitle,130),seoDescription:text(r.seoDescription,200),
    requiredOfferName,requiredOfferPrice:requiredOfferPrice as number|null,
    offerProductIds:offerProductIds as string[],
    exclusiveShowcase: r.exclusiveShowcase===undefined ? id==="black-friday-da-familia-2026" : r.exclusiveShowcase};
}
export function normalizeCampaignList(raw:unknown):VisualCampaign[] {
  if(!Array.isArray(raw)||raw.length>20)throw Error("CAMPAIGN_LIST_INVALID");
  const list=raw.map(normalizeVisualCampaign);
  if(new Set(list.map(x=>x.id)).size!==list.length)throw Error("CAMPAIGN_DUPLICATE_ID");
  return list;
}
