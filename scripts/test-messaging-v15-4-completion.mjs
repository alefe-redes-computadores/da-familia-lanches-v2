/** V15.4 regressão R24: corrigir a contradição histórica entre comentário e comportamento. */
import fs from 'node:fs';
const source=fs.readFileSync('src/lib/integration/server/messagingProjection.ts','utf8');
const gate=fs.readFileSync('src/lib/integration/server/messagingR11Policy.ts','utf8');
const ok=(value,message)=>{if(!value)throw new Error(`V15.4/R24: ${message}`);};
ok(/if \(n === "finalizado" && text\(payload\.tipoEntrega\) === "pickup"\) \{\s*(?:\/\/[^\n]*\n\s*)?return null;\s*\}/.test(source),
  'retirada no balcão deve ser silenciosa, sem forjar delivery.completed');
ok(source.includes('case "delivery_completed": return "delivery.completed";'),
  'conclusão logística real vinda do Entregas preservada');
ok(gate.includes("eventType.startsWith('delivery.')") &&
  gate.includes("return 'pickup_logistics_suppressed';") &&
  !gate.includes("!(eventType === 'delivery.completed'"),
  'política R11 não deve liberar delivery.completed para retirada');
console.log('V15.4 conclusão pickup + autoridade delivery — R24 corrigida: OK');
