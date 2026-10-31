"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const ts = require("typescript");
const source = fs.readFileSync("src/lib/orderOutcomeRecovery.ts", "utf8");
const js = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const exportsHolder = {exports:{}};
new Function("module","exports",js)(exportsHolder,exportsHolder.exports);
const needsReview = exportsHolder.exports.orderOutcomeNeedsReview;
assert.equal(typeof needsReview, "function");
for (const code of ["ORDER_TIMEOUT","ORDER_NETWORK","SERVICE_BUSY","SERVICE_UNAVAILABLE","ORDER_FAILED","","UNKNOWN_RESPONSE"])
  assert.equal(needsReview(code), true, `resposta incerta: ${code}`);
for (const code of ["SERVICE_CONFIG","ADDRESS_INVALID","PRICE_CHANGED","IDEMPOTENCY_CONFLICT","COUPON_EXPIRED","ADDON_GROUP_INVALID","SCHEDULE_REQUIRED"])
  assert.equal(needsReview(code), false, `rejeicao explicita: ${code}`);
const checkout = fs.readFileSync("src/components/ui/CheckoutModal.tsx", "utf8");
assert.ok(checkout.includes('if (orderOutcomeNeedsReview(code) && orderAttemptRef.current)'), "erro incerto precisa verificar mesma tentativa");
assert.ok(checkout.includes('const resolved = await resolveCheckoutAttempt(orderAttemptRef.current, currentUser ? "google" : "guest")'), "consulta read-only por chave da tentativa");
assert.ok(checkout.includes('if (resolved.outcome === "found")'), "recuperacao de pedido ja criado");
assert.ok(checkout.includes('openModal("order-success", {'), "reconciliacao para sucesso");
assert.ok(checkout.includes('setOrderOutcomeUncertain(true)'), "mesmo not_found ainda e incerto");
assert.ok(checkout.includes('!orderOutcomeUncertain && fallbackWhatsAppUrl'), "bloqueio visual do WhatsApp com pedido incerto");
assert.ok(checkout.includes('openModal("orders")') && checkout.includes('Conferir Meus Pedidos'), "CTA de consulta");
assert.ok(checkout.includes('canOfferManualOrderFallback(code)'), "fallback apenas em erros permitidos");
assert.ok(checkout.includes('clearOrderAttempt()') && checkout.includes('clientRequestId'), "idempotencia preservada");
assert.ok(!source.includes('firebase/'), "politica pura isolada do Firestore");
const policy = fs.readFileSync(".github/workflows/site-sales-protection.yml", "utf8");
assert.ok(policy.includes('node scripts/test-site-sales-r5-ui-recovery.cjs'), "CI atual de recuperacao R5 preservado");
assert.ok(policy.includes('node scripts/test-site-r228-checkout-compat.cjs'), "gate novo R228 no CI");
console.log("R228 CHECKOUT: 14 politicas + 12 contratos modernos de protecao, sem pedidos reais");
