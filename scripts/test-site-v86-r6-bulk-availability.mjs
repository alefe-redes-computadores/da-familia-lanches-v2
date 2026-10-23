import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const read = file => fs.readFileSync(file,'utf8');
const ok=(cond,label)=>{assert.ok(cond,`V86 R6: ${label}`);console.log('✓',label)};
const transpile=file=>{
 const result=ts.transpileModule(read(file),{fileName:file,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}});
 ok(!(result.diagnostics||[]).some(d=>d.category===ts.DiagnosticCategory.Error),`sintaxe ${file}`);
 return result.outputText;
};
const evaluate=(code)=>{const module={exports:{}};new Function('module','exports','require',code)(module,module.exports,(name)=>{throw new Error(`Import inesperado: ${name}`)});return module.exports;};
const core=evaluate(transpile('src/lib/catalogBulkAvailability.ts'));
const {buildBulkAvailabilityPlan,BULK_MAX_ITEMS}=core;
const catalog=[
 {id:'uai',name:'Uai',category:'lanches',disponivel:true},
 {id:'bitela',name:'Bitela',category:'lanches',disponivel:true},
 {id:'combo-uai',name:'Combo Uai',category:'combos',disponivel:true,bundleItems:[{productId:'uai',quantity:2}]},
 {id:'combo-familia',name:'Combo Família',category:'combos',disponivel:true,bundleItems:[{productId:'combo-uai',quantity:2}]},
 {id:'combo-bitela',name:'Combo Bitela',category:'combos',disponivel:true,bundleItems:[{productId:'bitela',quantity:2}]},
 {id:'kuat',name:'Kuat',category:'bebidas',disponivel:false},
];
let plan=buildBulkAvailabilityPlan(catalog,['uai'],false,true);
ok(plan.valid && plan.changes.length===3,'pausar lanche inclui dependentes em cascata');
ok(plan.automaticallyIncluded.some(p=>p.id==='combo-uai')&&plan.automaticallyIncluded.some(p=>p.id==='combo-familia'),'identifica dependências reais até segundo nível');
ok(!plan.changes.some(x=>x.id==='combo-bitela'),'não pausa combos sem vínculo com o item');
plan=buildBulkAvailabilityPlan(catalog,['uai'],false,false);
ok(plan.changes.length===1 && plan.uncoveredCombos.some(x=>x.id==='combo-uai'),'desmarcar dependências não realiza pausa silenciosa e alerta');
plan=buildBulkAvailabilityPlan(catalog,['kuat'],true,true);
ok(plan.valid && plan.changes.length===1 && !plan.automaticallyIncluded.length,'reativar item não reativa combos automaticamente');
ok(!buildBulkAvailabilityPlan(catalog,['inexistente'],false,true).valid,'rejeita item ausente do catálogo');
ok(!buildBulkAvailabilityPlan(catalog,[],false,true).valid,'rejeita lote vazio');
ok(buildBulkAvailabilityPlan(catalog,['uai','uai'],false,true).changes.length===3,'não duplica IDs do lote');
ok(!buildBulkAvailabilityPlan(catalog,['kuat'],false,true).valid,'estado já aplicado não dispara escrita redundante');
const fortyOne=Array.from({length:BULK_MAX_ITEMS+1},(_,i)=>({id:`p${i}`,name:`Produto ${i}`,category:'x',disponivel:true}));
ok(!buildBulkAvailabilityPlan(fortyOne,fortyOne.map(x=>x.id),false,true).valid,'limite máximo de itens protegido');
ok(buildBulkAvailabilityPlan(fortyOne,fortyOne.slice(0,40).map(x=>x.id),false,true).valid,'lote de 40 permitido');
for(const file of ['src/components/admin/CatalogBulkOperations.tsx','src/components/admin/CatalogAdmin.tsx','src/app/api/admin/catalog/route.ts','src/lib/adminCatalogClient.ts'])transpile(file);
const admin=read('src/components/admin/CatalogAdmin.tsx');
const ui=read('src/components/admin/CatalogBulkOperations.tsx');
const api=read('src/app/api/admin/catalog/route.ts');
const client=read('src/lib/adminCatalogClient.ts');
ok(admin.includes('<CatalogBulkOperations products={products} categories={categories} source={source}') && admin.includes('<CatalogQualityPanel products={products} categories={categories}'), 'Admin mantém diagnóstico e adiciona gestão em massa');
ok(ui.includes('role="region"') && ui.includes('Revisão obrigatória') && ui.includes('buildBulkAvailabilityPlan'), 'preview obrigatório antes de gravar');
ok(ui.includes('!ready || !review || !plan.valid || busy') && ui.includes('source === "hybrid"'), 'bloqueia gravação em fallback e sem confirmação');
ok(api.includes('action==="bulkAvailability"') && api.includes('adminDb.runTransaction(async tx =>') && api.includes('tx.update('), 'operação atômica em transação');
ok(api.includes('BULK_AVAILABILITY_STALE') && api.includes('BULK_AVAILABILITY_INVALID') && api.includes('snapshot.exists'), 'API protege conflitos, ID inválido e documento ausente');
ok(!ui.includes('onSnapshot(') && !ui.includes('setInterval(') && !ui.includes('getDocs('), 'sem listeners ou leituras adicionais no Admin');
ok(client.includes('action:"bulkAvailability"') && client.includes('BULK_AVAILABILITY_STALE:'), 'cliente conhece contrato e mensagem de conflito');
ok(read('docs/DFL-VPS-WHATSAPP-PENDENCIAS-V86.md').includes('delivery.pickup_ready') && read('docs/DFL-VPS-WHATSAPP-PENDENCIAS-V86.md').toLowerCase().includes('idempotência'), 'pendências da VPS registradas sem alterar integração');
console.log('\nDFL SITE V86 R6 — TESTES DA CENTRAL DE DISPONIBILIDADE OK');
