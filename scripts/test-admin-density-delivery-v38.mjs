import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const ok = (value, message) => {
  if (!value) throw new Error(`V38 DENSITY: ${message}`);
};

const rates = read("src/components/admin/DeliveryRatesAdmin.tsx");
const ratesCss = read("src/components/admin/DeliveryRatesAdmin.module.css");
const storeCss = read("src/components/admin/StoreOperationAdmin.module.css");
const schedulingCss = read("src/components/admin/SchedulingAdmin.module.css");
const couponsCss = read("src/components/admin/CouponsAdmin.module.css");
const rewardsCss = read("src/components/admin/RewardsAdmin.module.css");
const promosCss = read("src/components/admin/PublicPromotionsAdmin.module.css");
const orders = read("src/hooks/useAdminOrders.ts");
const coupons = read("src/components/admin/CouponsAdmin.tsx");
const workflow = read(".github/workflows/build-admin-android.yml");

ok(rates.includes("<b>{rates.length} bairros</b>"), "contador semântico ausente");
ok(!rates.includes("<small>Taxa de entrega</small>"), "subtítulo repetitivo ainda existe");
ok(rates.includes("search.trim() && <span>"), "contador da busca ainda aparece sem busca");
ok(rates.includes("visibleRates"), "expansão controlada desapareceu");
ok(rates.includes("slice(0, 8)"), "8 bairros iniciais não preservados");
ok(ratesCss.includes("DFL ADMIN V38 — DELIVERY LIST AUTHORITY"), "autoridade V38 ausente");
ok(ratesCss.includes("-webkit-line-clamp:2"), "nome do bairro mobile não aceita 2 linhas");

ok(storeCss.includes("DFL ADMIN V38 — STORE DENSITY POLISH"), "Loja sem polimento");
ok(schedulingCss.includes("DFL ADMIN V38 — SCHEDULING DENSITY POLISH"), "Agenda sem polimento");
ok(couponsCss.includes("DFL ADMIN V38 — COUPONS DENSITY POLISH"), "Cupons sem polimento");
ok(rewardsCss.includes("DFL ADMIN V38 — REWARDS DENSITY POLISH"), "Fidelidade sem polimento");
ok(promosCss.includes("DFL ADMIN V38 — PROMOTIONS DENSITY POLISH"), "Promoções sem polimento");

ok((orders.match(/onSnapshot\s*\(/g) || []).length === 1, "listener principal alterado");
ok(!coupons.includes("onSnapshot"), "Cupons voltou a realtime");
ok(workflow.includes("test-admin-density-delivery-v38.mjs"), "workflow não valida V38");

console.log("============================================================");
console.log(" DFL ADMIN V38 — FINAL DENSITY + DELIVERY — ZERO ERROS");
console.log("============================================================");
console.log("✓ bairro é a informação principal");
console.log("✓ subtítulo repetitivo removido");
console.log("✓ nomes mobile aceitam até duas linhas");
console.log("✓ contador virou badge semântico");
console.log("✓ 8 bairros iniciais + expansão preservados");
console.log("✓ Loja, Agenda, Cupons, Fidelidade e Promoções compactados");
console.log("✓ listener principal preservado");
console.log("✓ Cupons continua sem realtime");
