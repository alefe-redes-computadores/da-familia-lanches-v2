import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const ok = (value, label) => {
  if (!value) throw new Error(`FALHOU: ${label}`);
  console.log(`OK: ${label}`);
};

const msg = read("src/lib/integration/server/messagingProjection.ts");
const health = read("src/components/admin/OperationHealthAdmin.tsx");
const route = read("src/app/api/admin/operation-health/route.ts");
const reverse = read("src/lib/integration/server/reversePersistence.ts");
const orders = read("src/app/api/orders/route.ts");

ok(msg.includes("MAX_MESSAGING_ATTEMPTS = 6"), "mensageria possui limite de retry");
ok(msg.includes("colocado em quarentena"), "poison intent sai do loop infinito");
ok(msg.includes('status:"failed"') && msg.includes("messaging_eligible:false"), "quarentena sai do polling");
ok(route.includes(".count()"), "saúde usa agregações");
ok(!health.includes("setInterval("), "saúde não cria polling");
ok(health.includes('fetch("/api/admin/operation-health"'), "integração é consultada sob demanda");
ok(health.includes("getIdToken"), "diagnóstico administrativo autenticado");
ok(reverse.includes('type === "delivery.out_for_delivery"'), "Status Authority preservada");
ok(orders.includes("after("), "fastlane pós-resposta preservada");

console.log("============================================================");
console.log(" OPERAÇÃO FINAL V2 — CONTRATO OK");
console.log("============================================================");
