"use strict";
const fs=require('fs');const assert=require('assert/strict'); const ts=require('typescript');
const read=p=>fs.readFileSync(p,'utf8');
const server=read('src/lib/adminPush/server.ts');
const policy=read('src/lib/adminPush/retryPolicy.ts');
const worker=read('src/app/api/integration/worker/route.ts');
const pwa=read('src/components/admin/AdminPwa.tsx');
const center=read('src/components/admin/AdminNotificationCenter.tsx');
const detail=read('src/components/ui/ProductDetailsModal.tsx');
const detailCss=read('src/components/product/ProductPublicPage.module.css');
const home=read('src/app/page.tsx');const homeCss=read('src/app/page.module.css');
const cartStore=read('src/store/cart.store.ts');const cartUi=read('src/components/ui/CartModal.tsx');
const order=read('src/app/api/orders/route.ts');
let total=0;
function check(cond,label){ assert.ok(cond,`V87 R2 — ${label}`);console.log('✓',label);total++; }
const code=ts.transpileModule(policy,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const moduleShim={exports:{}};
new Function('module','exports',code)(moduleShim,moduleShim.exports);
const p=moduleShim.exports;
check(p.mayClaimAdminPush(null,1000).claim,'primeiro pedido pode ser enviado');
check(!p.mayClaimAdminPush({status:'processing',leaseUntilMs:1100},1000).claim,'lease impede corrida');
check(p.mayClaimAdminPush({status:'processing',leaseUntilMs:900},1000).claim,'lease expirado pode recuperar');
check(!p.mayClaimAdminPush({status:'sent'},1000).claim,'push enviado não repete');
check(!p.mayClaimAdminPush({status:'retry',nextAttemptAtMs:1200},1000).claim,'backoff respeitado');
check(p.mayClaimAdminPush({status:'retry',nextAttemptAtMs:900},1000).claim,'backoff vencido elegível');
check(!p.mayClaimAdminPush({status:'retry',attemptCount:6},1000).claim,'tentativas têm limite');
check(!p.mayClaimAdminPush({status:'retry',firstSeenAtMs:1000},1000+61*60*1000).claim,'push antigo expira');
check(p.retryDelayMs(3)>p.retryDelayMs(1),'backoff crescente');
check(p.retryDelayMs(8)<=120000,'backoff com teto');
check(server.includes('adminDb.runTransaction(async (tx) =>')&&server.includes('leaseId'), 'claim transacional com lease');
check(server.includes('successfulTokenHashes')&&server.includes('!successful.has(item.hash)'), 'FCM não reenvia para token confirmado');
check(server.includes('invalidTokenHashes')&&server.includes('invalidTokenCode'), 'token inválido isolado');
check(server.includes('nextAttemptAtMs')&&server.includes('retryPendingAdminPushes'), 'retry durável limitado');
check(server.includes('.where("status","==","retry").limit(24)') && server.includes('.where("status","==","processing").limit(8)'), 'consulta limitada evita varrer coleção');
check(server.includes('status.includes("cancel")') && server.includes('status.includes("finaliz")'), 'pedido terminal não dispara aviso atrasado');
check(worker.includes('retryPendingAdminPushes(5)') && worker.includes('if(!authorized(req))'), 'worker reaproveita autenticação');
check(worker.includes('adminPush.failed===0'), 'worker reporta falhas sem mascarar estado');
check(pwa.includes('dfl:admin-push-sync-failed') && pwa.includes('dfl:admin-push-sync-complete'), 'Admin sinaliza sucesso e falha real');
check(center.includes('setMessage("Token sincronizado com sucesso') && !center.includes('setMessage("Diagnóstico atualizado.")'), 'central não anuncia falso sucesso');
check(center.includes('window.removeEventListener("dfl:admin-push-sync-failed", onSyncFailed)'), 'não acumula listeners');
check(detail.includes('quantity >= 30') && detail.includes('Math.min(30, q + 1)') && detail.includes('aria-label="Aumentar quantidade"'), 'limite UI alinhado ao servidor');
check(order.includes('quantity > 30'), 'API preserva limite autoritativo');
check(cartStore.includes('clampCartQuantity(i.quantity + quantity)') && cartStore.includes('clampCartQuantity(i.quantity + 1)'), 'carrinho respeita limite no merge e stepper');
check(cartStore.includes('replaceItems: (items) => set({ items: items.map('), 'reconciliação do carrinho normaliza quantidade');
check(cartUi.includes('disabled={item.quantity >= 30}'),'botão + do carrinho respeita 30');
check(home.includes('searchInputRef.current?.focus()') && home.includes('aria-keyshortcuts="Control+K Meta+K"'),'busca acessível Ctrl K');
check(home.includes('window.removeEventListener("keydown", onShortcut)') && !home.includes('onSnapshot('), 'busca sem listener Firestore nem listener pendurado');
check(homeCss.includes('DFL SITE V87 R2 — CATALOG KEYBOARD SEARCH'),'feedback visual da busca');
check(order.includes('IDEMPOTENCY_CONFLICT')&&order.includes('sendAdminNewOrderPush'), 'checkout original preservado');
check(detailCss.includes('DFL SITE V87 R2 — PRODUCT DETAIL REFINEMENT')&&detailCss.includes('prefers-reduced-motion:reduce'), 'efeitos premium acessíveis');
check(!worker.includes('setInterval(') && !server.includes('onSnapshot('), 'backend sem polling/listener novo');
for(const path of [
 'src/lib/adminPush/server.ts', 'src/lib/adminPush/retryPolicy.ts',
 'src/app/api/integration/worker/route.ts', 'src/components/admin/AdminPwa.tsx',
 'src/components/admin/AdminNotificationCenter.tsx', 'src/components/ui/ProductDetailsModal.tsx']){
 const c=read(path);
 const t=ts.transpileModule(c,{fileName:path,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}});
 const errors=(t.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error);
 check(errors.length===0,'sintaxe TypeScript/TSX: '+path);
}
console.log(`DFL SITE V87 R2 — ${total} contratos aprovados.`);
