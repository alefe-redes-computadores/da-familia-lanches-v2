"use strict";
const fs=require("node:fs");
const assert=require("node:assert/strict");
const read=p=>fs.readFileSync(p,"utf8");
const home=read("src/app/page.tsx");
const css=read("src/app/page.module.css");
const pwa=read("src/components/admin/AdminPwa.tsx");
const center=read("src/components/admin/AdminNotificationCenter.tsx");
const adminCss=read("src/components/admin/AdminNotificationCenter.module.css");

const checks=[
  ["catálogo agrupa produtos uma vez por render",home.includes("const groupedProducts = useMemo(")&&home.includes("groupedProducts.get(category.id)")],
  ["catálogo não reordena produtos durante render da categoria",!home.includes("filtered.filter((product) => product.category === category.id")],
  ["promoções ainda saem do grupo principal",home.includes("promoIds?.has(product.id)")],
  ["cardápio não altera lógica de preços",home.includes("money(product.price)")&&home.includes("openProduct(product)")],
  ["imagem otimizada para card mobile",home.includes('(max-width: 560px) 37vw')],
  ["movimento em mouse fino, sem listener JS",css.includes("@media (hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)")],
  ["movimento reduzido contemplado",css.includes("@media (prefers-reduced-motion:reduce)")&&css.includes(".promoHeroCard:hover .promoHeroMedia img{transform:none}")],
  ["foco de teclado visível",css.includes(".promoHeroCard:focus-visible")],
  ["diagnóstico usa chave persistida real",center.includes('localStorage.getItem("dfl-admin-push-sync-v82")')&&pwa.includes('const PUSH_SYNC_KEY="dfl-admin-push-sync-v82"')],
  ["polling 1,5s removido",!center.includes("setInterval(refreshStatus, 1500)")],
  ["sincronização confirma conclusão",pwa.includes('window.dispatchEvent(new Event("dfl:admin-push-sync-complete"))')],
  ["assinaturas e limpeza de listeners",center.includes('window.addEventListener("dfl:admin-push-sync-complete", onRefresh)')&&center.includes('window.removeEventListener("dfl:admin-push-sync-complete", onRefresh)')],
  ["acessibilidade Admin",adminCss.includes("DFL SITE V87 R1 — ADMIN NOTIFICATION ACCESSIBILITY")],
  ["nenhum Firestore novo no motor de catálogo",!home.includes("onSnapshot(")&&!home.includes("getDocs(")],
];
for(const [name,condition] of checks) {
  assert.ok(condition,`FALHOU: ${name}`);
  console.log("✓",name);
}
console.log("DFL SITE V87 R1 —",checks.length,"contratos aprovados");
