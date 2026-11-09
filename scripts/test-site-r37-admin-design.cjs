#!/usr/bin/env node
'use strict';
/* R37: hermetic visual contract; does not touch Firestore, network, WhatsApp. */
const assert=require('node:assert/strict');const fs=require('node:fs');
const ts=require('typescript');let count=0;
const ok=(c,label)=>{assert.ok(c,label);count++};
const src=p=>fs.readFileSync(p,'utf8');
const p=src('src/app/admin/page.tsx');
const card=src('src/components/layout/OrderCard.tsx');
const admin=src('src/app/admin/admin.module.css');
const cardcss=src('src/components/layout/OrderCard.module.css');
const sched=src('src/components/admin/ScheduledReminderSettings.module.css');
const r37admin=admin.slice(admin.lastIndexOf('DFL SITE R37'));
const r37card=cardcss.slice(cardcss.lastIndexOf('DFL SITE R37'));
const r37schedule=sched.slice(sched.lastIndexOf('/* R37: reminder controls'));
for(const [path,content,kind] of [['page.tsx',p,ts.ScriptKind.TSX],['card.tsx',card,ts.ScriptKind.TSX]]){
 const t=ts.createSourceFile(path,content,ts.ScriptTarget.Latest,true,kind);
 ok(t.parseDiagnostics.length===0,'parse '+path);
}
ok(p.includes('data-r37-stage={tab}'),'scoped design per tab');
ok(p.includes('data-mode={isOrderTab ? "operation" : "management"}'),'old data-mode preserved');
for(const tab of ['"cozinha"','"expedicao"','"agendados"','"concluidos"','"catalogo"','"operacao"','"gestao"'])ok(p.includes(tab),'existing tab '+tab);
for(const marker of ['setTab("cozinha")','setTab("expedicao")','setTab("agendados")','setTab("concluidos")','setTab("operacao")','setTab("mensageria")','onClick={() => setSelectedOrderId(null)}','<ScheduledReminderSettings','<OrderCard','setAttentionOnly','setServiceFilter'])ok(p.includes(marker),'navigation intact '+marker);
for(const marker of ['const next =','"Despachar"','"Marcar pronto"','"Aceitar pedido"','>Cancelar</button>','>Abrir no Entregas</button>','handleOpenDflEntregas','toggleDetails','confirmCancellation','pedido.deliveryId','operationalAttention'])ok(card.includes(marker),'operational feature intact '+marker);
ok(card.includes('setCancelConfirm(true)'),'cancel action handler intact');
ok(card.includes('handleOpenDflEntregas();'),'Entregas bridge action handler intact');
ok(card.includes('CANAL WHATSAPP'),'handoff badge no longer misstates notification');
ok(!card.includes('label: handoffChannel === "whatsapp" ? "WHATSAPP"'),'misleading badge removed');
for(const marker of ['.workspace[data-r37-stage]','.operationHero','.operationBar','.primaryNav','.queueHead','.stageFocusBar','.queueTools','.filterSummary','.grid','.managementHub','.managementNav','.management','.orderInspector','.inspectorHead','--r37-line','prefers-reduced-motion','focus-visible','safe-area-inset-top'])ok(r37admin.includes(marker),'unified admin visuals '+marker);
for(const marker of ['.card:not([data-inspector="true"])','.summaryMain h3','.queuePreview','.queueAddress','.logisticsMini','.bridgeAction','.actions button','.cancel','.inspectorTabs','focus-visible','prefers-reduced-motion'])ok(r37card.includes(marker),'order visuals '+marker);
for(const marker of ['.panel:not([open])[data-pending="false"]','.panel[data-pending="true"]','.panel[open]'])ok(r37schedule.includes(marker),'reminders hierarchy '+marker);
ok(!/display\s*:\s*none\s*!important/.test(r37admin),'no hiding admin functions');
ok(!/display\s*:\s*none\s*!important/.test(r37card),'no hiding operational buttons');
ok(!/position\s*:\s*fixed/.test(r37admin),'no new fixed overlays');
ok(!/fetch\s*\(|onSnapshot\s*\(|setInterval\s*\(/.test(r37admin+r37card+r37schedule),'CSS only; no activity');
for(const [name,s] of [['admin',r37admin],['order',r37card],['schedule',r37schedule]]){
 const clean=s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,'');
 let n=0;for(const c of clean){if(c==='{')n++;if(c==='}')n--;assert.ok(n>=0,'CSS braces no premature close '+name)}
 ok(n===0,'CSS braces balanced '+name);
}
try{const postcss=require('postcss');for(const [name,s] of [['admin',admin],['card',cardcss],['schedule',sched]]){postcss.parse(s,{from:name+'.css'});ok(true,'postcss '+name)}}catch(e){if(e.code==='MODULE_NOT_FOUND')console.log('NOTE: postcss optional; brace parser verified');else throw e}
console.log('R37 ADMIN VISUAL: '+count+' contratos herméticos OK. Sem rede, sem gravação, sem WhatsApp.');
