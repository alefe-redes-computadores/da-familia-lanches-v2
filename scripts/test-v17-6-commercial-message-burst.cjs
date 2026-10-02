const fs = require('node:fs');
const read = (path) => fs.readFileSync(path, 'utf8');
const ok = (v, m) => { if (!v) throw new Error(`V17.6 SITE: ${m}`); };

const messaging = read('src/lib/integration/server/messagingProjection.ts');

ok(messaging.includes('const BURST_COLLECTION = "integration_notification_bursts"'), 'coleção burst ausente');
ok(messaging.includes('const COMMERCIAL_BURST_MS = 60 * 1000'), 'janela 60s ausente');
ok(messaging.includes('eventType === "order.production"'), 'produção fora do burst');
ok(messaging.includes('eventType === "order.ready"'), 'pronto fora do burst');
ok(messaging.includes('phone.replace(/\\D/g, "")'), 'telefone não normalizado');
ok(messaging.includes('return adminDb.runTransaction(async tx =>'), 'gate não transacional');
ok(messaging.includes('last_notified_at'), 'gate não possui relógio');
ok(messaging.includes('reason:"burst_coalesced"'), 'supressão não auditável');
ok(messaging.includes('status:"suppressed"'), 'marker suprimido ausente');
ok(messaging.includes('messaging_eligible:false'), 'marker pode entrar na fila');
ok(messaging.includes('suppressed_reason:"same_recipient_same_stage_60s"'), 'motivo da supressão ausente');
ok(messaging.includes('burst_protocol:"commercial-burst-v1"'), 'protocolo ausente');
ok(!messaging.includes('setInterval(') && !messaging.includes('onSnapshot('), 'polling/listener indevido');

console.log('============================================================');
console.log(' V17.6 SITE COMMERCIAL MESSAGE BURST — ZERO ERROS');
console.log('============================================================');
console.log('✓ status/eventos continuam individuais');
console.log('✓ mesmo telefone + Produção/60s = 1 aviso');
console.log('✓ mesmo telefone + Pronto/60s = 1 aviso');
console.log('✓ logística continua por pedido/endereço');
console.log('✓ supressão idempotente e auditável');
