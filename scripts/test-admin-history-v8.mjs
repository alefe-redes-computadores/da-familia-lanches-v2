import fs from "node:fs";
const route=fs.readFileSync("src/app/api/admin/orders/route.ts","utf8");
const hook=fs.readFileSync("src/hooks/useAdminOrders.ts","utf8");
const lib=fs.readFileSync("src/lib/adminOrders.ts","utf8");
const card=fs.readFileSync("src/components/layout/OrderCard.tsx","utf8");
const tests=[
 ["projection",route.includes('HISTORY_INDEX = "admin_order_history"')],
 ["version",route.includes("HISTORY_INDEX_VERSION = 8")],
 ["canonical numeric chronology",route.includes('orderBy("createdAtMs","desc")')],
 ["stable cursor",route.includes('orderBy(FieldPath.documentId(),"desc")')],
 ["20+1",route.includes("HISTORY_PAGE_SIZE+1")],
 ["legacy BR date",route.includes("legacyDateMillis")],
 ["identity normalization",route.includes("historyIdentity")],
 ["hook respects canonical history",hook.includes("__historyCreatedAtMs")],
 ["library respects canonical history",lib.includes("__historyCreatedAtMs")],
 ["card historical identity",card.includes("customerSnapshot?.name")],
 ["authority v8",route.includes("authorityVersion: 8")],
];
let bad=false;
for(const [name,ok] of tests){console.log(ok?"OK:":"ERRO:",name);if(!ok)bad=true}
if(bad) process.exit(1);
console.log("DFL ADMIN HISTORY V8 — CONTRATO OK");
