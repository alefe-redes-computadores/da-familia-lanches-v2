#!/usr/bin/env node
'use strict';
(async () => {
const assert=(await import('node:assert/strict')).default;const fs=(await import('node:fs')).default;const ts=(await import('typescript')).default;
const read=p=>fs.readFileSync(p,'utf8');let n=0;const ok=(v,msg)=>{assert.ok(v,'R62 SITE '+msg);n++};
const guard=read('src/lib/tracking/r41PilotRecipient.ts'),home=read('src/app/page.tsx'),css=read('src/app/page.module.css');
for(const [path,source] of [['src/app/page.tsx',home],['src/lib/tracking/r41PilotRecipient.ts',guard]]){
 const ast=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,path.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 ok(ast.parseDiagnostics.length===0,`AST ${path}`);
}
const compiled=ts.transpileModule(guard,{fileName:'src/lib/tracking/r41PilotRecipient.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={};new Function('exports',compiled)(mod);const eligible=mod.r41TrackingPilotRecipient;
const good='+5534999999999',other='+5534988888888';
const base={DFL_SITE_TRACKING_AUTO_PILOT_PHONE_E164:good};
ok(eligible(base,good),'canario padrao autoriza somente piloto');
ok(!eligible(base,other),'canario bloqueia outro numero');
const accepted={...base,DFL_SITE_TRACKING_AUTO_SCOPE:'consented_customers',DFL_SITE_TRACKING_AUTO_ROLLOUT_APPROVED:'true'};
ok(eligible(accepted,good) && eligible(accepted,other),'rollout autorizado atende outros celulares validos');
ok(!eligible({...accepted,DFL_SITE_TRACKING_AUTO_ROLLOUT_APPROVED:'false'},other),'rollout necessita aprovacao');
ok(eligible(accepted,'+553499999999'),'telefone BR de oito digitos valido pelo contrato');
for(const p of ['',undefined,'5534999999999','+55349999999','+55349999999990',null,{},'abc'])ok(!eligible(accepted,p),'telefone invalido bloqueado');
for(const scope of ['*','all','', 'authorized_clients'])if(scope)ok(!eligible({...accepted,DFL_SITE_TRACKING_AUTO_SCOPE:scope},other),'escopo estranho bloqueado');
ok(home.includes('aria-controls="dfl-search-preview"')&&home.includes('aria-autocomplete="list"'),'busca com sugestoes acessiveis');
ok(home.includes('rankCatalogProducts(eligible, search)')&&home.includes('liveSearchMatches.slice(0, 4)'),'sugestoes do catalogo local');
ok(home.includes('onKeyDown={(event) => { if (event.key === "Enter")')&&home.includes('submitCatalogSearch(product.name)'),'enter e toque acionam pesquisa');
ok(home.includes('id="dfl-search-results"')&&home.includes('target.scrollIntoView'),'navegacao vai aos resultados');
ok(home.includes('setSearchSubmitSeq(value => value + 1)') && home.includes('[catalogLoading, deferredSearch, search, searchSubmitSeq]'),'Enter rola mesmo ao repetir busca existente');
ok(home.includes('!search.trim() && activeCategory === "todos" && campaignMatchesCatalogOffer'),'banner nao esconde resultados');
ok(home.includes('!search.trim() && activeCategory === "todos" && (\n        <div className={styles.orderSlot}>'),'card de pedido nao compete com busca');
ok(css.includes('scroll-margin-top:calc(142px')&&css.includes('.searchPreviewChoice:focus-visible'),'offset sticky e acessibilidade');
ok(!/\bonSnapshot\(|\bgetDocs\(|\bgetDoc\(|\bfetch\(/.test(guard),'guard sem dados novos');
ok(home.includes('type="button" className={styles.cardActionArea} onClick={() => openProduct(product)}'),'botao produto nativo mantém ativacao por teclado');
const acceptance=read('src/lib/tracking/automaticAcceptancePolicy.ts'),delivery=read('src/lib/tracking/r27AutomaticDelivery.ts');
ok(acceptance.includes('whatsappNotificationsConsent !== true')&&acceptance.includes("checkout_r12_explicit"),'consentimento explicito obrigatorio');
ok(delivery.includes('r41TrackingPilotRecipient(process.env,customer.phoneE164)'),'mesma guarda antes do grant');
ok(delivery.includes('const state=await r25SendInitialOnce'),'emissao unica preservada');
console.log('R62 SITE: '+n+' contratos hermeticos aprovados. ZERO envio.');
})().catch((error) => { console.error(error); process.exitCode=1; });
