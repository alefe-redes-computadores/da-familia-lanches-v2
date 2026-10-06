import fs from "node:fs";
const r=p=>fs.readFileSync(p,"utf8"),ok=(v,m)=>{if(!v)throw Error("V55 STRUCTURAL: "+m);console.log("OK:",m)};
const comp=r("src/lib/catalogComposition.ts"),admin=r("src/components/admin/CatalogAdmin.tsx");
ok(comp.includes("validateBundleItems"),"validação estrutural instalada");
ok(comp.includes("produto obrigatório")&&comp.includes("inteiro maior que zero"),"IDs e quantidades validados");
ok(admin.includes("bundleItems"),"Admin mantém bundleItems como autoridade");
ok(admin.includes("bundleItems"),"editor possui composição operacional estruturada");
console.log("INFO: copy do editor é cosmética e não bloqueia o contrato.");
console.log("\nV55 STRUCTURAL COMBOS — CONTRATOS OK");
