"use strict";
/** R42: certificacao offline do fechamento de abertura; sem chamadas remotas. */
const fs = require("node:fs");
const assert = require("node:assert/strict");
const ts = require("typescript");
const read = p => fs.readFileSync(p,"utf8");
let n=0;
function ok(condition, name) { assert.ok(condition,name); n++; console.log("✓",name); }
const enginePath="src/lib/operationShiftReadiness.ts";
const src=read(enginePath);
const compiled=ts.transpileModule(src,{fileName:enginePath,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},reportDiagnostics:true});
ok(!(compiled.diagnostics||[]).some(d=>d.category===ts.DiagnosticCategory.Error),"R41 engine compila isoladamente");
const mod={exports:{}};new Function("module","exports",compiled.outputText)(mod,mod.exports);
const inspect=mod.exports.inspectShiftReadiness;
const report=mod.exports.formatShiftReport;
ok(typeof inspect==="function" && typeof report==="function","funcoes de auditoria exportadas");
ok(mod.exports.SHIFT_SNAPSHOT_TTL_MS===300000,"validade de snapshot em cinco minutos");
const NOW=Date.parse("2026-10-28T14:00:00Z");
const base={activeOrders:0,attentionOrders:0,historyHasMore:false,remoteState:"healthy",checkedAt:new Date(NOW-6000).toISOString(),nowMs:NOW,remoteError:false,outboxPending:0,outboxProcessing:0,outboxFailed:0,outboxDead:0,messagingPending:0,messagingProcessing:0,messagingQuarantined:0,humanInboxChecked:true,humanStorefrontChecked:true,humanCatalogChecked:true,humanHoursChecked:true};
const signal=(v,id)=>inspect(v).signals.find(s=>s.id===id);
const clean=inspect(base);
ok(clean.level==="ok"&&clean.reviews===0&&clean.unknowns===0,"conferencia completa pode estar OK");
ok(clean.signals.length===7,"sete eixos de verificacao presentes");
ok(clean.transportGood===true&&clean.snapshotFresh===true,"transporte vazio so quando consultado recentemente");
for(const [field,id] of [["humanInboxChecked","destination"],["humanStorefrontChecked","storefront"],["humanCatalogChecked","catalog"],["humanHoursChecked","hours"]]){
 const v={...base,[field]:false};
 ok(signal(v,id).level==="unknown",`sem checagem humana: ${id}`);
 ok(inspect(v).level==="unknown",`resumo nao atesta ${id}`);
}
for(const [field,label] of [["outboxPending","outbox pendente"],["outboxProcessing","outbox em processamento"],["outboxFailed","outbox falhou"],["outboxDead","outbox quarentena"],["messagingPending","mensagem pendente"],["messagingProcessing","mensagem em processamento"],["messagingQuarantined","mensagem quarentena"]]){
 const v={...base,[field]:1};
 ok(signal(v,"transport").level==="review",label);
 ok(inspect(v).level==="review",`resumo critica ${field}`);
}
for(const [field,label] of [["outboxPending","outbox desconhecida"],["outboxProcessing","processamento desconhecido"],["outboxFailed","falha desconhecida"],["outboxDead","quarentena desconhecida"],["messagingPending","mensagem desconhecida"],["messagingProcessing","msg processamento desconhecido"],["messagingQuarantined","msg quarentena desconhecida"]]){
 ok(signal({...base,[field]:null},"transport").level==="unknown",label);
}
for(const [field,value] of [["checkedAt",null],["checkedAt","invalid"],["remoteState",null],["remoteError",true]]){
 ok(signal({...base,[field]:value},"transport").level==="unknown",`sem transporte confiavel: ${field}=${value}`);
}
ok(signal({...base,checkedAt:new Date(NOW-300001).toISOString()},"transport").level==="unknown","snapshot com mais de cinco minutos e desconhecido");
ok(signal({...base,checkedAt:new Date(NOW+31000).toISOString()},"transport").level==="unknown","relogio futuro nao certifica");
ok(signal({...base,remoteState:"attention"},"transport").level==="review","status remoto com alerta");
ok(signal({...base,remoteState:"quarantine"},"transport").level==="review","status remoto em quarentena");
ok(signal({...base,historyHasMore:true},"history").level==="unknown","pagina parcial nao prova inexistencia de pedidos");
ok(signal({...base,activeOrders:1},"orders").level==="review","pedido ativo exige atencao");
ok(signal({...base,attentionOrders:1},"orders").level==="review","pedido com alerta exige atencao");
ok(inspect({...base,activeOrders:1,humanInboxChecked:false}).level==="review","revisao supera estado desconhecido");
ok(signal(base,"transport").detail.includes("não comprova entrada"),"transporte OK nao certifica Entregas");
ok(signal(base,"destination").detail.toLocaleLowerCase("pt-BR").includes("conferência manual"),"destino explicita comprovacao humana");
const txt=report(base,clean);
ok(txt.includes("CONFERENCIA OPERACIONAL R41"),"cabecalho auditavel");
ok(txt.includes("Snapshot remoto"),"inclui carimbo de snapshot");
ok(txt.includes("[OK]"),"relatorio preserva estado");
ok(txt.includes("não contém pedidos nem dados pessoais"),"report explicita privacidade");
ok(!/(?:\(34\)|\b\d{11}\b|@gmail\.|cliente:\s|token:\s)/i.test(txt),"sem dados de cliente ou token no relatorio");
const admin=read("src/components/admin/OperationHealthAdmin.tsx");
const css=read("src/components/admin/OperationHealthAdmin.module.css");
for(const [token,label] of [
 ["inspectShiftReadiness(shiftInput)","auditoria usa motor real"],
 ["formatShiftReport(shiftInput,shiftReadiness)","diagnostico usa snapshot real"],
 ["checked={manualChecks[task.id]}","checagem humana controlada"],
 ["setManualChecks(previous=>({...previous,[task.id]:e.target.checked}))","marcacao so com acao humana"],
 ["onClick={()=>void checkIntegration()}","consulta sob demanda"],
 ["window.setInterval(()=>setClockMs(Date.now()),60_000)","relogio local sem polling remoto"],
 ["AbortController","cancelamento da consulta"],
 ["controller.abort(),10000","timeout de 10s"],
 ["Authorization:`Bearer ${token}`","endpoint protegido por login"],
 ["navigator.clipboard.writeText","reporte copiavel"],
 ["Não foi possível copiar","falha de copia informada"],
 ["Fila sem pendências não significa entrega confirmada.","aviso de entrega independente"],
 ["R41 · ABERTURA DA LOJA","marcador da central R41"],
])ok(admin.includes(token),label);
for(const tok of [".r41Shift{",".r41ShiftChecks",".r41ManualTasks","@media(max-width:450px)","min-height:44px"])
 ok(css.includes(tok),`mobile e acessibilidade: ${tok}`);
const checkout=read("src/components/ui/CheckoutModal.tsx");
const rate=read("src/lib/addressIntelligence.ts");
const guest=read("src/app/api/orders/route.ts");
const auth=read("src/lib/orderRepository.ts");
const fallback=read("src/lib/checkoutFallbackSafety.ts");
const uncertain=read("src/lib/orderOutcomeRecovery.ts");
const previewApi=read("src/app/api/address/preview/route.ts");
const previewUi=read("src/components/ui/AddressMapPreview.tsx");
const diagnosticApi=read("src/app/api/admin/operation-health/route.ts");
for(const [condition,label] of [
 [checkout.includes("orderAttemptRef")&&checkout.includes("orderOutcomeUncertain"),"tentativa e resultado incerto preservados"],
 [checkout.includes("!orderOutcomeUncertain && fallbackWhatsAppUrl"),"WhatsApp nao aparece em pedido incerto"],
 [checkout.includes("canOfferManualOrderFallback(code)"),"fallback manual depende do erro"],
 [fallback.includes('"SERVICE_CONFIG"'),"fallback nao liberado indiscriminadamente"],
 [uncertain.includes("EXPLICIT_REJECTIONS"),"rechacos explicitos separados de timeout"],
 [checkout.includes("calculateDeliveryFee(bairro)")&&checkout.includes("matchDeliveryRate"),"frete da tabela preservado"],
 [rate.includes("matchDeliveryRate")&&!rate.includes("fetch("),"normalizacao local sem API externa"],
 [guest.includes("runTransaction(")&&guest.includes("buildOutboxRecord("),"evento convidado atomico"],
 [auth.includes("runTransaction(")&&auth.includes("ensureIntegrationEventInTransaction("),"evento autenticado atomico"],
 [guest.includes('sourceSystem: "dfl_site"'),"origem de pedido identificada"],
 [guest.includes("drainIntegrationOutboxEvent("),"rele de eventos preservado"],
 [previewApi.includes("GEOAPIFY_ADDRESS_PREVIEW_ENABLED")&&previewApi.includes("GEOAPIFY_API_KEY"),"geoapify opt-in no servidor"],
 [previewApi.includes("GEOAPIFY_ROUTE_PREVIEW_ENABLED")&&previewApi.includes("DFL_STORE_LAT"),"rota opcional e configuravel"],
 [previewApi.includes("RATE_LIMITED")&&previewApi.includes("ORIGIN_DENIED"),"restricoes da API geoapify"],
 [previewUi.includes("NEXT_PUBLIC_DFL_ADDRESS_PREVIEW_ENABLED"),"flag publica separada"],
 [diagnosticApi.includes("verifyIdToken(")&&diagnosticApi.includes("isAdminEmail("),"diagnostico autenticado e admin-only"],
 [diagnosticApi.includes('"no-store"')||diagnosticApi.includes('export const dynamic = "force-dynamic"'),"diagnostico nao depende de cache estatico"],
])ok(condition,label);
for(const path of [enginePath,"src/components/admin/OperationHealthAdmin.tsx","src/lib/operationPreopenChecklist.ts","src/components/ui/CheckoutModal.tsx","src/app/api/address/preview/route.ts"]){
 const a=ts.createSourceFile(path,read(path),ts.ScriptTarget.Latest,true,path.endsWith(".tsx")?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 ok(a.parseDiagnostics.length===0,`sintaxe de ${path}`);
}
ok(!/(?:fetch\(|addDoc\(|setDoc\(|runTransaction\(|createCustomerOrder\()/.test(src),"motor do painel somente leitura");
console.log(`\nR42: ${n} contratos locais aprovados; NENHUM pedido, envio ou mudanca comercial executado.`);
