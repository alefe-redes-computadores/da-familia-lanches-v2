import fs from "node:fs";

const s=fs.readFileSync(
  "src/lib/integration/server/messagingFastLane.ts",
  "utf8"
);

const ok=(v,m)=>{
  if(!v) throw new Error(`V15.2: ${m}`);
};

ok(
  s.includes('"x-dfl-messaging-worker-token":workerToken'),
  "header oficial do worker ausente"
);

ok(
  !s.includes('"x-dfl-messaging-token":workerToken'),
  "header incorreto da V15.1 ainda presente no wake"
);

ok(
  s.includes('body:JSON.stringify({})'),
  "worker deve receber {}"
);

console.log("V15.2 contrato oficial do worker: OK");
