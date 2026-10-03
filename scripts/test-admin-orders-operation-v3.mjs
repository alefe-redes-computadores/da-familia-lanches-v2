import fs from "node:fs";

const hook = fs.readFileSync("src/hooks/useAdminOrders.ts", "utf8");
const api = fs.readFileSync("src/app/api/admin/orders/route.ts", "utf8");

const checks = [
  ["API usa status ativo", api.includes('.where("status", "==", status)')],
  ["API não usa top40 global", !api.includes('.collection("Pedidos").orderBy("data", "desc").limit(40)')],
  ["API separa ativos e histórico", api.includes("activeCount") && api.includes("historyCount")],
  ["API preserva no-store", api.includes('"Cache-Control": "no-store, max-age=0"')],
  ["hook realtime operacional por status", hook.includes('where("status", "in", [...ACTIVE_QUERY_STATUSES])')],
  ["hook não usa realtime global top40", !hook.includes('orderBy("data", "desc"), limit(40)')],
  ["hook preserva autoridade", hook.includes("authoritativeOrdersRef")],
  ["hook sem watchdog 30s", !hook.includes("30_000") && !hook.includes("30000")],
  ["hook listener único", (hook.match(/onSnapshot\s*\(/g) || []).length === 1],
  ["hook limpa listener", hook.includes("unsubscribe();")],
];

let failed = false;

for (const [name, ok] of checks) {
  if (!ok) {
    console.error("FALHOU:", name);
    failed = true;
  } else {
    console.log("OK:", name);
  }
}

if (failed) process.exit(1);

console.log("ADMIN ORDERS OPERATION V3 — ZERO ERROS");
