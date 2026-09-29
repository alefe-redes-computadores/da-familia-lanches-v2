import fs from "node:fs";
const r=fs.readFileSync("src/app/api/admin/orders/route.ts","utf8");
const c=fs.readFileSync("src/app/admin/admin.module.css","utf8");
const tests=[
 ["consulta terminal",r.includes('.where("status", "==", status)')],
 ["aliases",r.includes("TERMINAL_STATUS_ALIASES")],
 ["sem scan documentId",!r.includes("FieldPath.documentId()")],
 ["sem scan legado 50",!r.includes("HISTORY_SCAN_SIZE")],
 ["teto por status",r.includes("HISTORY_QUERY_LIMIT = 24")],
 ["sem cursor falso",r.includes("hasMore: false")],
 ["mobile 4 colunas",c.includes("repeat(4,minmax(0,1fr))")],
 ["seletor estrutural mobile",c.includes(".overviewGrid > :not(:first-child)")],
];
let fail=false;
for(const [n,ok] of tests){console.log(`${ok?"OK":"ERRO"}: ${n}`);if(!ok)fail=true}
if(fail)process.exit(1);
console.log("\nDFL ADMIN HISTORY V2 — CONTRATO OK");
