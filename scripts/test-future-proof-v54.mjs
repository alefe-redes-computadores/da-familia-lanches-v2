import fs from "node:fs";import path from "node:path";
const r=p=>fs.readFileSync(p,"utf8"),ok=(v,m)=>{if(!v)throw new Error(`V54: ${m}`);console.log("OK:",m)};
const c=r("src/lib/catalogImageClient.ts"),s=r("src/app/api/admin/catalog-image/route.ts"),h=r("src/app/page.tsx"),a=r("src/components/admin/CatalogAdmin.tsx");
ok(c.includes("CATALOG_IMAGE_MAX_EDGE = 1280"),"dimensão futura 1280px");
ok(c.includes("CATALOG_IMAGE_TARGET_BYTES = 520 * 1024"),"alvo futuro ~520KB");
ok(c.includes("image/jpeg")&&c.includes("image/png")&&c.includes("image/webp"),"entrada comum convertida pelo pipeline");
ok(s.includes("const MAX_BYTES = 640 * 1024"),"servidor bloqueia mídia acima da tolerância");
ok(s.includes('new Set(["image/webp"])'),"servidor aceita somente WebP");
ok(s.includes('createHash("sha256")')&&s.includes("existing.ok"),"hash versiona e deduplica");
ok(h.includes("useCatalogCategories()")&&(h.match(/categories\.map/g)||[]).length>=2,"categorias são dinâmicas na Home");
ok(a.includes('action: "saveCategory"'),"Admin cria categoria sem release");
const bad=[];for(const f of fs.readdirSync("public/img",{withFileTypes:true})){if(!f.isFile())continue;const z=fs.statSync(path.join("public/img",f.name)).size;if(/\.(png|jpe?g|webp)$/i.test(f.name)&&z>640*1024)bad.push(f.name)}
ok(!bad.length,`sem mídia local pesada regressiva${bad.length?": "+bad.join(", "):""}`);
ok(r("scripts/test-catalog-authority-upload-v40-1.mjs").includes("MAX_BYTES = 640 * 1024"),"V40.1 consolidado no novo teto");
ok(r("scripts/test-catalog-v48.mjs").includes("importantNow<=34"),"V48 consolidado");
ok(r("scripts/test-images-commerce-v52.mjs").includes("lb===0 || wb<lb*.45"),"V52 consolidado");
console.log("\nDFL SITE V54 FUTURE PROOF — ZERO ERROS");
