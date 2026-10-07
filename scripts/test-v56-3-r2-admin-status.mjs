import fs from "node:fs";
const rules=fs.readFileSync("firestore.rules","utf8");
const repo=fs.readFileSync("src/lib/orderRepository.ts","utf8");
function ok(v,m){if(!v)throw new Error("V56.3 R2: "+m)}
ok(rules.includes("match /schedule_slots/{slotId}"),"regra schedule_slots");
ok(rules.includes("allow read, create, update: if isAdmin()"),"autoridade admin no slot");
ok(rules.includes("allow delete: if false"),"slot nao apagavel");
ok(repo.includes('const leavingSchedule = current === "Agendado" && next !== "Agendado"'),"liberacao de agendamento");
ok(repo.includes("scheduleSlotReleasedAt"),"marcacao de liberacao");
ok(repo.includes("ensureIntegrationEventInTransaction"),"outbox atomica");
ok(repo.includes("canTransitionOrderStatus"),"transicoes preservadas");
console.log("DFL SITE V56.3 R2 ADMIN STATUS — CONTRATOS OK");
