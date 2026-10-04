import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const ok = (value, message) => {
  if (!value) throw new Error(`V36 MODULES: ${message}`);
};

const layout = read("src/app/admin/layout.tsx");
const coupons = read("src/components/admin/CouponsAdmin.tsx");
const couponsCss = read("src/components/admin/CouponsAdmin.module.css");
const catalogCss = read("src/components/admin/CatalogAdmin.module.css");
const ratesCss = read("src/components/admin/DeliveryRatesAdmin.module.css");
const freeCss = read("src/components/admin/FreeDeliveryAdmin.module.css");
const rewardsCss = read("src/components/admin/RewardsAdmin.module.css");
const schedulingCss = read("src/components/admin/SchedulingAdmin.module.css");
const promosCss = read("src/components/admin/PublicPromotionsAdmin.module.css");
const money = read("src/lib/admin-money.ts");

ok(layout.includes("AdminExperienceProvider"), "V35/provider global ausente");
ok(money.includes("parseAdminMoney"), "parser monetário central ausente");
ok(money.includes("adminMoneyTyping"), "máscara monetária central ausente");
ok(money.includes("adminPercentText"), "contrato percentual ausente");

ok(!coupons.includes("onSnapshot"), "Cupons ainda possui listener em tempo real");
ok(coupons.includes("getDocs(collection(db, \"Cupons\"))"), "Cupons não usa leitura dirigida ao abrir");
ok(coupons.includes("setCoupons((current)"), "Cupons não atualiza lista local após mutação");
ok(coupons.includes("Recarregar"), "Cupons não oferece recarga manual");
ok(coupons.includes("useAdminFeedback"), "Cupons não usa toast global");
ok(coupons.includes("useAdminConfirm"), "Cupons não usa diálogo global");
ok(coupons.includes("AdminLoadingState"), "Cupons não usa loading padronizado");
ok(coupons.includes("adminMoneyTyping"), "Cupons não usa máscara monetária central");
ok(!coupons.includes("confirmDelete"), "confirmação dupla antiga permaneceu");

for (const [name, css] of [
  ["Catálogo", catalogCss],
  ["Fretes", ratesCss],
  ["Frete grátis", freeCss],
  ["Cupons", couponsCss],
  ["Fidelidade", rewardsCss],
  ["Agendamentos", schedulingCss],
  ["Promoções", promosCss],
]) {
  ok(css.includes("DFL ADMIN V36 — MODULE EXPERIENCE AUTHORITY"), `${name}: autoridade V36 ausente`);
  ok(css.includes("font-size: 12px !important"), `${name}: microtipografia não foi elevada`);
  ok(css.includes("min-height: 48px !important"), `${name}: controles não foram consolidados`);
}

ok(couponsCss.includes(".headerActions"), "Cupons: cabeçalho compacto ausente");
ok(catalogCss.includes("V36 — catálogo"), "Catálogo: polimento mobile ausente");
ok(ratesCss.includes("V36 — fretes"), "Fretes: polimento de edição ausente");
ok(schedulingCss.includes("V36 — agendamento"), "Agendamentos: microtipografia antiga não foi coberta");

console.log("============================================================");
console.log(" DFL ADMIN V36 — MÓDULOS OPERACIONAIS — CONTRATOS OK");
console.log("============================================================");
console.log("✓ Cupons sem onSnapshot da coleção inteira");
console.log("✓ Cupons com leitura dirigida + estado local + recarga manual");
console.log("✓ toast/confirm/loading globais usados em Cupons");
console.log("✓ contrato monetário central criado");
console.log("✓ Catálogo/Fretes/Frete grátis/Fidelidade/Agendamentos/Promoções lapidados");
console.log("✓ microtipografia elevada");
console.log("✓ mobile/desktop alinhados à fundação V35");
