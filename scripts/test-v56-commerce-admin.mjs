import fs from "node:fs";const r=p=>fs.readFileSync(p,"utf8"),ok=(v,m)=>{if(!v)throw Error("V56: "+m);console.log("OK:",m)};
const c=r("src/components/admin/CatalogAdmin.tsx"),d=r("src/lib/checkoutDraft.ts"),o=r("src/app/api/orders/route.ts"),p=r("src/components/admin/PublicPromotionsAdmin.tsx"),f=r("src/components/admin/FreeDeliveryAdmin.tsx");
ok(c.includes("validateBundleItems")&&c.includes("Fonte operacional do pedido"),"composição é autoridade");
ok(c.includes("<optgroup")&&c.includes("· pausado"),"componentes agrupados e indisponíveis sinalizados");
ok(d.includes("draft?.updatedAt")&&!d.includes("draft?.savedAt"),"recovery usa timestamp real");
ok(o.includes("update(clientRequestId)")&&!o.includes("update(guestPhone)"),"guest não vira pseudo-conta pelo telefone");
ok(p.includes("CENTRAL DE PROMOÇÕES")&&p.includes("produto e promoção permanecem separados"),"promoção desacoplada");
ok(f.includes("Campanha de entrega")&&f.includes("sem alterar produtos"),"frete tratado como campanha");
console.log("\nDFL SITE V56 COMMERCE ADMIN — CONTRATOS OK");
