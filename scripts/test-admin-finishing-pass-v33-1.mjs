import fs from "node:fs";
const read=(p)=>fs.readFileSync(p,"utf8");
const ok=(v,m)=>{if(!v)throw new Error(`V33.1: ${m}`);};

const category=read("src/components/admin/CategoryOrderAdmin.tsx");
const categoryCss=read("src/components/admin/CategoryOrderAdmin.module.css");
const organizer=read("src/components/admin/CatalogOrganizerAdmin.tsx");
const organizerCss=read("src/components/admin/CatalogOrganizerAdmin.module.css");
const promos=read("src/components/admin/PublicPromotionsAdmin.tsx");
const free=read("src/components/admin/FreeDeliveryAdmin.tsx");
const health=read("src/components/admin/OperationHealthAdmin.tsx");
const healthCss=read("src/components/admin/OperationHealthAdmin.module.css");
const pwa=read("src/components/admin/AdminPwa.tsx");
const pwaCss=read("src/components/admin/AdminPwa.module.css");
const orders=read("src/hooks/useAdminOrders.ts");
const workflow=read(".github/workflows/build-admin-android.yml");

ok(category.includes("ArrowUp")&&category.includes("Save")&&category.includes('haptic("success")'),"ordem de categorias sem polish");
ok(categoryCss.includes(".save"),"CSS da ordem de categorias ausente");
ok(organizer.includes("SlidersHorizontal")&&organizer.includes("ArrowDown"),"organizador sem Lucide");
ok(organizerCss.includes("V33.1 — ORGANIZER FINISH"),"organizador sem camada V33.1");
ok(promos.includes("BadgePercent")&&promos.includes("Sparkles"),"promoções públicas sem polish");
ok(free.includes("moneyTyping")&&free.includes("moneyNumber"),"entrega grátis sem máscara monetária");
ok(health.includes("OperationHealthAdmin.module.css")&&health.includes("RefreshCw"),"saúde operacional ainda inline");
ok(healthCss.includes(".integration"),"CSS saúde operacional ausente");
ok(!health.includes("style={{"),"saúde operacional ainda tem inline style");
ok(pwa.includes("BellRing")&&pwa.includes("WifiOff")&&pwa.includes('haptic("step")'),"PWA setup sem polish");
ok(pwaCss.includes("V33.1 — PWA FINISH"),"CSS PWA sem V33.1");
ok((orders.match(/onSnapshot\s*\(/g)||[]).length===1,"listener único de pedidos alterado");
ok(!health.includes("onSnapshot(")&&!category.includes("onSnapshot("),"V33.1 criou listener indevido");
ok(workflow.includes("test-admin-finishing-pass-v33-1.mjs"),"workflow não valida V33.1");

console.log("DFL ADMIN V33.1 — FINISHING PASS — ZERO ERROS");
