'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const read = file => fs.readFileSync(file, 'utf8');
const paths = [
  'src/components/layout/DFLAssistFloatingNudge.tsx',
  'src/components/layout/DFLAssistHelpDesk.tsx',
  'src/components/layout/DFLAssist.tsx',
  'src/components/layout/AppShell.tsx',
  'src/lib/dflAssistGuidance.ts',
];
for(const path of paths){
  const parsed=ts.createSourceFile(path,read(path),ts.ScriptTarget.Latest,true,path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  assert.equal(parsed.parseDiagnostics.length,0,`TS parse ${path}`);
}
const float = read(paths[0]);
const help=read(paths[1]);
const assist=read(paths[2]);
const shell=read(paths[3]);
const floatCss=read('src/components/layout/DFLAssistFloatingNudge.module.css');
const helpCss=read('src/components/layout/DFLAssistHelpDesk.module.css');
assert(float.includes('scrollY >= 240') && float.includes('requestAnimationFrame'), 'scroll sem re-render a cada pixel');
assert(float.includes('sessionStorage.getItem(sessionKey)') && float.includes('sessionStorage.setItem(sessionKey'), 'digitacao uma vez por sessao');
assert(float.includes('prefers-reduced-motion') && float.includes('setPhase("typing")'), 'motion de acordo com preferencia');
assert(float.includes('Boolean(activeModal)') && float.includes('pathname !== "/"'), 'nunca cobre modal ou rota secundaria');
assert(float.includes('window.dispatchEvent(new Event("dfl:assist-open"))'), 'aciona assistente ja existente');
assert(float.includes('setDismissed(true)') && float.includes('localStorage.getItem(dismissKey)') && float.includes('localStorage.setItem(dismissKey'), 'CTA dispensavel com recusa persistente');
assert(float.includes('focusin') && float.includes('inputActive'), 'CTA nao atrapalha teclado e inputs');
assert(floatCss.includes('env(safe-area-inset-bottom') && floatCss.includes('prefers-reduced-motion') && floatCss.includes('conic-gradient') && floatCss.includes('focus-visible'), 'contorno animado pontual e acessivel');
assert(help.includes('getDFLHelpAnswer') && help.includes('role="status"'), 'orientacao deterministica');
assert(help.includes('onOpenOrders') && help.includes('onOpenCart') && help.includes('onTour'), 'acoes utilitarias reais');
assert(help.includes('businessWhatsAppUrl(') && help.includes('rel="noopener noreferrer"'), 'fallback humano seguro');
assert(helpCss.includes('focus-visible') && helpCss.includes('prefers-reduced-motion'), 'acessibilidade');
assert(assist.includes('<DFLAssistHelpDesk onTour='), 'assistente integra suporte inteligente');
assert(assist.includes('<DFLAssistOffers onFindProduct={search}') && assist.includes('Não é atendimento por IA generativa'), 'catalogo existente preservado');
assert(shell.includes('<DFLAssistFloatingNudge />') && shell.includes('<DFLAssistInvitation />'), 'nao remove convite da R250');
for(const path of [paths[0],paths[1],paths[4]])assert(!/createCustomerOrder|runTransaction\(|setDoc\(|addDoc\(|\/api\/orders|fetch\(/.test(read(path)),`sem escrita de pedidos ${path}`);
const helper=read(paths[4]);
const js=ts.transpileModule(helper,{fileName:paths[4],compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const helperExports={};vm.runInNewContext(js,{exports:helperExports,console}, {filename:'dflAssistGuidance.cjs'});
for(const [text,expected] of [
 ['meu pedido não chegou','order'],
 ['quero acompanhar meus pedidos','order'],
 ['Não consigo finalizar o pedido','checkout'],
 ['qual o bairro e endereço?', 'address'],
 ['pix ou cupom?', 'payment'],
 ['quero falar com um atendente','human'],
 ['quero combo para 4 pessoas','catalog'],
])assert.equal(helperExports.classifyDFLHelp(text),expected,`intencao ${text}`);
const confirm=helperExports.getDFLHelpAnswer('não consigo finalizar');
assert(confirm.caution.includes('Meus Pedidos') && confirm.action==='tour','pedido incerto protegido');
assert(helperExports.getDFLHelpAnswer('não recebi pedido').action==='orders','não sugere nova compra');
console.log('R251 ASSIST — flutuante, escrita uma vez, intents, no-duplicate, performance, CSS e mobile: OK');
