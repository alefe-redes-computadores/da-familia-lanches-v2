import fs from "node:fs";
const read=(p)=>fs.readFileSync(p,"utf8");
const ok=(v,m)=>{if(!v)throw new Error(`V40: ${m}`);console.log("OK:",m)};

const home=read("src/app/page.tsx");
const admin=read("src/components/admin/CatalogAdmin.tsx");
const modal=read("src/components/ui/ProductDetailsModal.tsx");
const product=read("src/components/product/ProductPublicPage.tsx");
const image=read("src/components/ui/CatalogImage.tsx");
const config=read("next.config.ts");
const css=read("src/components/admin/CatalogAdmin.module.css");

ok(image.includes('from "next/image"'),"componente de catálogo usa Next Image");
ok(image.includes("sizes={sizes}"),"imagem responsiva possui sizes");
ok(image.includes('quality = 72'),"qualidade otimizada tem padrão explícito");
ok(config.includes('"image/avif"')&&config.includes('"image/webp"'),"AVIF/WebP habilitados");
ok(config.includes("minimumCacheTTL"),"cache longo de imagem habilitado");
ok(config.includes("raw.githubusercontent.com"),"pipeline futuro do GitHub permitido");
ok(home.includes("priority={promoIndex === 0}"),"primeira oferta recebe prioridade");
ok(home.includes('sizes="(max-width: 640px) 50vw'),"cards públicos têm sizes responsivo");
ok(admin.includes('sizes="76px"'),"thumbnail do admin otimizado");
ok(modal.includes("CatalogImage"),"modal de produto otimizado");
ok(product.includes("CatalogImage"),"página pública de produto otimizada");
ok((css.match(/!important/g)||[]).length<=397,"dívida !important não aumentou");
ok(!home.includes('<img src={product.image}'),"home não baixa original via img comum");
console.log("============================================================");
console.log("DFL SITE V40 R1 — CATALOG IMAGE PERFORMANCE — ZERO ERROS");
console.log("============================================================");
