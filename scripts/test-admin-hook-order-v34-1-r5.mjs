import fs from "node:fs";

const s = fs.readFileSync("src/app/admin/page.tsx", "utf8");
const ok = (v, m) => { if (!v) throw new Error(`V34.1 R5: ${m}`); };

const authReturn = s.indexOf("if (!currentUser)");
const loadingReturn = s.indexOf("if (loading)");
const queue = s.indexOf("const queueContext");
const moment = s.indexOf("const currentMoment");

ok(authReturn > 0, "retorno de autenticação não localizado");
ok(loadingReturn > authReturn, "retorno de loading não localizado");
ok(queue > loadingReturn, "queueContext não localizado após loading");
ok(moment > queue, "âncora currentMoment inválida");

const risky = s.slice(loadingReturn, moment);
ok(!risky.includes("useMemo("), "ainda existe useMemo após retorno condicional");
ok(!risky.includes("useEffect("), "existe useEffect após retorno condicional");
ok(!risky.includes("useState("), "existe useState após retorno condicional");
ok(!risky.includes("useRef("), "existe useRef após retorno condicional");
ok(risky.includes("const queueContext = (() => {"), "queueContext não virou cálculo comum");

console.log("DFL ADMIN V34.1 R5 — HOOK ORDER — ZERO ERROS");
