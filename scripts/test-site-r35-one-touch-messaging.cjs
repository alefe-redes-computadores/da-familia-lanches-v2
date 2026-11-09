#!/usr/bin/env node
'use strict';
/** R35 — client consent is an affirmative action, not an inferred phone or default tick. */
const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
let passed=0;const ok=(value,label)=>{assert.ok(value,label);passed++};
const checkout=fs.readFileSync('src/components/ui/CheckoutModal.tsx','utf8');
const css=fs.readFileSync('src/components/ui/CheckoutModal.module.css','utf8');
const api=fs.readFileSync('src/app/api/orders/route.ts','utf8');
const gate=fs.readFileSync('src/lib/integration/server/messagingR11Policy.ts','utf8');
const proj=fs.readFileSync('src/lib/integration/server/messagingProjection.ts','utf8');
const ast=ts.createSourceFile('CheckoutModal.tsx',checkout,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
ok(ast.parseDiagnostics.length===0,'valid TSX parser');
ok(checkout.includes('const finishOrder = async (consentChoice: boolean) => {'),'consent controlled only by chosen action');
ok(checkout.includes('if(submittingRef.current) return;'),'duplicate submit guard preserved');
ok((checkout.match(/whatsappNotificationsConsent: consentChoice,/g)||[]).length===2,'guest and Google use same affirmative opt-in');
ok((checkout.match(/finishOrder\(true\)/g)||[]).length===1,'single affirmative WhatsApp action');
ok((checkout.match(/finishOrder\(false\)/g)||[]).length===1,'single no-WhatsApp action');
ok(!checkout.includes('checked={whatsappNotificationsConsent}')&&!checkout.includes('setWhatsappNotificationsConsent('),'no prechecked or hidden checkbox');
ok(!/whatsappNotificationsConsent:\s*true\b/.test(checkout),'no forced consent in client payload');
ok(checkout.includes('Confirmar pedido + receber avisos')&&checkout.includes('Autorizo a Da Família Lanches'),'brand and scope clearly explained');
ok(checkout.includes('Confirmar pedido sem avisos no WhatsApp'),'purchase available without opt-in');
ok(checkout.includes('Acompanhe pelo Site mesmo sem ativar o WhatsApp'),'order tracking independent of WhatsApp');
ok(checkout.includes('A escolha vale somente para este pedido'),'no persistent opt-in');
ok(checkout.includes('type="button" onClick={() => void finishOrder(true)}'),'intent requires actual user click');
ok(checkout.includes('type="button" onClick={() => void finishOrder(false)}'),'negative choice requires actual user click');
ok(checkout.includes('disabled={loading || !isOnline}'),'cannot double-submit or submit while offline');
ok(checkout.includes('setStep(1)')&&checkout.includes('Voltar e conferir dados'),'back navigation maintained');
for(const marker of ['.r35NotificationChoice','.r35NotificationConfirm','.r35NotificationWithout','.r35NotificationBack','.r35NotificationActions'])
  ok(css.includes(marker),'premium CSS present '+marker);
ok(css.includes('min-height:52px')&&css.includes('safe-area-inset-bottom'),'mobile tap and safe-area');
ok(css.includes('prefers-reduced-motion:reduce'),'motion accessibility');
ok(api.includes('incoming.whatsappNotificationsConsent === true'),'server does not infer permission from phone');
ok(api.includes('whatsappNotificationsConsentAt: incoming.whatsappNotificationsConsent === true ? occurredAt : null'),'consent timestamp captured only with yes');
ok(api.includes('whatsappNotificationsConsentSource: incoming.whatsappNotificationsConsent === true ? "checkout_r12_explicit" : null'),'explicit provenance preserved');
ok(gate.includes("return 'explicit_consent_missing'")&&gate.includes('order.whatsappNotificationsConsent !== true'),'worker fail closed without explicit permission');
ok(proj.includes("r11SiteMessageGate({eventType,sourceEventType:"),'server gate before provider preserved');
ok(checkout.includes('orderAttemptRef.current')&&checkout.includes('clearConfirmedCart'),'no changes to idempotency and cart atomicity');
ok(checkout.includes('sourceSystem: "dfl_site"')&&checkout.includes('checkoutChannel: "site"'),'canonical order metadata unchanged');
// Parse count of actual button declarations to ensure no new implicit side effects.
let yes=0,no=0;function visit(n){if(ts.isJsxAttribute(n)&&n.name.text==='onClick'){
 const body=n.initializer?.getText(ast)||'';if(body.includes('finishOrder(true)'))yes++;if(body.includes('finishOrder(false)'))no++;
}ts.forEachChild(n,visit);}visit(ast);
ok(yes===1&&no===1,'one-click actions bound as JSX event handlers');
console.log(`R35 SITE — ${passed} contratos herméticos aprovados; sem rede, Firestore, Supabase ou WhatsApp.`);
