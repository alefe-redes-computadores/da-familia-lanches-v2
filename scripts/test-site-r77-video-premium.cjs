'use strict';
/* Teste de codigo-fonte / AST; nunca acessa clientes, pagamentos ou WhatsApp. */
const fs=require('node:fs');const assert=require('node:assert/strict');const ts=require('typescript');let n=0;
const read=p=>fs.readFileSync(p,'utf8');const ok=(v,name)=>{assert.ok(v,'R77: '+name);n++};
const home=read('src/app/page.tsx'),homeCss=read('src/app/page.module.css'),header=read('src/components/layout/Header.tsx');
const headerCss=read('src/components/layout/header.module.css');const banner=read('src/components/layout/VisualCampaignBanner.tsx');
const bannerCss=read('src/components/layout/VisualCampaignBanner.module.css');
const info=read('src/components/home/OrderTrackingInfoCard.tsx'),infoCss=read('src/components/home/OrderTrackingInfoCard.module.css');
const assist=read('src/components/layout/DFLAssistOffers.tsx'),assistCss=read('src/components/layout/DFLAssist.module.css');
const schedule=read('src/lib/storeSchedule.ts'),statusType=read('src/lib/shopStatus.ts');
for(const path of ['src/app/page.tsx','src/components/layout/Header.tsx','src/components/layout/VisualCampaignBanner.tsx','src/components/layout/DFLAssistOffers.tsx','src/lib/storeSchedule.ts','src/lib/shopStatus.ts']){
 const source=read(path);const ast=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);ok(ast.parseDiagnostics.length===0,'AST sem erro '+path);
}
ok(header.includes('shopStatus.nextCloseLabel') && header.includes('shopStatus.nextOpenLabel') && header.includes('Em manutenção'), 'header traz proxima abertura, fechamento e manutencao');
ok(statusType.includes('nextCloseLabel?: string;'), 'contrato de status suporta proximo fechamento');
ok(home.includes('campaign.destination === "url"'), 'campanhas que apenas rolam Home nao exibem hero redundante');
ok(home.includes('shopStatus.source === "exception"') && home.includes('shopStatus.mode === "test_open"'), 'expediente normal sem banner duplicado; excecoes informativas preservadas');
ok(header.includes('compactSearchEditingRef.current') && header.includes('onBlur={() => { compactSearchEditingRef.current = false;'), 'campo nao desmonta no teclado');
ok(headerCss.includes('.compactSearch:focus-within') && headerCss.includes('.compactSearch input:focus-visible{outline:0'), 'foco discreto mas visivel no contorno externo');
ok(banner.includes('data-collapsed={collapsed?"true":"false"}') && banner.includes('aria-expanded={!collapsed}'), 'banner recolhivel com estado acessivel');
ok(banner.includes('if(campaign.destination==="offers")') && banner.includes('dfl:campaign-offers-open'), 'CTA campanha preservado');
ok(bannerCss.includes('.collapseToggle') && bannerCss.includes('wrap[data-collapsed="true"]'), 'controle de campanha com estilo responsivo');
ok(homeCss.includes('.page .r104OfferCard{background:linear-gradient') && homeCss.includes('.r104OffersPreview::-webkit-scrollbar'), 'vitrine dark e rolagem limpa');
ok(home.includes('rankCatalogProducts(eligible, search)') && home.includes('R20_SEARCH_HINTS'), 'busca e placeholder progressivo preservados');
ok(home.includes('showcaseProducts.length > 0') && home.includes('<OrderTrackingInfoCard />'), 'home preserva fontes de dados e chamada do card');
ok(info.includes('Seu pedido, acompanhado de verdade') && info.includes('quando o acompanhamento é liberado'), 'texto de consentimento e fluxo de tracking preservado');
ok(infoCss.includes('R77: card informativo') && infoCss.includes('.features{display:none}'), 'card compacto no celular');
ok(assist.includes('product.bundleItems!.map((component,index)') && assist.includes('item?.description?.trim()'), 'ingredientes dos produtos reais, sem hardcode');
ok(assist.includes('productLookup.get(component.productId)') && assist.includes('onOpenProduct(product)'), 'itens do catalogo e CTA de detalhes preservados');
ok(assistCss.includes('.r77BundleParts') && assistCss.includes('.offerList .r77BundleParts li'), 'lista interna nao herda grid do card');
// Regras de horario testadas em America/Sao_Paulo, sem rede.
const js=ts.transpileModule(schedule,{fileName:'storeSchedule.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};new Function('module','exports',js)(mod,mod.exports);
const {evaluateStoreStatus,DEFAULT_STORE_SETTINGS}=mod.exports;
const make=(changes={})=>({ ...DEFAULT_STORE_SETTINGS,...changes,
  schedule:{...DEFAULT_STORE_SETTINGS.schedule,mon:{enabled:true,open:'17:55',close:'23:30'},thu:{enabled:true,open:'18:00',close:'01:00'},fri:{enabled:false,open:'18:00',close:'23:00'}},exceptions:changes.exceptions??[] });
const local=(str)=>new Date(str);
const before=evaluateStoreStatus(make(),local('2026-11-16T20:00:00Z'));
ok(!before.isOpen&&before.nextOpenLabel==='hoje às 17:55','fechado anuncia proxima abertura real');
const during=evaluateStoreStatus(make(),local('2026-11-16T22:00:00Z'));
ok(during.isOpen&&during.nextCloseLabel==='hoje às 23:30','aberto anuncia fechamento do dia');
const overnightStart=evaluateStoreStatus(make(),local('2026-11-19T23:00:00Z'));
ok(overnightStart.isOpen&&overnightStart.nextCloseLabel==='amanhã às 01:00','abertura noturna informa fechamento amanha');
const overnightEnd=evaluateStoreStatus(make(),local('2026-11-20T03:30:00Z'));
ok(overnightEnd.isOpen&&overnightEnd.nextCloseLabel==='hoje às 01:00','janela que cruza meia-noite continua aberta');
const afterNight=evaluateStoreStatus(make(),local('2026-11-20T04:15:00Z'));
ok(!afterNight.isOpen,'apos fim da janela noturna nao fica aberto');
const phantom=evaluateStoreStatus({...make(),schedule:{...make().schedule,thu:{enabled:false,open:'18:00',close:'01:00'},fri:{enabled:true,open:'18:00',close:'01:00'}}},local('2026-11-20T03:30:00Z'));
ok(!phantom.isOpen,'sexta antes do expediente nao herda aberto falso');
const maintenance=evaluateStoreStatus(make({mode:'test_open'}),local('2026-11-16T22:00:00Z'));
ok(!maintenance.isOpen&&maintenance.mode==='test_open'&&!maintenance.nextCloseLabel,'manutencao nao promete horario');
const force=evaluateStoreStatus(make({mode:'force_open'}),local('2026-11-16T20:00:00Z'));
ok(force.isOpen&&!force.nextCloseLabel,'abertura manual nao inventa fechamento');
const exception=evaluateStoreStatus(make({exceptions:[{date:'2026-11-16',closed:true,label:'Feriado'}]}),local('2026-11-16T22:00:00Z'));
ok(!exception.isOpen&&exception.message==='Feriado','excecao de expediente respeitada');
for(const [path,css] of [['src/app/page.module.css',homeCss],['src/components/layout/header.module.css',headerCss],['src/components/layout/VisualCampaignBanner.module.css',bannerCss],['src/components/home/OrderTrackingInfoCard.module.css',infoCss],['src/components/layout/DFLAssist.module.css',assistCss]]){
 // o parser CSS do projeto ja e dependency; mede sintaxe, nao aprova apenas contagem de chaves.
 try{require('postcss').parse(css,{from:path});ok(true,'CSS AST '+path);}catch(e){throw new Error('CSS invalido: '+path+': '+e.message)}
}
for(const forbidden of ['sendWhatsApp(','issueTrackingLink(','setDoc(','createCustomerOrder(']){
 ok(!banner.includes(forbidden)&&!header.includes(forbidden)&&!assist.includes(forbidden),'sem side effects novos '+forbidden);
}
console.log(`R77: ${n} garantias hermeticas OK; sem rede nem disparos.`);
