import fs from "node:fs";
const r=p=>fs.readFileSync(p,"utf8"),ok=(v,m)=>{if(!v)throw new Error(`V50.1: ${m}`);console.log("OK:",m)};
const v=r("scripts/test-admin-modules-v36.mjs"),w=r(".github/workflows/build-admin-android.yml"),c=r("src/components/admin/CatalogAdmin.module.css");
ok(!c.includes("!important"),"Catalogo continua sem important");
ok(v.includes('ok(!catalogCss.includes("!important")'),"V36 reconhece V47");
for(const t of ["test-catalog-v47.mjs","test-catalog-v48.mjs","test-catalog-v49.mjs","test-mobile-viewport-v50.mjs","test-smartcart-v2.mjs","test-roadmap-final-v2.mjs","release-gate-catalog-v43.mjs","test-android-release-gate-v50-1.mjs"])ok(w.includes(`node scripts/${t}`),`Action executa ${t}`);
ok(w.includes("gradle -p android-admin clean assembleRelease"),"Gradle preservado");
ok(w.includes("DFL_ADMIN_KEYSTORE_BASE64"),"assinatura preservada");
console.log("V50.1 ANDROID RELEASE GATE — ZERO ERROS");
