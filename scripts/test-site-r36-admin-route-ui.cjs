#!/usr/bin/env node
'use strict';
/** DFL SITE R36: hermetic route/UI contracts. No Firestore, WhatsApp, network or writes. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
let count=0;const ok=(v,message)=>{assert.ok(v,message);count++};
const read=p=>fs.readFileSync(p,'utf8');
const files=[
 'src/lib/adminDeliveryPosition.ts','src/lib/deliveryTracking.ts',
 'src/components/layout/OrderCard.tsx','src/components/admin/ScheduledReminderSettings.tsx',
];
for(const path of files){const src=read(path);const ast=ts.createSourceFile(path,src,ts.ScriptTarget.Latest,true,path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);ok(ast.parseDiagnostics.length===0,'TS parse '+path);}
function load(source,dependencies={}){
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};vm.runInNewContext(compiled,{exports,Date,Number,String,Math,Intl,require:(p)=>{if(p in dependencies)return dependencies[p];throw Error('Unexpected import '+p)}},{timeout:2000});return exports;
}
const progress=load(read('src/lib/adminDeliveryPosition.ts')).adminDeliveryPosition;
const base={deliveryId:'dfl-abcdefgh12345678',deliveryTrackingEvent:'delivery.out_for_delivery',deliveryStopsAhead:3,deliveryTotalStops:6,deliveryStopPosition:4,deliveryIsNextStop:false};
ok(progress(base).kind==='ahead','started route with 3 physical stops');
ok(progress(base).label==='3 paradas físicas antes','human readable route count');
ok(progress({...base,deliveryStopsAhead:1}).label==='1 parada física antes','singular stop');
ok(progress({...base,deliveryStopsAhead:0,deliveryStopPosition:1}).kind==='next','true next stop');
for(const value of [null,undefined,'',false,'0','3','abc',NaN,Infinity,-1,0.5,101,{},[]]){
 const p=progress({...base,deliveryStopsAhead:value});
 ok(!p.verified&&p.stopsAhead===null,'never infer zero from '+String(value));
 ok(!/^(?:0 parada|próxima parada)/i.test(p.label),'unknown must not look first');
}
for(const event of ['delivery.assigned','delivery.created','order.updated','route.reordered',null,undefined]){
 const p=progress({...base,deliveryTrackingEvent:event,deliveryStopsAhead:0,deliveryIsNextStop:true});
 ok(!p.verified&&p.kind==='waiting','assigned/unknown not started '+event);
}
ok(progress({...base,deliveryIsNextStop:true}).kind==='unavailable','contradictory next flag blocked');
ok(progress({...base,deliveryStopsAhead:6}).kind==='unavailable','out of bounds');
ok(progress({...base,deliveryTotalStops:null}).kind==='unavailable','missing route total');
ok(progress({...base,deliveryTotalStops:0}).kind==='unavailable','invalid route total');
ok(progress({...base,deliveryStopPosition:7}).kind==='unavailable','position beyond total');
ok(progress({...base,deliveryOperationalCompleted:true}).kind==='completed','completed wins');
ok(progress({...base,deliveryTrackingEvent:'delivery.completed'}).kind==='completed','terminal reverse event wins');
const status={normalizarStatus:v=>v||'Pendente'};
const tracking=load(read('src/lib/deliveryTracking.ts'),{'@/lib/orderUtils':status}).deliveryTrackingPresentation;
ok(tracking({status:'Pronto',tipoEntrega:'delivery',deliveryTrackingEvent:'delivery.assigned',deliveryStopsAhead:0,deliveryTotalStops:6}).isNext===false,'public no false next before departure');
ok(tracking({status:'Saiu para Entrega',tipoEntrega:'delivery',deliveryTrackingEvent:'delivery.position_changed',deliveryStopsAhead:3,deliveryTotalStops:6}).stopsAhead===3,'public 3 real stops');
ok(tracking({status:'Saiu para Entrega',tipoEntrega:'delivery',deliveryTrackingEvent:'delivery.position_changed',deliveryStopsAhead:null,deliveryTotalStops:6}).isNext===false,'public null not zero');
ok(tracking({status:'Saiu para Entrega',tipoEntrega:'delivery',deliveryTrackingEvent:'delivery.next_stop',deliveryStopsAhead:0}).isNext===true,'legacy next-stop event still authoritative');
ok(tracking({status:'Finalizado',tipoEntrega:'delivery',deliveryTrackingEvent:'delivery.next_stop',deliveryStopsAhead:0}).visible===false,'terminal suppresses obsolete next');
ok(tracking({status:'Saiu para Entrega',tipoEntrega:'pickup',deliveryTrackingEvent:'delivery.next_stop',deliveryStopsAhead:0}).visible===false,'pickup does not imply courier');
const card=read('src/components/layout/OrderCard.tsx'),css=read('src/components/layout/OrderCard.module.css'),adminCss=read('src/app/admin/admin.module.css'),schedule=read('src/components/admin/ScheduledReminderSettings.tsx'),scheduleCss=read('src/components/admin/ScheduledReminderSettings.module.css');
ok(card.includes('adminDeliveryPosition(pedido)'),'card centralizes physical stops');
ok(card.includes('logisticsPosition.kind === "next"'),'trusted next flag only');
ok(!card.includes('Number(pedido.deliveryStopsAhead)'),'no unsafe null to zero coercion');
ok(card.includes('Abrir no Entregas')&&card.includes('handleOpenDflEntregas'),'Entregas action preserved');
ok(card.includes('Cancelar')&&card.includes('Despachar'),'business actions preserved');
ok(css.includes('R36 — operação premium')&&css.includes('font-size:12px!important'),'card typography');
ok(adminCss.includes('R36 — Hierarquia da fila')&&adminCss.includes('overflow-x:auto!important'),'mobile filters scroll');
ok(adminCss.includes('primaryNav')&&adminCss.includes('stageFocusBar'),'navigation and stage filters kept');
ok(schedule.includes('data-pending={pending > 0}'),'0 schedules stops looking urgent');
ok(schedule.includes('setInterval')&&schedule.includes('dueScheduledReminder'),'actual reminder logic untouched');
ok(scheduleCss.includes('data-pending="false"')&&scheduleCss.includes('[data-pending="true"]'),'reminder visual states');
ok(!/(?:fetch\(|onSnapshot\(|\.collection\()/.test(read('src/lib/adminDeliveryPosition.ts')),'pure helper no db');
console.log('R36 ADMIN + TRACKING: '+count+' contratos herméticos OK; zero rede/Firestore/WhatsApp.');
