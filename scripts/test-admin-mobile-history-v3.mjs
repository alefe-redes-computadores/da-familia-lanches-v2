import fs from "node:fs";

const css=fs.readFileSync("src/app/admin/admin.module.css","utf8");
const route=fs.readFileSync("src/app/api/admin/orders/route.ts","utf8");

const tests=[
  ["uma única regra base overview 1x4",
    css.includes("grid-template-columns: repeat(4, minmax(0,1fr));")],
  ["regra mobile 2x2 removida",
    !css.includes("grid-template-columns: repeat(2, minmax(0,1fr));")],
  ["remendo HISTORY FINAL removido",
    !css.includes("DFL ADMIN MOBILE + HISTORY FINAL")],
  ["remendo STRIP V2 removido",
    !css.includes("MOBILE OPERATION STRIP V2")],
  ["ícones secundários ocultos",
    css.includes(".metricCard:not(.metricLead) .metricIcon")],
  ["history continua query terminal",
    route.includes('.where("status", "==", status)')],
  ["fallback somente quando vazio",
    route.includes("if (merged.size === 0)")],
  ["amostra limitada a 80",
    route.includes('.limit(80)')],
  ["diagnóstico somente de status",
    route.includes("statusSample")],
  ["authority v5",
    route.includes("authorityVersion: 5")],
];

let fail=false;
for(const [name,ok] of tests){
  console.log(`${ok?"OK":"ERRO"}: ${name}`);
  if(!ok) fail=true;
}
if(fail) process.exit(1);

console.log("\\nDFL ADMIN MOBILE + HISTORY V3 — CONTRATO OK");
