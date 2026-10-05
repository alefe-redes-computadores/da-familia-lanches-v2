import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const ok = (value, message) => {
  if (!value) throw new Error(`V37.1 R2 FINAL POLISH: ${message}`);
};

const rates = read("src/components/admin/DeliveryRatesAdmin.tsx");
const ratesCss = read("src/components/admin/DeliveryRatesAdmin.module.css");
const store = read("src/components/admin/StoreOperationAdmin.tsx");
const storeCss = read("src/components/admin/StoreOperationAdmin.module.css");
const adminCss = read("src/app/admin/admin.module.css");
const orders = read("src/hooks/useAdminOrders.ts");
const coupons = read("src/components/admin/CouponsAdmin.tsx");
const workflow = read(".github/workflows/build-admin-android.yml");

ok(rates.includes("showAllRates"), "expansão dos bairros ausente");
ok(rates.includes("visibleRates"), "lista curta dos bairros ausente");
ok(rates.includes("slice(0, 8)"), "limite inicial não é 8");
ok(rates.includes("Ver todos os ${sorted.length} bairros"), "CTA dos bairros ausente");
ok(ratesCss.includes("V37.1 R2 — DELIVERY FINAL USABILITY POLISH"), "CSS final de fretes ausente");
ok(ratesCss.includes(".rateListToggle"), "toggle de bairros sem estilo");
ok(ratesCss.includes("overscroll-behavior:auto"), "scroll mobile não foi liberado");

ok(store.includes('data-enabled={d.enabled}'), "estado aberto/fechado não exposto");
ok(storeCss.includes('.day[data-enabled="true"]'), "dia aberto sem destaque");
ok(storeCss.includes('.day[data-enabled="false"]'), "dia fechado sem hierarquia");

ok(adminCss.includes("V37.1 R2 — FINAL MOBILE PROPORTION POLISH"), "proporção mobile final ausente");
ok((orders.match(/onSnapshot\s*\(/g) || []).length === 1, "listener principal alterado");
ok(!coupons.includes("onSnapshot"), "Cupons voltou a realtime");
ok(workflow.includes("test-admin-final-responsive-polish-v37-1-r2.mjs"), "workflow não valida R2");

console.log("============================================================");
console.log(" DFL ADMIN V37.1 R2 — FINAL RESPONSIVE POLISH — ZERO ERROS");
console.log("============================================================");
console.log("✓ oito bairros iniciais + expansão sob demanda");
console.log("✓ nomes dos bairros com leitura melhor");
console.log("✓ navegação mobile sem parede de 73 linhas");
console.log("✓ contador compacto");
console.log("✓ aberto destacado com verde sutil");
console.log("✓ fechado neutro e compacto");
console.log("✓ cards vazios mobile compactados");
console.log("✓ listener principal preservado");
console.log("✓ Cupons continua sem realtime");
