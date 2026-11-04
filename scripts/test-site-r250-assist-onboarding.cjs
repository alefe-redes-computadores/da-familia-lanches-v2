'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const read = file => fs.readFileSync(file, 'utf8');
const files = [
  'src/components/layout/DFLAssist.tsx',
  'src/components/layout/DFLAssistWalkthrough.tsx',
  'src/components/layout/DFLAssistInvitation.tsx',
  'src/components/ui/CheckoutAssistHelp.tsx',
  'src/components/layout/AppShell.tsx',
  'src/components/layout/Header.tsx',
  'src/components/ui/CheckoutModal.tsx',
];
for (const file of files) {
  const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(source.parseDiagnostics.length, 0, `${file}: TSX parse`);
}
const assist=read(files[0]), tour=read(files[1]), invite=read(files[2]), checkoutHelp=read(files[3]);
const shell=read(files[4]), header=read(files[5]), checkout=read(files[6]);
const css=read('src/components/layout/DFLAssist.module.css');
const inviteCss=read('src/components/layout/DFLAssistInvitation.module.css');
const checkoutCss=read('src/components/ui/CheckoutAssistHelp.module.css');
const headerCss=read('src/components/layout/header.module.css');
for (const s of ['window.addEventListener("dfl:assist-open"','window.removeEventListener("dfl:assist-open"','CATALOG_SEARCH_EVENT','dfl:pending-catalog-search','DFLAssistOffers onFindProduct={search}','openModal("product-details", product)','openModal("cart")','businessWhatsAppUrl(','não confirma nem cria um pedido','não são enviados automaticamente']) {
  assert(assist.includes(s),`regressao Assist: ${s}`);
}
assert(assist.includes('if (!visible) return null;'), 'assistente nao monta catalogo sem abrir');
assert(assist.includes('!window.localStorage.getItem(tourKey)') && assist.includes('setItem(tourKey'), 'primeiro acesso persistido');
assert(assist.includes('DFLAssistWalkthrough onDone={finishTour} onSkip={finishTour}'), 'tour integrado');
assert(assist.includes('Não é atendimento por IA generativa'), 'nao apresentar como bot generativo');
assert(tour.includes('tourSteps.map') && tour.includes('Avançar') && tour.includes('Voltar') && tour.includes('Pular apresentação'), 'navegacao tour');
assert(tour.includes('consulte Meus Pedidos antes de tentar outra vez'), 'protege pedido incerto');
assert(tour.includes('businessWhatsAppUrl('), 'fallback humano no tour');
assert(invite.includes('localStorage.getItem(inviteKey)') && invite.includes('localStorage.getItem(tourKey)'), 'primeira visita discreta');
assert(invite.includes('pathname !== "/" || activeModal') && invite.includes('window.scrollY < 100'), 'sem obstruir checkout ou scroll');
assert(invite.includes('new CustomEvent("dfl:assist-open"'), 'abre guia por evento existente');
assert(shell.includes('<DFLAssistInvitation />') && shell.includes('<DFLAssist />'), 'app shell publico preservado');
assert(header.includes('styles.assistLauncher') && header.includes('dfl:assist-open'), 'atalho antigo preservado');
assert(checkout.includes('<CheckoutAssistHelp checkoutStep={step} hasError={Boolean(errorMessage)} uncertain={orderOutcomeUncertain} />'), 'checkout exibe ajuda contextual');
assert(checkoutHelp.includes('aria-expanded={expanded}') && checkoutHelp.includes('useId()'), 'help acessivel');
assert(checkoutHelp.includes('Confira Meus Pedidos antes de tentar outra compra'), 'checkout alerta pedido incerto');
assert(checkoutHelp.includes('businessWhatsAppUrl('), 'atendimento presente');
for (const s of ['tourHero','tourProgress','openTour','focus-visible','prefers-reduced-motion']) assert(css.includes(s),`visual do tour ${s}`);
for (const s of ['safe-area-inset-bottom','focus-visible','prefers-reduced-motion']) assert(inviteCss.includes(s),`visual do convite ${s}`);
for (const s of ['focus-visible','prefers-reduced-motion']) assert(checkoutCss.includes(s),`visual checkout help ${s}`);
assert(headerCss.includes('.assistLauncher svg') && headerCss.includes('prefers-reduced-motion'), 'efeito suave sem rotacao permanente');
for (const file of [files[1],files[2],files[3]]) {
  const s=read(file);
  assert(!/createCustomerOrder|runTransaction\(|setDoc\(|addDoc\(|\/api\/orders|fetch\(/.test(s),`efeito colateral proibido ${file}`);
}
const v3=read('src/lib/comboUnitOrderV3Candidate.ts');
for(const flag of ['PUBLIC_CHECKOUT','ORDERS','ENTREGAS_ACCEPTANCE','LIVE_PRINT']) assert(v3.includes(`COMBO_V3_${flag}_ENABLED = false`),`V3 deve permanecer OFF: ${flag}`);
console.log('R250 DFL ASSIST — onboarding, convite, checkout, privacidade e V3 OFF: 32+ contratos OK');
