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
// V87: o card compacto (ate 560px) usa 37vw; manter o breakpoint 640px em 50vw.
// Verifica os tamanhos do card real, nao um prefixo antigo que ignora smartphones.
const publicCardSizes = home.match(/<CatalogImage\s+src=\{product\.image\}\s+alt=\{product\.name\}\s+sizes="([^"]+)"/)?.[1] ?? "";
ok(publicCardSizes.includes("(max-width: 560px) 37vw") &&
   publicCardSizes.includes("(max-width: 640px) 50vw") &&
   publicCardSizes.includes("(max-width: 1100px) 33vw") &&
   publicCardSizes.endsWith(", 280px"), "cards públicos têm sizes responsivo");
ok(admin.includes('sizes="76px"'),"thumbnail do admin otimizado");
ok(modal.includes("CatalogImage"),"modal de produto otimizado");
ok(product.includes("CatalogImage"),"página pública de produto otimizada");
ok((css.match(/!important/g)||[]).length<=397,"dívida !important não aumentou");
ok(!home.includes('<img src={product.image}'),"home não baixa original via img comum");
console.log("============================================================");
console.log("DFL SITE V40 R1 — CATALOG IMAGE PERFORMANCE — ZERO ERROS");
console.log("============================================================");
