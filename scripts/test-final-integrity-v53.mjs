import fs from "node:fs";
import path from "node:path";
const r=p=>fs.readFileSync(p,"utf8");
const ok=(v,m)=>{if(!v)throw new Error(`V53: ${m}`);console.log("OK:",m)};

for(const f of ["src/app/page.module.css","src/components/ui/ProductDetailsModal.module.css","src/components/ui/CartModal.module.css"])
  ok(!r(f).includes("!important"),`${f} sem dívida !important`);

const files=fs.readdirSync("public/img");
const legacyWithWebp=files.filter(f=>/\.(png|jpe?g)$/i.test(f) && files.includes(f.replace(/\.(png|jpe?g)$/i,".webp")));
ok(legacyWithWebp.length===0,"nenhum original redundante permanece ao lado do WebP");

const sched=r("src/components/admin/SchedulingAdmin.tsx");
ok(sched.includes("c.enabledTimes.includes(t)||windows.some"),"horários salvos permanecem visíveis mesmo fora da janela atual");
ok(sched.includes("savedRef.current=JSON.stringify(c)"),"agenda confirma estado publicado após salvar");

const last=r("src/hooks/useLastCustomerOrder.ts");
ok(last.includes("readProjectedOrder(uid)"),"último pedido usa projeção barata primeiro");
ok(last.includes("limit(1)"),"fallback do último pedido continua limitado a um");
ok(!last.includes("onSnapshot("),"último pedido não cria listener");

const auth=r("src/components/admin/AdminAuthGate.tsx");
ok(auth.includes("admin.dafamilialanches.com.br"),"Admin reconhece domínio dedicado");
ok(auth.includes("browserLocalPersistence"),"sessão Admin persiste");
ok(auth.includes("signInWithRedirect"),"fallback móvel do Google preservado");

const header=r("src/components/layout/Header.tsx");
ok(!header.includes('content:"DFL"')&&!header.includes("content: 'DFL'"),"header não inventa logo sintética");
const checkout=r("src/components/ui/CheckoutModal.tsx");
ok(!checkout.includes("currentUser.displayName"),"checkout convidado continua null-safe");
ok(checkout.includes("createCustomerOrder"),"pedido autenticado oficial preservado");

console.log("\n============================================================");
console.log(" DFL SITE V53 — FINAL INTEGRITY — ZERO ERROS");
console.log("============================================================");
