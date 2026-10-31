'use strict';
/* DFL R104: valida configuracao, identidade opt-in, CTA e checkout sem rede. */
const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const rd=p=>fs.readFileSync(p,'utf8');let n=0;
const check=(label,fn)=>{fn();n++;console.log('OK R104:',label)};
const model=rd('src/lib/visualCampaigns.ts');
const emitted=ts.transpileModule(model,{fileName:'visualCampaigns.ts',reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
assert.equal((emitted.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
const moduleObj={exports:{}};new Function('module','exports',emitted.outputText)(moduleObj,moduleObj.exports);
const {DEFAULT_VISUAL_CAMPAIGNS,normalizeCampaignList,chooseVisualCampaign}=moduleObj.exports;
const bf=DEFAULT_VISUAL_CAMPAIGNS[0];
check('Black Friday: etiqueta grafite/dourado contrastante',()=>{assert.equal(bf.palette.badge,'#18181B');assert.equal(bf.palette.badgeText,'#FACC15')});
check('Black Friday opt-in para vitrine exclusiva',()=>assert.equal(bf.exclusiveShowcase,true));
check('Natal/Ano Novo possuem mesmo esquema e começam em rascunho',()=>{assert(DEFAULT_VISUAL_CAMPAIGNS.slice(1).every(c=>c.status==='draft'&&c.exclusiveShowcase===false&&Array.isArray(c.offerProductIds))) });
check('Campanhas R103 armazenadas sao compatíveis, sem editar Firebase',()=>{
 const old={...bf,exclusiveShowcase:undefined,offerProductIds:undefined,palette:{...bf.palette,badge:'#FACC15',badgeText:'#0B0B0D'}};
 const restored=normalizeCampaignList([old])[0];assert.equal(restored.exclusiveShowcase,true);assert.deepEqual(restored.offerProductIds,[]);assert.equal(restored.palette.badge,'#18181B');
});
check('Não permite IDs maliciosos, repetidos, >12 ou status inválido',()=>{
 for(const ids of [['x','x'],['/api/orders'],['https:attack'],Array.from({length:13},(_,i)=>'offer'+i)])assert.throws(()=>normalizeCampaignList([{...bf,offerProductIds:ids}]));
 assert.throws(()=>normalizeCampaignList([{...bf,exclusiveShowcase:'sim'}]));
});
check('Futuras campanhas suportam IDs explícitos e modo não exclusivo',()=>{
 const x=normalizeCampaignList([{...bf,id:'campanha-verao-2027',offerProductIds:['combo-4-uai','combo-7-uai'],exclusiveShowcase:false}])[0];
 assert.deepEqual(x.offerProductIds,['combo-4-uai','combo-7-uai']);assert.equal(x.exclusiveShowcase,false);
});
check('Pausa e fim do período restauram ausência de tema',()=>{
 assert.equal(chooseVisualCampaign([bf],'2026-12-01'),null);
 assert.equal(chooseVisualCampaign([{...bf,status:'paused'}],'2026-11-15'),null);
});
const home=rd('src/app/page.tsx'),css=rd('src/app/page.module.css');
const global=rd('src/app/globals.css'),banner=rd('src/components/layout/VisualCampaignBanner.tsx');
const admin=rd('src/components/admin/VisualCampaignsAdmin.tsx');
const checkout=rd('src/components/ui/CheckoutModal.tsx'),orderApi=rd('src/app/api/orders/route.ts');
check('CSS não recolore fundo global, texto de cards, botão adicionar ou preços',()=>{
 for(const forbidden of ['[data-dfl-campaign-home]{background:','[data-dfl-campaign-product="true"]{background:','[data-dfl-campaign-product="true"] h3','[data-dfl-campaign-product="true"] strong','[data-dfl-campaign-add="true"]{background:'])assert(!global.includes(forbidden),forbidden);
 assert(global.includes('DFL-R104-CORRETIVA-PREMIUM'));
});
check('Etiquetas escopo promo são opt-in e cores do card original preservadas',()=>{
 assert(global.includes('[data-dfl-campaign-badge="true"]'));assert(css.includes('.r104OfferPrices b{'));assert(css.includes('color:#fff'));assert(css.includes('text-decoration-line:line-through'));
});
check('Banner dispatch de expandir ofertas sem modal',()=>{
 assert(banner.includes('new Event("dfl:campaign-offers-open")'));assert(!banner.includes('openModal('));
});
check('Botão do banner abre vitrine com rolagem, margem e redução de movimento',()=>{
 assert(home.includes('setShowAllOffers(true)'));assert(home.includes('scrollIntoView({behavior:reduced?"auto":"smooth"'));assert(css.includes('scroll-margin-top:'));assert(home.includes('setHighlightOffers(true)'));
});
check('Prévia de duas ofertas legíveis, sem duplicar carrossel e grid',()=>{
 assert(home.includes('showcaseProducts.slice(0,2)'));assert(home.includes('styles.r104OffersExpanded'));assert(home.includes('styles.r104OffersPreview'));
 assert(!home.includes('showAllOffers && <div className={styles.offerGrid}>'));assert(css.includes('.r104OfferName{display:-webkit-box'));
});
check('Vitrine mobile: uma coluna, imagem e texto com preço normal',()=>{
 assert(css.includes('.r104OffersExpanded{display:grid;grid-template-columns:1fr;'));assert(css.includes('@media(max-width:699px){.r104OffersExpanded{grid-template-columns:minmax(0,1fr)'));assert(css.includes('.r104OfferImage'));assert(css.includes('.r104OfferPrices b'));
});
check('Deduplicação depende de IDs reais, mas pesquisa mantém produtos',()=>{
 assert(home.includes('new Set((exclusive?showcaseProducts:promoProducts).map(product=>product.id))'));
 assert(home.includes('const excludePromos=!search.trim()'));assert(home.includes('if (promoIds?.has(product.id)) continue'));
});
check('Seleção controlada no Admin e não adiciona listeners Firebase',()=>{
 assert(admin.includes('offerProductIds'));assert(admin.includes('exclusiveShowcase'));assert(admin.includes('useCatalog()'));
 assert(!/onSnapshot\s*\(|getDocs\s*\(/.test(admin));
});
check('Editor mostra prévia preservando fundo e textos da identidade original',()=>{
 assert(admin.includes('style={{background:"#f5f3ef",color:"#171717"}}'));
 assert(admin.includes('sem alterar o fundo')||admin.includes('fundo padrão'));
});
check('R103 ainda protege preços, checkout e publicação das campanhas',()=>{
 assert(rd('scripts/test-visual-campaign-r103.cjs').includes('showcaseProducts.slice(0,2)'));
 assert(checkout.includes('confirmedOrderId = created.id;')&&checkout.includes('orderAttemptRef.current'));
 assert(orderApi.includes('requestFingerprint')&&orderApi.includes('tx.create(orderRef, canonicalOrder)'));
});
check('Action Android + proteção de vendas validam nova cirurgia',()=>{
 for(const p of ['.github/workflows/build-admin-android.yml','.github/workflows/site-sales-protection.yml'])assert(rd(p).includes('node scripts/test-visual-campaign-r104.cjs'));
});
check('Sem mudanças de preço, pedido, frete ou pagamento nos arquivos alterados',()=>{
 const altered=['src/app/page.tsx','src/app/globals.css','src/app/page.module.css','src/lib/visualCampaigns.ts','src/components/layout/VisualCampaignBanner.tsx','src/components/admin/VisualCampaignsAdmin.tsx'];
 for(const p of altered)assert(!/\.collection\(['"]Pedidos|createCustomerOrder\(|runTransaction\(/.test(rd(p)),p);
});
check('Arquivos editados TypeScript/TSX sem erro de sintaxe',()=>{
 for(const p of ['src/lib/visualCampaigns.ts','src/components/layout/VisualCampaignBanner.tsx','src/components/admin/VisualCampaignsAdmin.tsx','src/app/page.tsx']){
  const ast=ts.createSourceFile(p,rd(p),ts.ScriptTarget.Latest,true,p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  assert.equal(ast.parseDiagnostics.length,0,p);
 }
});
console.log('DFL R104 CORRETIVA PREMIUM — '+n+' contratos aprovados; sem chamadas reais ao Firebase.');
