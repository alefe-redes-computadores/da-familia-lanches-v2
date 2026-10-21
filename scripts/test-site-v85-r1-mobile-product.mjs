import fs from "node:fs";
import assert from "node:assert/strict";

const read = (file) => fs.readFileSync(file, "utf8");
const page = read("src/components/product/ProductPublicPage.tsx");
const css = read("src/components/product/ProductPublicPage.module.css");
const modal = read("src/components/ui/ProductDetailsModal.module.css");
const image = read("src/lib/catalogImageClient.ts");
const routes = read("src/lib/productRoutes.ts");
const buy = page.indexOf('className={styles.buyRow}');
const composition = page.indexOf('className={styles.composition}');
const recommendations = page.indexOf('className={styles.related}');

const check = (pass, msg) => { assert.ok(pass, msg); console.log(`✓ ${msg}`); };
check(page.includes('style={{ objectFit: "contain" }}') && css.includes('aspect-ratio:1.42 / 1'), 'imagem nao recorta artes/fotos e reserva altura');
check(buy >= 0 && composition > buy && recommendations > composition, 'preco e acao aparecem antes da composicao/recomendacoes');
check((page.match(/className=\{styles\.primaryAction\}/g) || []).length === 1 && !page.includes('styles.mobileAction'), 'uma unica acao de personalizacao, sem CTA fixo duplicado');
check(page.includes('openModal("product-details", product)') && !page.includes('addItem('), 'compra continua usando modal e fluxo oficial');
check(page.includes('resolveBundleItems(product, products)') && page.includes('bundle.map('), 'autoridade dos itens do combo preservada');
check(page.includes('navigator.share(') && page.includes('navigator.clipboard?.writeText') && page.includes('api.whatsapp.com/send') && page.includes('encodeURIComponent'), 'compartilhamento nativo, link copiavel e WhatsApp');
check(page.includes('productHref(product)') && routes.includes('productPublicSlug'), 'link canonico e profundo aponta para produto individual');
check(!css.includes('.mobileAction') && css.includes('@media(max-width:760px)') && !css.includes('!important'), 'sem faixa fixa em conflito com menu inferior e sem CSS important');
check(modal.includes('.bundleItem summary{gap:7px;flex-wrap:nowrap;align-items:center}') && !modal.includes('.bundleName{flex-basis:calc(100% - 48px)}'), 'seta do acordeao alinhada na mesma linha');
check(image.includes('"image/webp"') && image.includes('CATALOG_IMAGE_MAX_EDGE = 1280'), 'otimizacao de uploads WebP preservada');
console.log('\nDFL SITE V85 R1 — CONTRATOS APROVADOS');
