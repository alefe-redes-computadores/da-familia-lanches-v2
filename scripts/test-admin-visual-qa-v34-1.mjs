import fs from "node:fs";

const read=(p)=>fs.readFileSync(p,"utf8");
const ok=(v,m)=>{if(!v)throw new Error(`V34.1: ${m}`);};

const page=read("src/app/admin/page.tsx");
const adminCss=read("src/app/admin/admin.module.css");
const catalog=read("src/components/admin/CatalogAdmin.tsx");
const catalogCss=read("src/components/admin/CatalogAdmin.module.css");
const coupons=read("src/components/admin/CouponsAdmin.tsx");
const couponsCss=read("src/components/admin/CouponsAdmin.module.css");
const rates=read("src/components/admin/DeliveryRatesAdmin.tsx");
const ratesCss=read("src/components/admin/DeliveryRatesAdmin.module.css");
const rewards=read("src/components/admin/RewardsAdmin.tsx");
const rewardsCss=read("src/components/admin/RewardsAdmin.module.css");
const scheduleCss=read("src/components/admin/SchedulingAdmin.module.css");
const store=read("src/components/admin/StoreOperationAdmin.tsx");
const storeCss=read("src/components/admin/StoreOperationAdmin.module.css");
const orderCss=read("src/components/layout/OrderCard.module.css");
const orders=read("src/hooks/useAdminOrders.ts");
const workflow=read(".github/workflows/build-admin-android.yml");

ok(page.includes("managementNotifications")&&page.includes("Notificações"),"Central não ganhou atalho em Gestão");
ok(adminCss.includes("V34.1 — VISUAL QA FINAL")&&adminCss.includes(".mobileBell"),"bell/gestão não polidos");
ok(catalog.includes("ChevronDown")&&catalog.includes("<Plus")&&catalog.includes("<Search"),"catálogo ainda usa símbolos antigos");
ok(catalogCss.includes("V34.1 — CATALOG VISUAL QA"),"CSS catálogo ausente");
ok(coupons.includes("TicketPercent")&&coupons.includes("moneyTyping")&&coupons.includes("<Pencil")&&coupons.includes("<Trash2"),"cupons ainda não finais");
ok((coupons.match(/onSnapshot\s*\(/g)||[]).length===1,"listener de cupons alterado");
ok(couponsCss.includes("V34.1 — COUPONS VISUAL QA"),"CSS cupons ausente");
ok(rates.includes("moneyTyping")&&rates.includes("<Pencil")&&rates.includes("<MapPin")&&rates.includes("<Save"),"taxas ainda não finais");
ok(ratesCss.includes("V34.1 — DELIVERY VISUAL QA"),"CSS taxas ausente");
ok(rewards.includes("moneyTyping")&&rewards.includes("moneyText")&&rewards.includes("<Gift"),"fidelidade sem máscara final");
ok(rewardsCss.includes("V34.1 — REWARDS VISUAL QA"),"CSS fidelidade ausente");
ok(scheduleCss.includes("V34.1 — SCHEDULING VISUAL QA"),"agendamentos sem QA");
ok(store.includes("DoorOpen")&&store.includes("FlaskConical"),"modos da loja sem Lucide final");
ok(storeCss.includes("V34.1 — STORE VISUAL QA"),"loja sem QA");
ok(orderCss.includes("V34.1 — INSPECTOR VISUAL QA"),"inspector sem QA");
ok((orders.match(/onSnapshot\s*\(/g)||[]).length===1,"listener único de pedidos alterado");
ok(workflow.includes("test-admin-visual-qa-v34-1.mjs"),"workflow não valida V34.1");

console.log("DFL ADMIN V34.1 — VISUAL QA FINAL — ZERO ERROS");
