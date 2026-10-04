import fs from "node:fs";
const s=fs.readFileSync("src/app/admin/page.tsx","utf8");
const ok=(v,m)=>{if(!v)throw new Error(`V34.1 R3: ${m}`)};
ok(s.includes("useSearchParams"),"useSearchParams sumiu");
ok(s.includes("Suspense"),"Suspense ausente");
ok(s.includes("function AdminPageContent()"),"conteúdo Admin não separado");
ok(s.includes("export default function AdminPage()"),"wrapper default ausente");
ok(s.includes("<Suspense fallback={<AdminPanelLoading />}>"),"boundary explícita ausente");
console.log("DFL ADMIN V34.1 R3 — SUSPENSE /ADMIN — ZERO ERROS");
