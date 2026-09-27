import fs from "node:fs";
import assert from "node:assert/strict";

const file =
  "src/lib/integration/server/messagingProjection.ts";

const source = fs.readFileSync(file,"utf8");

function ok(condition,message){
  assert.ok(condition,message);
  console.log("✓",message);
}

console.log("");
console.log("==============================================");
console.log(" DFL MESSAGING CLAIM V2 — CONTRACT");
console.log("==============================================");

ok(
  source.includes(
    '.where("status","==","pending")'
  ),
  "claim consulta somente fila pending"
);

ok(
  source.includes(
    '.where("status","==","processing")'
  ),
  "claim preserva recuperação de processing"
);

ok(
  !source.includes(
    '.where("messaging_eligible","==",true)\\n    .limit(safeLimit*4)'
  ),
  "varredura global por messaging_eligible foi removida"
);

ok(
  source.includes(
    "messaging_eligible:false"
  ),
  "settle bem-sucedido remove intent da elegibilidade"
);

ok(
  /status\s*:\s*"queued"\s*,[\s\S]{0,160}?messaging_eligible\s*:\s*false/.test(source),
  "queued não permanece elegível"
);

ok(
  /status\s*:\s*"pending"\s*,[\s\S]{0,160}?messaging_eligible\s*:\s*true/.test(source),
  "falha retorna intent para fila elegível"
);

ok(
  source.includes(
    "Date.now() - lockedAt >= LOCK_TTL_MS"
  ),
  "TTL de recuperação de lock foi preservado"
);

ok(
  source.includes(
    "const raw = await claimRawCandidate"
  ),
  "claim atômico por transaction foi preservado"
);

ok(
  source.includes(
    "await releaseUnhydratable(raw,workerId)"
  ),
  "recuperação de intent não hidratável foi preservada"
);

ok(
  !source.includes(
    '.where("status","==","queued")'
  ),
  "queued nunca é consultado pelo claim"
);

console.log("");
console.log("CLAIM V2 CONTRACT — OK");
