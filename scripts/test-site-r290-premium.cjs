'use strict';
/* R290: visual read-only, assertions of actual source; no network/Firestore/order creation */
const fs=require('node:fs');
const assert=require('node:assert/strict');
const ts=require('typescript');
const read=p=>fs.readFileSync(p,'utf8');
const files={
 assist:'src/components/layout/DFLAssist.tsx',
 offers:'src/components/layout/DFLAssistOffers.tsx',
 floating:'src/components/layout/DFLAssistFloatingNudge.tsx',
 shell:'src/components/layout/AppShell.tsx',
 assistCss:'src/components/layout/DFLAssist.module.css',
 shellCss:'src/components/layout/AppShell.module.css',
 footerCss:'src/components/layout/Footer.module.css',
 pageCss:'src/app/page.module.css',
};
let n=0;const ok=(v,detail)=>{assert.ok(v,'R290: '+detail);n++};
for(const key of ['assist','offers','floating','shell']){
  const code=read(files[key]);
  const ast=ts.createSourceFile(files[key],code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  ok(ast.parseDiagnostics.length===0,'AST TSX: '+key+' '+ast.parseDiagnostics.map(x=>x.messageText).join(';'));
  const translated=ts.transpileModule(code,{fileName:files[key],compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022, module:ts.ModuleKind.CommonJS},reportDiagnostics:true});
  ok(!(translated.diagnostics||[]).some(d=>d.category===ts.DiagnosticCategory.Error),'transpile '+key);
}
const a=read(files.assist),o=read(files.offers),f=read(files.floating),sh=read(files.shell);
const css=read(files.assistCss),sc=read(files.shellCss),fc=read(files.footerCss),pc=read(files.pageCss);
ok(a.indexOf('<DFLAssistOffers onFindProduct={search}')<a.indexOf('<DFLAssistHelpDesk onTour='),'busca antes de guia');
ok(a.includes('<details className={styles.assistMore}>') && a.includes('Ajuda e passo a passo') && a.includes('Outras ações'),'ajuda e acoes por disclosure');
ok(a.includes('O WhatsApp é atendimento, não confirma nem cria um pedido'),'disclaimer WhatsApp preservado');
ok(a.includes('Não é atendimento por IA generativa') && a.includes('role="dialog"') && a.includes('aria-modal="true"'),'sem prometer IA e acessibilidade');
ok(a.includes('setVisible(false);') && a.includes('onOpenProduct={(product: Product)'),'detalhe produto navegavel');
ok(a.includes('document.body.style.overflow = "hidden"') && a.includes('event.key === "Escape"') && a.includes('prior.focus({ preventScroll: true })'),'foco, Escape, scroll restaurados');
ok(o.includes('placeholder="O que você quer comer?"') && o.includes('aria-label={offers.length ? "Abrir primeira sugestão"'),'campo e acao cabem no celular');
ok(o.includes('const [showAdvanced, setShowAdvanced]') && o.includes('hidden={!showAdvanced}') && o.includes('aria-expanded={showAdvanced}'),'filtros progressivos sem perder estado');
ok(o.indexOf('className={styles.offerSearchRow}')<o.indexOf('className={styles.quickSearch}'),'busca acima dos atalhos');
ok(o.includes('onClick={findFromIntent}') && o.includes('onOpenProduct(orderedOffers[0].product)'),'CTA abre produto real');
ok(o.includes('useCatalog()') && o.includes('source === "hybrid"') && o.includes('recommendDFLProducts(products, { people, budget, onlyCombos, query }, 4)'),'catalogo autoritativo preservado');
ok(o.includes('intent.hasExclusion') && o.includes('contaminação cruzada') && o.includes('Confira com a equipe'),'aviso de ingrediente preservado');
ok(o.includes('className={styles.assistComposition}') && o.includes('Composição cadastrada') && o.includes('productLookup.has(component.productId)'),'composicao verificavel, recolhida');
ok(!/createCustomerOrder|addToCart\(|runTransaction\(|setDoc\(|addDoc\(|fetch\(/.test(o),'assist sem venda, Firebase ou rede direta');
ok(f.includes('IntersectionObserver') && f.includes('data-dfl-campaign-footer') && f.includes('footerNear'),'convite nao tampa rodape');
ok(f.includes('removeAttribute("data-dfl-footer-near")') && f.includes('observer.disconnect()'),'observer limpo no unmount');
ok(f.includes('prefers-reduced-motion') && f.includes('sessionStorage.getItem(sessionKey)'),'animacao por sessao e motion reduzido');
ok(sh.includes('data-dfl-route={pathname === "/" ? "home" : "other"}') && sh.includes('<MobileBottomNav />'),'home isolada, nav intacta');
ok(sc.includes('data-dfl-route="home"') && sc.includes('padding-bottom:0') && sc.includes('scroll-padding-bottom:calc(108px'),'shell corrige gap preservando anchor da nav');
ok(pc.includes('padding-bottom:calc(130px') && pc.includes('.page .content{padding-bottom:clamp(24px,5vw,44px)}'),'home retira reserva acumulada; legado mantido');
ok(pc.includes('data-dfl-footer-near') && pc.includes('pointer-events:none'),'atalho home nao cobre rodape');
ok(fc.includes('safe-area-inset-bottom') && fc.includes('padding-bottom:calc(94px') && fc.includes('.legal{color:#bcbcbc}'),'rodape legivel, nav protegida');
ok(css.includes('.advancedSection[hidden]{display:none!important}') && css.includes('.offerSearchRow{display:grid;grid-template-columns:minmax(0,1fr) 72px'),'filtros e campo responsivos');
ok(css.includes('.panel .header{gap:9px;padding:8px 10px') && css.includes('.panel .header .close{margin-left:auto;flex:0 0 44px'),'cabecalho compacto, fechar acessivel');
ok(css.includes('@media(max-height:560px)') && css.includes('prefers-reduced-motion:reduce'),'viewport baixa e motion');
console.log(`R290 PREMIUM: ${n} verificacoes locais APROVADAS (sem rede, Firestore, mensagens ou vendas).`);
