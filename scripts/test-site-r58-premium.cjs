'use strict';
/** R58: contratos comportamentais sem rede, Firebase, pedidos ou permissoes. */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const path = require('node:path');
let checks = 0;
const ok=(pass,label)=>{assert.ok(pass,'R58: '+label);checks++;console.log('OK:',label)};
const read=p=>fs.readFileSync(p,'utf8');
function loadTs(p){
  const src=read(p);
  const result=ts.transpileModule(src,{fileName:path.basename(p),compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
  ok(!(result.diagnostics||[]).some(x=>x.category===ts.DiagnosticCategory.Error),'sintaxe '+p);
  const mod={exports:{}};
  new Function('module','exports','require',result.outputText)(mod,mod.exports,()=>{throw Error('import inesperado em '+p)});
  return mod.exports;
}
const search=loadTs('src/lib/adminQuickSearch.ts');
const menu=read('src/components/admin/AdminQuickSwitcher.tsx');
const catalog={name:'Catálogo',hint:'Produtos e combos',terms:'lanche lanches cardápio cardapio cadim cadom carda cadin'};
const schedule={name:'Funcionamento da loja',hint:'Horários e abertura',terms:'abrir fechar manutenção status'};
const other={name:'Mensageria',hint:'Fila e mensagens',terms:'whatsapp'};
for(const word of ['cadim','cadom','cardapio','cardápio','lanche','lanches','catálog','carda'])ok(search.quickSearchScore(catalog,word)>0,'catálogo localizado por '+word);
for(const word of ['Horarios','horaro','horário','funcionameto'])ok(search.quickSearchScore(schedule,word)>0,'horarios localizados por '+word);
ok(search.quickSearchScore(other,'cadim')===0,'nenhum falso positivo para mensageria');
ok(search.quickSearchScore(catalog,'zzzxq')===0,'ruido nao abre resultado falso');
ok(menu.includes('quickSearchScore(entry, query)') && menu.includes('cadim cadom') && menu.includes('groupOrder'), 'launcher usa ranking real e aliases');
const prefs=loadTs('src/lib/adminNotificationPrefs.ts');
const entries=new Map();
global.window={localStorage:{getItem:k=>entries.has(k)?entries.get(k):null,setItem:(k,v)=>entries.set(k,v)},dispatchEvent:()=>{}};
global.CustomEvent=class {constructor(type,options){this.type=type;this.detail=options?.detail}};
const basic=prefs.readAdminNotificationPrefs();
ok(basic.quietHours===false && basic.privatePreview===false && basic.newOrders===true,'preferencias legadas nao alteradas');
prefs.writeAdminNotificationPrefs({...basic,quietHours:true,privatePreview:true});
ok(prefs.readAdminNotificationPrefs().quietHours && prefs.readAdminNotificationPrefs().privatePreview,'persistencia real das preferencias');
ok(prefs.adminLocalQuietHoursActive(new Date('2026-11-12T02:00:00Z')),'silencio local em Brasilia as 23h');
ok(!prefs.adminLocalQuietHoursActive(new Date('2026-11-12T15:00:00Z')),'som diurno nao silenciado');
ok(prefs.adminLocalAlertBody('Joao · pedido pronto')==='Confira os detalhes no painel administrativo.','nome privado nos avisos locais');
prefs.writeAdminNotificationPrefs({...basic,quietHours:false,privatePreview:false});
ok(prefs.adminLocalAlertBody('Pedido pronto')==='Pedido pronto','avisos locais originais preservados');
const policy=read('src/lib/android-updates/alertPrefs.ts');
ok(policy.includes('UPDATE_ALERT_PREF_CHANGED') && policy.includes('rememberAnnouncedBuild') && policy.includes('shouldAnnounceVerifiedRelease'),'politica de aviso real versionada');
const notice=read('src/components/updates/AndroidUpdateNotice.tsx');
const center=read('src/components/updates/AndroidUpdatesCenter.tsx');
const admin=read('src/components/admin/AdminPwa.tsx'),header=read('src/components/layout/Header.tsx');
ok(notice.includes('rememberAnnouncedBuild(app, release!.build)') && notice.includes('!navigator.onLine') && notice.includes('document.visibilityState'),'avisos locais apenas online e sob revalidacao');
ok(notice.includes("data.available === true") && notice.includes('shouldAnnounceVerifiedRelease'), 'nenhum aviso quando a API falha ou nao ha release');
ok(!notice.includes('Notification.requestPermission') && !notice.includes('PushManager') && !notice.includes('onBackgroundMessage'),'nenhum push remoto criado');
ok(center.includes('writeReleaseAlertEnabled(app, next') && center.includes('checked={alertsEnabled}') && center.includes('A comparação com o APK instalado'),'opt-in efetivo e sem versao falsa');
ok(header.includes('<AndroidUpdateNotice app="cliente" />') && admin.includes('<AndroidUpdateNotice app="admin" />'),'Cliente e Admin recebem somente seu proprio aviso');
const store=read('src/components/admin/StoreOperationAdmin.tsx');
ok(store.includes('useAdminFeedback') && store.includes('showFeedback({tone:') && !store.includes('className={styles.msg}'),'toast fora de container transformado e sem duplicata');
const orders=read('src/hooks/useAdminOrders.ts');
ok(orders.includes('!adminLocalQuietHoursActive()') && orders.includes('adminLocalAlertBody(candidate.body)'),'silencio e privacidade ligados aos eventos reais');
ok((orders.match(/onSnapshot\s*\(/g)||[]).length===1,'listener Firestore unico preservado');
const ui=read('src/components/admin/AdminNotificationCenter.tsx');
ok(ui.includes('checked={prefs.quietHours}') && ui.includes('checked={prefs.privatePreview}'),'controles personalizados implementados');
for(const file of [
 'src/components/updates/AndroidUpdateNotice.tsx','src/components/updates/AndroidUpdatesCenter.tsx',
 'src/components/admin/AdminQuickSwitcher.tsx','src/components/admin/StoreOperationAdmin.tsx',
 'src/components/admin/AdminNotificationCenter.tsx','src/components/admin/AdminPwa.tsx','src/components/layout/Header.tsx'
]){
 const src=read(file);
 const result=ts.transpileModule(src,{fileName:file,compilerOptions:{jsx:ts.JsxEmit.Preserve,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
 ok(!(result.diagnostics||[]).some(x=>x.category===ts.DiagnosticCategory.Error),'TSX parser '+file);
}
// R58 FIX2: bloqueios reais do lint resolvidos sem desligar regras.
ok(menu.includes('const resetFrame = window.requestAnimationFrame(() => {') && menu.includes('window.cancelAnimationFrame(resetFrame)'),'reset da busca sem setState sincrono no efeito');
ok(ui.includes('const initialRefreshFrame = window.requestAnimationFrame(refreshStatus)') && ui.includes('window.cancelAnimationFrame(initialRefreshFrame)'),'refresh da central apos o commit e limpeza do frame');
ok(ui.includes('import Link from "next/link"') && ui.includes('href="/admin/atualizacoes"') && !ui.includes('<a className={styles.updateCenterLink}'),'navegacao interna Next Link');
ok(orders.includes('currentUser: User | null') && orders.includes('import type { User } from "firebase/auth"') && !orders.includes('const generation = alarmGenerationRef.current;'),'hook de pedidos tipado e variavel morta eliminada');
ok(!store.includes('DEFAULT_STORE_SETTINGS'),'import de loja sem simbolo inutilizado');
ok(center.includes('}, [refresh, app]);'),'refresh Android com dependencia explicita');
console.log(`R58 CONTRATOS: ${checks} verificacoes OK; sem pedidos, rede, push remoto ou banco`);
