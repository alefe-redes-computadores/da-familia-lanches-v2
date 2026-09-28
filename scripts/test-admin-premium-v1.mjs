import fs from "node:fs";
const r=f=>fs.readFileSync(f,"utf8");const ok=(v,l)=>{if(!v)throw new Error("FALHOU: "+l);console.log("OK: "+l)};
const p=r("src/app/admin/page.tsx"),a=r("src/app/admin/admin.module.css"),c=r("src/components/layout/OrderCard.module.css"),u=r("src/app/admin/admin-ui.css"),s=r("src/components/admin/StoreOperationAdmin.module.css");
ok(a.includes("DFL ADMIN PREMIUM V1"),"pele premium");ok(c.includes("DFL ORDER CARD PREMIUM V2"),"cards premium");ok(u.includes("shared controls"),"controles premium");ok(s.includes("ADMIN PREMIUM V1 — STORE OPERATION"),"funcionamento premium");ok(p.includes("data-tone={feedback.startsWith"),"toast semantico");ok(p.includes("updateOrderStatus"),"status preservado");
console.log("DFL ADMIN PREMIUM V1 — CONTRATO OK");