import fs from "node:fs";

const read=(p)=>fs.readFileSync(p,"utf8");
const ok=(value,message)=>{if(!value)throw new Error(`V28: ${message}`);};

const auth=read("src/components/admin/AdminAuthGate.tsx");
const pwa=read("src/components/admin/AdminPwa.tsx");
const sw=read("public/admin-sw.js");
const workflow=read(".github/workflows/build-admin-android.yml");
const hook=read("src/hooks/useAdminOrders.ts");
const card=read("src/components/layout/OrderCard.tsx");

ok(auth.includes("browserLocalPersistence"),"persistência local do Firebase ausente");
ok(auth.includes("setPersistence(auth, browserLocalPersistence)"),"persistência não aplicada");
ok(pwa.includes('admin-sw.js?v=28'),"Admin registra SW antigo");
ok(pwa.includes("visibilitychange"),"resync ao retornar ausente");
ok(pwa.includes("resync ao reconectar"),"resync após reconexão ausente");
ok(sw.includes('CACHE = "dfl-admin-v28"'),"cache V28 ausente");
ok(sw.includes("function safeAdminTarget"),"sanitização de destino ausente");
ok(sw.includes('url.origin!==self.location.origin'),"origem externa não bloqueada");
ok(sw.includes('url.pathname!=="/admin"'),"rota fora do Admin não bloqueada");
ok(sw.includes("await client.navigate(target)"),"app aberto não navega ao destino");
ok(sw.includes("self.clients.openWindow(target)"),"cold start por notificação ausente");
ok(card.includes("Abrir no Entregas"),"ponte para Entregas perdida");
ok((hook.match(/onSnapshot\s*\(/g)||[]).length===1,"listener único alterado");
ok(workflow.includes("test-admin-production-runtime-v28.mjs"),"workflow não valida V28");

console.log("V28 ADMIN PRODUCTION RUNTIME — ZERO ERROS");
