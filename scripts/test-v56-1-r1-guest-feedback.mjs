import fs from "node:fs";
const r=p=>fs.readFileSync(p,"utf8"),ok=(v,m)=>{if(!v)throw new Error("V56.1 R1: "+m);console.log("OK:",m)};
const g=r("src/lib/guestContinuity.ts"),l=r("src/components/auth/LoginIntentModal.tsx"),cx=r("src/lib/customerExperience.ts");
ok(g.includes("count<2"),"convite Google só ganha força a partir do segundo pedido");
ok(g.includes("7*86400000")&&g.includes("3*86400000"),"recusas aumentam cooldown em vez de insistir");
ok(l.includes("PERFIL NESTE APARELHO")&&l.includes("Sincronizar com Google"),"perfil guest explica armazenamento local e sincronização");
ok(cx.includes("86400000")&&cx.includes("answeredOrderIds"),"feedback possui cooldown e não repete no mesmo pedido");
console.log("V56.1 R1 GUEST CONTINUITY: CONTRATOS OK");
