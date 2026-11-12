import fs from "node:fs";
import assert from "node:assert/strict";
const read=p=>fs.readFileSync(p,'utf8');
const home=read('src/app/page.tsx');
const card=read('src/components/home/OrderTrackingInfoCard.tsx');
const css=read('src/components/home/OrderTrackingInfoCard.module.css');
const tracking=read('src/app/api/customer/tracking-capability/route.ts');
const links=read('src/lib/tracking/client-link.ts');
const checks=[
  ['componente de acompanhamento na Home',home.includes('import { OrderTrackingInfoCard } from "@/components/home/OrderTrackingInfoCard";')],
  ['Card apenas na vitrine sem busca/categoria filtrada',home.includes('activeCategory === "todos" && !search.trim() && <OrderTrackingInfoCard />')],
  ['card apos estado da loja e antes das ofertas',home.indexOf('<OrderTrackingInfoCard />')>home.indexOf('className={styles.closedNotice}')&&home.indexOf('<OrderTrackingInfoCard />')<home.indexOf('id="dfl-family-offers"')],
  ['card antes da lista de categorias',home.indexOf('<OrderTrackingInfoCard />')<home.indexOf('className={styles.searchSummary}')],
  ['campanha e ofertas preservadas',home.includes('<VisualCampaignBanner show={bannerEligible} />')&&home.includes('showcaseProducts.length > 0')],
  ['fluxo de pedido existente intocado',home.includes('<ActiveOrderBanner />')&&home.includes('<LastOrderCard />')],
  ['card singular',home.split('<OrderTrackingInfoCard />').length===2],
  ['copy de design preservada',card.includes('Seu pedido, acompanhado de verdade')&&card.includes('NOVIDADE DA FAMÍLIA')],
  ['disclosure HTML funcional',card.includes('<details className={styles.disclosure}>')&&card.includes('<summary>Como funciona')],
  ['acesso real a Meus pedidos sob acao',card.includes('onClick={() => openModal("orders")}')],
  ['sem abrir modal ao montar',!card.includes('useEffect')&&!card.includes('useLayoutEffect')],
  ['sem I/O ou ativacao externa',!card.includes('fetch(')&&!card.includes('setDoc(')&&!card.includes('onSnapshot(')],
  ['sem promessa automatica WhatsApp',card.includes('exigem autorização')&&card.includes('ativação do serviço')],
  ['link condicionado a elegibilidade',card.includes('quando o acompanhamento é liberado para aquele pedido')],
  ['nenhum token inventado',!card.includes('#t=')&&!card.includes('issueTrackingLink')],
  ['API de capacidade continua protegida',tracking.includes('trackingEnabled()')],
  ['tokens e dominios seguem parser oficial',links.includes('parseTrackingLink')&&links.includes('/acompanhar')],
  ['sem assets externos',!css.includes('url(')&&!card.includes('<img')],
  ['mobile sem altura fixa',css.includes('@media(max-width:600px)')&&!css.includes('height:180px')],
  ['desktop largura controlada',css.includes('max-width:880px')],
  ['safe touch e acessibilidade',css.includes(':focus-visible')&&card.includes('aria-labelledby')],
];
for(const [label,pass] of checks){assert.ok(pass,'R59: '+label);console.log('OK: '+label)}
console.log(`R59: ${checks.length} contratos aprovados, sem Firestore, checkout, WhatsApp ou dados reais.`);
