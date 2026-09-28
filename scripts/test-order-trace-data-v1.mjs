import fs from "node:fs";

const s = fs.readFileSync(
  "src/app/api/integration/diagnostic/order-trace/route.ts",
  "utf8",
);

const checks = [
  ['campo data diagnosticado', s.includes('const value = order.data')],
  ['timestamp convertido para ISO', s.includes('"toDate" in value')],
  ['tipo timestamp exposto', s.includes('type: "timestamp"')],
  ['diagnóstico continua somente leitura', s.includes('read_only: true')],
];

for (const [name, ok] of checks) {
  if (!ok) {
    console.error("FALHOU:", name);
    process.exit(1);
  }
  console.log("OK:", name);
}

console.log("ORDER TRACE DATA V1 — ZERO ERROS");
