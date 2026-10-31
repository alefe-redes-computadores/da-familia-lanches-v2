"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const relay = fs.readFileSync("src/lib/integration/server/relay.ts", "utf8");
const orders = fs.readFileSync("src/app/api/orders/route.ts", "utf8");
const outbox = fs.readFileSync("src/lib/integration/server/outboxRepository.ts", "utf8");
const contract = fs.readFileSync("src/lib/integration/contracts.ts", "utf8");
const checks = [
  ["envio HMAC preservado", relay.includes("integrationSignature(body, timestamp, signingSecret)")],
  ["evento recebido somente em 2xx", relay.includes("if (!response.ok) throw")],
  ["logistica inicia paralela a mensageria", relay.includes("const [transportOutcome, projectionOutcome] = await Promise.allSettled([transport, projection])")],
  ["transporte inicia antes do processamento de fast-lane", relay.indexOf("const transport = previouslyAcknowledged") < relay.indexOf("drainMessagingIntentFastLane(projectionOutcome.value.intentId)")],
  ["transporte reconhecido antes do status sent", relay.indexOf("await markOutboxTransportAcknowledged") < relay.indexOf("await markOutboxSent(item")],
  ["ack 2xx persistido com lease", outbox.includes("record.locked_by !== workerId") && outbox.includes("transport_acknowledged_at: now")],
  ["retry nao reenvia transporte reconhecido", relay.includes("previouslyAcknowledged") && relay.includes("? Promise.resolve(Number(item.record.transport_http_status) || 200)")],
  ["mensagem falha em fila, sem reset do 2xx", relay.includes("projectionOutcome.status === \"rejected\"") && relay.includes("throw projectionOutcome.reason")],
  ["status sent nao depende de fast-lane", relay.indexOf("await markOutboxSent(item") < relay.indexOf("const effects = await Promise.allSettled([lane, analytics])")],
  ["analytics isolado do retry HTTP", relay.indexOf("await markOutboxSent(item") < relay.indexOf("? projectOrderEvent(event)")],
  ["transaction cria pedido e outbox", orders.includes("tx.create(orderRef, canonicalOrder)") && orders.includes("buildOutboxRecord(event, occurredAt)")],
  ["transaction cria mensagem inicial duravel", orders.includes("tx.create(adminDb.collection(\"integration_notification_intents\")")],
  ["transaction preserva push admin", orders.includes("AdminPushDispatches")],
  ["checkout continua apos commit", orders.includes("after(async () => {")],
  ["evento original preservado", relay.includes("originalEventAt: event.occurred_at")],
  ["contrato typed do 2xx", contract.includes("transport_acknowledged_at?: string;")],
  ["sem gravacao antecipada sent", !relay.includes("markOutboxSent(item, config.workerId);\n      const status = await sendEvent")],
];
for (const [name, ok] of checks) assert.ok(ok, name);
for (const [path, text] of [["relay.ts",relay],["outboxRepository.ts",outbox],["contracts.ts",contract],["route.ts",orders]]) {
  const result=ts.transpileModule(text, {fileName:path, reportDiagnostics:true, compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});
  assert.equal((result.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0,`TS syntax ${path}`);
}
console.log(`R228 SITE: ${checks.length} contratos e 4 analises de sintaxe OK (sem pedidos reais)`);
