/** V86 R7 — inventário de publicação, SEM fazer commit, push, deploy nem build. */
import fs from "node:fs";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
const BASE="6dc54f7f1e1179f5240ab712a29883cb99bb96bc";
const git=(...args)=>execFileSync("git",args,{encoding:"utf8"}).trim();
const read=f=>fs.readFileSync(f,"utf8");
const ok=(v,name)=>{assert.ok(v,`V86 R7: ${name}`);console.log("✓",name)};
ok(git("rev-parse","HEAD")===BASE,"HEAD publicado V85.1 R12 preservado");
ok(git("branch","--show-current")==="main","branch main");
ok(!git("ls-files","-u"),"nenhum conflito de merge");
ok(!git("diff","--cached","--name-only"),"nenhuma mudança staged");
const tests=[
 "scripts/test-site-v86-r1-address-conversion.mjs",
 "scripts/test-site-v86-r2-admin-catalog.mjs",
 "scripts/test-site-v86-r3-guest-quality.mjs",
 "scripts/test-site-v86-r4-addon-contract.mjs",
 "scripts/test-site-v86-r5-groups.mjs",
 "scripts/test-site-v86-r6-bulk-availability.mjs",
 "scripts/test-site-v86-r7-launch-audit.mjs",
];
for(const t of tests)ok(fs.existsSync(t),`suíte presente: ${t}`);
const files={
 address:"src/lib/addressIntelligence.ts",
 cart:"src/components/ui/CartModal.tsx",
 guest:"src/app/api/customer/guest-order-status/route.ts",
 groups:"src/lib/catalogModifierGroups.ts",
 bulk:"src/lib/catalogBulkAvailability.ts",
 launch:"src/lib/catalogLaunchAudit.ts",
 category:"src/components/admin/CatalogAdmin.tsx",
};
for(const [label,file] of Object.entries(files))ok(fs.existsSync(file),`contrato: ${label}`);
ok(read(files.guest).includes("clientRequestId"),"status de convidado mantém prova de acesso por tentativa");
ok(read(files.bulk).includes("BULK_MAX_ITEMS = 40"),"lote operacional tem limite explícito");
ok(read(files.cart).includes("applyCatalogReview"),"carrinho mantém revisão antes de checkout");
ok(read(files.category).includes("CatalogLaunchCenter")&&read(files.category).includes("CatalogBulkOperations"),"diagnóstico e operação coexistem");
const protectedFiles=["src/lib/integration/contracts.ts","src/lib/integration/server/reversePersistence.ts"];
for(const p of protectedFiles)ok(fs.existsSync(p),`integração preservada: ${p}`);
const changed=git("status","--porcelain","--untracked-files=all").split("\n").filter(Boolean);
console.log(`\nInventário Git: ${changed.length} arquivo(s) alterado(s)/novo(s) (incluindo trabalhos de outras versões).`);
console.log("Atenção: este script NÃO verifica Firebase em produção, Vercel, bot, WhatsApp ou estado do APK.");
console.log("SUA AÇÃO: testar os fluxos manuais no PWA/Admin e autorizar uma publicação separada.");
console.log("\nDFL SITE V86 R7 — PRÉ-RELEASE ESTÁTICO OK (SEM PUBLICAÇÃO)");
