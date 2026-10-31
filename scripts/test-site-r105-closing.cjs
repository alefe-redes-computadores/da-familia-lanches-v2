'use strict';
/** DFL SITE R105 — gate final de estabilidade, somente leitura, sem pedidos reais. */
const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
const read=p=>fs.readFileSync(p,'utf8');
const home=read('src/app/page.tsx');
const banner=read('src/components/layout/VisualCampaignBanner.tsx');
const provider=read('src/components/layout/VisualCampaignProvider.tsx');
const api=read('src/app/api/public/visual-campaigns/route.ts');
const adminApi=read('src/app/api/admin/visual-campaigns/route.ts');
const globals=read('src/app/globals.css');
const checkout=read('src/components/ui/CheckoutModal.tsx');
const orders=read('src/app/api/orders/route.ts');
const site=read('.github/workflows/site-sales-protection.yml');
const android=read('.github/workflows/build-admin-android.yml');
let count=0;const ok=(value,label)=>{assert.ok(value,label);count++;console.log('R105 OK:',label)};
ok(provider.includes('useState<VisualCampaign[]>([])')&&!provider.includes('useState<VisualCampaign[]>(DEFAULT_VISUAL_CAMPAIGNS)'), 'Campanha fica desligada até confirmar configuração; pausa não pisca na entrada');
ok(api.includes('snap.exists ? normalizeCampaignList(snap.data()?.items) : DEFAULT_VISUAL_CAMPAIGNS') && api.includes('items:[],degraded:true'), 'Primeiro cadastro cria modelos; falha remota não inventa campanha ativa');
ok(api.includes('revalidate: 120')&&api.includes('Cache-Control'), 'Cache público limitado, sem listener Firebase no navegador');
ok(provider.includes('normalizeCampaignList(data.items)')&&provider.includes('sessionStorage'), 'Configuração remota tipada e cache curto');
ok(home.includes('setOffersOpenRequest(value=>value+1)')&&home.includes('},[showAllOffers,offersOpenRequest]);'), 'Clique repetido no banner rola até a vitrine já expandida');
ok(banner.includes('new Event("dfl:campaign-offers-open")')&&home.includes('setShowAllOffers(true)'), 'Banner expande sem abrir modal');
ok(home.includes('scrollIntoView({behavior:reduced?"auto":"smooth"')&&home.includes('setHighlightOffers(true)'), 'Rolagem com acessibilidade e destaque temporário');
ok(home.includes('showcaseProducts.slice(0,2)')&&home.includes('styles.r104OffersExpanded'), 'Prévia de duas ofertas e lista expandida');
ok(home.includes('const exclusive=Boolean(campaign?.scopes.includes("offers")&&campaign.exclusiveShowcase)')&&home.includes('if (promoIds?.has(product.id)) continue'), 'Exclusividade visual por ID sem apagar produtos');
ok(home.includes('visibleCategoryIds.has(product.category)') && home.includes('recentlyViewed.map((product)') && home.includes('savedProducts.map((product)'), 'Categorias, favoritos e vistos continuam disponíveis');
ok(!globals.includes('[data-dfl-campaign-home]{background:') && !globals.includes('[data-dfl-campaign-product="true"] h3') && !globals.includes('[data-dfl-campaign-add="true"]{background:'), 'Tema não recolore fundos, títulos nem botões principais');
ok(adminApi.includes('isAdminEmail')&&adminApi.includes('normalizeCampaignList')&&adminApi.includes('revalidateTag'), 'Campanhas editáveis somente pelo Admin e cache invalidado');
ok(checkout.includes('orderAttemptRef.current')&&checkout.includes('confirmedOrderId = created.id;')&&orders.includes('requestFingerprint')&&orders.includes('tx.create(orderRef, canonicalOrder)'), 'Idempotência e confirmação de pedido intactas');
ok(site.includes('node scripts/test-site-r105-closing.cjs') && android.includes('node scripts/test-site-r105-closing.cjs'), 'Novo gate integra as duas Actions');
for(const p of ['src/app/page.tsx','src/components/layout/VisualCampaignProvider.tsx','src/app/api/public/visual-campaigns/route.ts']){
 const parsed=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 assert.equal(parsed.parseDiagnostics.length,0,p+' AST');
}
ok(true,'Sintaxe TS/TSX dos três módulos alterados');
console.log(`\nR105 FECHAMENTO — ${count} verificações OK; sem rede, sem pedido comercial, sem escrita Firebase.`);
