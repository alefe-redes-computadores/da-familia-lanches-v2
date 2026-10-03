import { spawnSync } from "node:child_process";
import fs from "node:fs";

const suites = [
  "scripts/test-admin-runtime-v19.mjs",
  "scripts/test-admin-production-polish-v22.mjs",
  "scripts/test-admin-scheduling-v23.mjs",
  "scripts/test-admin-operational-experience-v24.mjs",
  "scripts/test-admin-entregas-bridge-v25.mjs",
  "scripts/test-admin-orders-operation-v3.mjs",
];

for (const suite of suites) {
  if (!fs.existsSync(suite)) {
    throw new Error(`V26: suíte ausente: ${suite}`);
  }

  const result = spawnSync(process.execPath, [suite], {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`V26: falhou ${suite}`);
  }
}

const hook = fs.readFileSync("src/hooks/useAdminOrders.ts", "utf8");
const page = fs.readFileSync("src/app/admin/page.tsx", "utf8");
const card = fs.readFileSync("src/components/layout/OrderCard.tsx", "utf8");

if ((hook.match(/onSnapshot\s*\(/g) || []).length !== 1) {
  throw new Error("V26: Admin deixou de ter exatamente 1 listener operacional.");
}
if (!page.includes('searchParams.get("order")')) {
  throw new Error("V26: foco por pedido exato ausente.");
}
if (!card.includes("Abrir no Entregas")) {
  throw new Error("V26: ponte visual para DFL Entregas ausente.");
}

console.log("V26 ADMIN RELEASE GATE — ZERO ERROS");
