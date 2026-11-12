import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (p) => fs.readFileSync(p, 'utf8');
const nudge = read('src/components/layout/DFLAssistFloatingNudge.tsx');
const shell = read('src/components/layout/AppShell.tsx');
const css = read('src/components/layout/DFLAssistFloatingNudge.module.css');
const assist = read('src/components/layout/DFLAssist.tsx');
const r102 = read('scripts/test-site-r102-preopening.cjs');
const checks = [
 ['componente flutuante segue montado no AppShell', shell.includes('<DFLAssistFloatingNudge />')],
 ['assistente real continua respondendo ao evento', assist.includes('window.addEventListener("dfl:assist-open", show)')],
 ['o atalho abre o assistente real', nudge.includes('window.dispatchEvent(new Event("dfl:assist-open"))')],
 ['chave de recusa nova separada de aberturas legadas', nudge.includes('const dismissKey = "dfl:assist-floating-dismissed-r61";')],
 ['abrir o assistente NAO esconde para sempre', !nudge.includes('const onAssistOpened =') && !nudge.includes('window.addEventListener("dfl:assist-open", onAssistOpened)')],
 ['guia anterior nao impede atalho', !nudge.includes('localStorage.getItem(tourKey)') && !nudge.includes('const tourKey =')],
 ['recusa persiste SOMENTE no clique do X', /className=\{styles\.dismiss\} onClick=\{\(\) => \{ setDismissed\(true\); try \{ localStorage\.setItem\(dismissKey, "1"\)/.test(nudge)],
 ['falha de storage nao esconde ajuda', nudge.includes('catch { setDismissed(false); }')],
 ['CTA aparece apos 240 px de rolagem', nudge.includes('window.scrollY >= 240')],
 ['scroll usa requestAnimationFrame com cleanup', nudge.includes('requestAnimationFrame(measure)') && nudge.includes('cancelAnimationFrame(frame)')],
 ['perto do rodape deixa de obstruir links', nudge.includes('IntersectionObserver') && nudge.includes('footerNear') && nudge.includes('data-dfl-campaign-footer')],
 ['observer do rodape e desconectado', nudge.includes('observer.disconnect()')],
 ['rotas secundarias e modais nao mostram botao', nudge.includes('pathname !== "/"') && nudge.includes('Boolean(activeModal)')],
 ['teclado e input escondem CTA', nudge.includes('inputActive') && nudge.includes('focusin') && nudge.includes('focusout')],
 ['digitacao apenas uma vez por sessao', nudge.includes('sessionStorage.getItem(sessionKey)') && nudge.includes('sessionStorage.setItem(sessionKey')],
 ['prefers reduced motion preservado', nudge.includes('prefers-reduced-motion') && css.includes('prefers-reduced-motion')],
 ['toque e foco acessiveis', css.includes('touch-action:manipulation') && css.includes(':focus-visible')],
 ['safe area e navbar preservadas', css.includes('safe-area-inset-bottom') && css.includes('bottom:calc(114px')],
 ['gate CI R102 tambem protege a correcao', r102.includes('CTA volta apos Assist/tour')],
 ['estado de recusa lido apos commit via frame', nudge.includes('const storageFrame = window.requestAnimationFrame(() => {') && nudge.includes('window.cancelAnimationFrame(storageFrame)')],
 ['rota secundaria nao atualiza estado durante efeito', nudge.includes('if (pathname !== "/") return;') && !nudge.includes('setPastThreshold(false); return;')],
 ['medicao inicial agendada antes do scroll', nudge.includes('frame = window.requestAnimationFrame(measure);')],
 ['animacao de entrada nao gera render em cascata', nudge.includes('const introFrame = window.requestAnimationFrame(() => {') && nudge.includes('window.cancelAnimationFrame(introFrame)')],
 ['fase hold apenas em timer ou frame', nudge.includes('if (length >= message.length) setPhase("hold");') && nudge.includes('length >= message.length ? 0 : 90')],
 ['sem bypass de regras React', !nudge.includes('eslint-disable') && !nudge.includes('setPastThreshold(false); return;')],
 ['sem novas consultas ou escrita de pedidos', !/fetch\(|onSnapshot\(|setDoc\(|addDoc\(|createCustomerOrder|runTransaction\(/.test(nudge)],
];
for(const [label, pass] of checks){
  assert.ok(pass,'R61: '+label);
  console.log('OK:',label);
}
console.log('R61: '+checks.length+' contratos de visibilidade, privacidade, rodape e acessibilidade OK.');
