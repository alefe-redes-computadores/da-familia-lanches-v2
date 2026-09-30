import fs from "node:fs";
const r=fs.readFileSync("src/app/api/admin/orders/route.ts","utf8");
const h=fs.readFileSync("src/hooks/useAdminOrders.ts","utf8");
const l=fs.readFileSync("src/lib/adminOrders.ts","utf8");
const i=fs.readFileSync("firestore.indexes.json","utf8");
const t=[
["terminal query",r.includes('.where("status","in",[...TERMINAL_STATUS_ALIASES])')],
["creation order",r.includes('.orderBy("data","desc")')],
["stable cursor",r.includes('.orderBy(FieldPath.documentId(),"desc")')],
["20+1",r.includes(".limit(HISTORY_PAGE_SIZE+1)")],
["no scan loop",!r.includes("while (collected.length")],
["no projection",!r.includes("admin_order_history")],
["client terminal creation sort",h.includes('status === "Finalizado" || status === "Cancelado"')],
["terminal comparator creation",l.includes("orderCreatedTimestamp(b) - orderCreatedTimestamp(a)")],
["index name cursor",i.includes('"fieldPath": "__name__"')],
["authority v9",r.includes("authorityVersion: 9")],
];
let bad=false; for(const [n,ok] of t){console.log(ok?"OK:":"ERRO:",n);bad||=!ok}
if(bad)process.exit(1); console.log("DFL ADMIN HISTORY V9 — CONTRATO OK");
