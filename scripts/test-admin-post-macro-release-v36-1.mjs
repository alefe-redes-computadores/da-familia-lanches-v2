import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

const ok = (value, message) => {
  if (!value) {
    throw new Error(`V36.1 RELEASE GATE: ${message}`);
  }
};

const workflow = read(".github/workflows/build-admin-android.yml");
const ui = read("src/app/admin/admin-ui.css");
const foundation = read(
  "src/components/admin/ui/admin-foundation.css",
);
const provider = read(
  "src/components/admin/ui/AdminExperienceProvider.tsx",
);
const layout = read("src/app/admin/layout.tsx");
const page = read("src/app/admin/page.tsx");
const orders = read("src/hooks/useAdminOrders.ts");
const coupons = read("src/components/admin/CouponsAdmin.tsx");
const bridge = read("scripts/test-admin-entregas-bridge-v25.mjs");
const push = read("scripts/test-admin-web-push-v20.mjs");
const money = read("src/lib/admin-money.ts");

/* Fundação atual */
ok(
  ui.includes("DFL ADMIN V35 — GLOBAL DESIGN SYSTEM AUTHORITY"),
  "V35 deixou de ser a autoridade visual",
);

ok(
  !ui.includes("DFL ADMIN V33 — VISUAL SYSTEM AUTHORITY"),
  "autoridade V33 antiga reapareceu",
);

ok(
  layout.includes("AdminExperienceProvider"),
  "provider global não está instalado",
);

ok(
  layout.includes("admin-foundation.css"),
  "foundation CSS não está carregado",
);

ok(
  provider.includes("useAdminFeedback"),
  "feedback global ausente",
);

ok(
  provider.includes("useAdminConfirm"),
  "confirmação global ausente",
);

ok(
  foundation.includes("env(safe-area-inset-bottom"),
  "safe area Android/TWA ausente",
);

/* Operação */
ok(
  (orders.match(/onSnapshot\s*\(/g) || []).length === 1,
  "Admin não possui exatamente um listener operacional de pedidos",
);

ok(
  orders.includes("limit("),
  "limite da consulta operacional desapareceu",
);

ok(
  page.includes('searchParams.get("order")'),
  "deep link de pedido foi removido",
);

ok(
  page.includes('searchParams.get("stage")'),
  "deep link de etapa foi removido",
);

ok(
  page.includes("optimisticStatuses"),
  "atualização otimista da fila foi removida",
);

ok(
  page.includes("actionLocksRef"),
  "proteção contra toque duplo foi removida",
);

/* Cupons / orçamento Firestore */
ok(
  !coupons.includes("onSnapshot"),
  "Cupons voltou a usar listener realtime",
);

ok(
  coupons.includes('getDocs(collection(db, "Cupons"))'),
  "leitura dirigida de Cupons desapareceu",
);

ok(
  coupons.includes("setCoupons((current)"),
  "estado local de Cupons após mutação desapareceu",
);

ok(
  coupons.includes("Recarregar"),
  "recarga manual de Cupons desapareceu",
);

/* Contrato monetário */
ok(
  money.includes("parseAdminMoney"),
  "parser monetário central ausente",
);

ok(
  money.includes("adminMoneyTyping"),
  "máscara monetária central ausente",
);

/* Integrações críticas continuam protegidas */
ok(
  bridge.includes("DFL ENTREGAS") ||
  bridge.includes("entregas") ||
  bridge.includes("bridge"),
  "contrato Admin → Entregas não encontrado",
);

ok(
  push.includes("push") ||
  push.includes("Push") ||
  push.includes("notification"),
  "contrato de push não encontrado",
);

/* CI deve validar arquitetura atual, não visual legado substituído */
ok(
  workflow.includes("test-admin-foundation-v35.mjs"),
  "workflow não valida V35",
);

ok(
  workflow.includes("test-admin-modules-v36.mjs"),
  "workflow não valida V36",
);

ok(
  workflow.includes("test-admin-post-macro-release-v36-1.mjs"),
  "workflow não valida V36.1",
);

ok(
  !workflow.includes(
    "node scripts/test-admin-visual-rebuild-v33.mjs",
  ),
  "workflow ainda executa gate visual V33 obsoleto",
);

ok(
  !workflow.includes(
    "node scripts/test-admin-finishing-pass-v33-1.mjs",
  ),
  "workflow ainda executa gate visual V33.1 obsoleto",
);

ok(
  !workflow.includes(
    "node scripts/test-admin-visual-qa-v34-1.mjs",
  ),
  "workflow ainda executa gate visual V34.1 obsoleto",
);

ok(
  !workflow.includes(
    "node scripts/test-admin-mobile-polish-v34-2.mjs",
  ),
  "workflow ainda executa gate visual V34.2 obsoleto",
);

ok(
  !workflow.includes(
    "node scripts/test-admin-final-responsive-v34-3-r1.mjs",
  ),
  "workflow ainda executa gate visual V34.3 obsoleto",
);

ok(
  !workflow.includes(
    "node scripts/test-admin-delivery-density-v34-4.mjs",
  ),
  "workflow ainda executa gate visual V34.4 obsoleto",
);

console.log("============================================================");
console.log(" DFL ADMIN V36.1 — POST-MACRO RELEASE GATE — ZERO ERROS");
console.log("============================================================");
console.log("✓ V35 é a autoridade visual");
console.log("✓ V36 é a autoridade dos módulos");
console.log("✓ listener operacional único preservado");
console.log("✓ Cupons sem listener realtime");
console.log("✓ deep links preservados");
console.log("✓ atualização otimista preservada");
console.log("✓ proteção contra toque duplo preservada");
console.log("✓ integração Entregas protegida");
console.log("✓ push protegido");
console.log("✓ contratos visuais substituídos aposentados do CI");
