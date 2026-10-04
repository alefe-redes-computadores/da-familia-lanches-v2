import fs from "node:fs";
const p="src/app/admin/error.tsx";
const s=fs.readFileSync(p,"utf8");
const ok=(v,m)=>{if(!v)throw new Error(`V34.1 R4: ${m}`)};
ok(s.includes('"use client"'),"error boundary não é client");
ok(s.includes("error?.message"),"mensagem real não exibida");
ok(s.includes("error?.stack"),"stack não exibida");
ok(s.includes("reset()"),"reset ausente");
console.log("DFL ADMIN V34.1 R4 — RUNTIME DIAGNOSTIC — ZERO ERROS");
