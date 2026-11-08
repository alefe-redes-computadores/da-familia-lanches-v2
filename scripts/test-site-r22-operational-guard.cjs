'use strict';
/* R22: prova hermetica; sem Firestore, WhatsApp ou chamadas de rede. */
const assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm'), ts=require('typescript');
const read=x=>fs.readFileSync(x,'utf8');
const paths=['src/lib/adminOrders.ts','src/hooks/useAdminOrders.ts','src/app/admin/page.tsx','src/lib/deliveryTracking.ts','scripts/test-site-r229-alarm-client.cjs'];
let passes=0;const ok=(v,label)=>{assert.ok(v,label);passes++};
for(const path of paths.slice(0,4)){
 const ast=ts.createSourceFile(path,read(path),ts.ScriptTarget.Latest,true,path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 ok(ast.parseDiagnostics.length===0,`parse ${path}: ${ast.parseDiagnostics.map(x=>x.messageText).join(',')}`);
}
const normalizarStatus=(value)=>{
 const s=String(value??'Pendente').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 if(s.includes('agend'))return'Agendado';if(s.includes('pendente'))return'Pendente';
 if(s.includes('producao'))return'Em Produção';if(s.includes('pronto'))return'Pronto';
 if(s.includes('saiu')||s.includes('entrega'))return'Saiu para Entrega';
 if(s.includes('final')||s.includes('conclu'))return'Finalizado';if(s.includes('cancel'))return'Cancelado';return'Pendente';
};
const orderDateToMillis=(value)=>{if(!value)return 0;const d=value?.toMillis?.()??Date.parse(value);return Number.isFinite(d)?d:0};
const mocks={'./orderCompat':{orderDateToMillis,normalizeText:s=>String(s).toLowerCase()},'./orderUtils':{normalizarStatus},'@/lib/orderUtils':{normalizarStatus}};
function compile(path){const output=ts.transpileModule(read(path),{fileName:path,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}});
 const exp={};vm.runInNewContext(output.outputText,{exports:exp,require:(id)=>{if(id in mocks)return mocks[id];throw new Error('Modulo imprevisto '+id)},Date,Intl,Number,String,Math,Set}, {filename:path});return exp}
const admin=compile('src/lib/adminOrders.ts');
const awaiting=admin.isAwaitingCommercialAcceptance;
ok(awaiting({status:'Pendente'})===true,'pendente sem aceite toca alarme');
ok(awaiting({status:'Pendente',acceptedAt:'2026-11-08T15:00:00.000Z'})===false,'aceito nao toca alarme');
ok(awaiting({status:'Agendado'})===false,'agendado nao e novo');
ok(awaiting({status:'Finalizado'})===false,'finalizado nao e novo');
ok(awaiting({status:'Pendente',acceptedAt:'invalid'})===true,'aceite invalido nao autentica');
const t=Date.parse('2026-11-08T15:45:00.000Z'),acceptedAt='2026-11-08T15:10:00.000Z',created='2026-11-08T12:00:00.000Z';
const accepted={id:'A',status:'Pendente',acceptedAt,createdAt:created,data:created};
const pending={id:'B',status:'Pendente',createdAt:'2026-11-08T15:05:00.000Z',data:'2026-11-08T15:05:00.000Z'};
ok(admin.operationalAttention(accepted,t)?.label.includes('aguardando preparo')===true,'aceite nao diz aguardando aceite');
ok(admin.operationalAttention(pending,t)?.label.includes('Aguardando aceite')===true,'novo continua alertando por aceite');
ok(admin.compareOperationalOrders(pending,accepted)<0,'novo antes de aceito na fila');
const h=read('src/hooks/useAdminOrders.ts'),page=read('src/app/admin/page.tsx');
ok(h.includes('.filter(isAwaitingCommercialAcceptance)')&&h.includes('if (!known || !isAwaitingCommercialAcceptance(known)) return;'),'bootstrap e push filtram aceito');
ok(h.includes('isAwaitingCommercialAcceptance(order) || normalizarStatus(order.status) === "Pronto"'),'badge nao conta aceite como novo');
ok((h.match(/onSnapshot\s*\(/g)||[]).length===1,'sem novos listeners Firebase');
ok(page.includes('pendentes: operationalPedidos.filter(isAwaitingCommercialAcceptance).length'),'contador novos exclui aceitos');
const tracking=compile('src/lib/deliveryTracking.ts').deliveryTrackingPresentation;
ok(tracking({status:'Pendente',tipoEntrega:'pickup',deliveryTrackingEvent:'delivery.next_stop',deliveryStopsAhead:0}).visible===false,'retirada sem motoboy no site');
ok(tracking({status:'Finalizado',tipoEntrega:'delivery',deliveryTrackingEvent:'delivery.next_stop',deliveryStopsAhead:0}).visible===false,'finalizado nao mostra proxima parada');
const complete=tracking({status:'Finalizado',tipoEntrega:'delivery',deliveryTrackingEvent:'delivery.completed'});
ok(complete.visible===true&&complete.terminal===true,'conclusao real continua visivel');
ok(tracking({status:'Saiu para Entrega',tipoEntrega:'delivery',deliveryTrackingEvent:'delivery.next_stop',deliveryStopsAhead:0}).isNext===true,'proxima parada legitima preservada');
ok(h.includes('reconhecerPedido')&&h.includes('desfazerReconhecimentoPedido')&&h.includes('dfl:admin-push-foreground'),'alarme existente preservado');
ok(read('scripts/test-site-r229-alarm-client.cjs').includes('isAwaitingCommercialAcceptance'),'legado atualizado sem desligar gate');
console.log(`R22 P0: ${passes} contratos hermeticos PASS (zero rede / sem pedidos reais).`);
