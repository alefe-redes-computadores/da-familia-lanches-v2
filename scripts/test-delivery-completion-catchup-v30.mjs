import fs from "node:fs";

const read=(p)=>fs.readFileSync(p,"utf8");
const ok=(v,m)=>{if(!v)throw new Error(`V30: ${m}`);};

const reverse=read("src/lib/integration/server/reversePersistence.ts");
const messaging=read("src/lib/integration/server/messagingProjection.ts");
const workflow=read(".github/workflows/build-admin-android.yml");
const hook=read("src/hooks/useAdminOrders.ts");

ok(
  reverse.includes('before === "Em Produção"') &&
  reverse.includes('target === "Finalizado"') &&
  reverse.includes('"delivery_completed_catch_up"'),
  "conclusão logística ainda não fecha atraso comercial",
);

ok(
  reverse.includes('silentCatchUp: true') &&
  reverse.includes('recoveredFromCompleted: true'),
  "histórico não marca recuperação silenciosa",
);

ok(
  reverse.includes('deliveryCommercialCatchUp:') &&
  reverse.includes('logisticsTerminal: true'),
  "auditoria do catch-up terminal ausente",
);

ok(
  messaging.includes('eventType === "order.production"') &&
  messaging.includes('eventType === "order.ready"') &&
  messaging.includes('deliveryOperationalCompleted === true'),
  "mensageria não verifica conclusão logística",
);

ok(
  messaging.includes('"commercial_stage_after_delivery_completed"') &&
  messaging.includes('status:"suppressed"') &&
  messaging.includes('messaging_eligible:false'),
  "etapa comercial retroativa não é suprimida deterministicamente",
);

ok(
  messaging.includes('monotonic_protocol:"customer-stage-v1"'),
  "protocolo monotônico de mensagem ausente",
);

ok(
  !reverse.includes("setInterval(") &&
  !messaging.includes("setInterval("),
  "V30 adicionou polling",
);

ok(
  (hook.match(/onSnapshot\s*\(/g)||[]).length===1,
  "listener único do Admin foi alterado",
);

ok(
  workflow.includes("test-delivery-completion-catchup-v30.mjs"),
  "workflow não valida V30",
);

console.log("DFL SITE V30 — DELIVERY COMPLETION CATCH-UP — ZERO ERROS");
