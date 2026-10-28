'use strict';
/** R41: contratos do painel de abertura. Nao faz requests nem escreve pedidos. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const read=p=>fs.readFileSync(p,'utf8');
let tested=0;
const ok=(cond,name)=>{assert.ok(cond,name);tested++;console.log('✓',name)};
const source='src/lib/operationShiftReadiness.ts';
const compiled=ts.transpileModule(read(source),{fileName:source,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},reportDiagnostics:true});
ok(!(compiled.diagnostics||[]).some(x=>x.category===ts.DiagnosticCategory.Error),'nucleo TypeScript sem diagnosticos');
const obj={exports:{}};new Function('module','exports',compiled.outputText)(obj,obj.exports);
const {inspectShiftReadiness:inspect,formatShiftReport:format,SHIFT_SNAPSHOT_TTL_MS:TTL}=obj.exports;
const NOW=Date.parse('2026-10-28T14:00:00Z');
const clean={activeOrders:0,attentionOrders:0,historyHasMore:false,remoteState:'healthy',checkedAt:new Date(NOW-1000).toISOString(),nowMs:NOW,remoteError:false,outboxPending:0,outboxProcessing:0,outboxFailed:0,outboxDead:0,messagingPending:0,messagingProcessing:0,messagingQuarantined:0,humanInboxChecked:true,humanStorefrontChecked:true,humanCatalogChecked:true,humanHoursChecked:true};
const get=(v,id)=>inspect(v).signals.find(x=>x.id===id);
const inspected=inspect(clean);
ok(inspected.level==='ok','conferencia completa = ok explicito');
ok(inspected.signals.length===7,'sete controles independentes');
ok(inspected.snapshotFresh,'snapshot recente');
ok(inspected.transportGood,'transporte sem pendencias');
ok(inspected.unknowns===0&&inspected.reviews===0,'sem revisoes quando confirmado');
ok(TTL===300000,'validade maxima de cinco minutos');
ok(get({...clean,humanInboxChecked:false},'destination').level==='unknown','caixa de entrada nunca verificada automaticamente');
ok(get({...clean,humanStorefrontChecked:false},'storefront').level==='unknown','site depende de conferencia manual');
ok(get({...clean,humanCatalogChecked:false},'catalog').level==='unknown','catalogo depende de conferencia manual');
ok(get({...clean,humanHoursChecked:false},'hours').level==='unknown','agenda depende de conferencia manual');
ok(inspect({...clean,humanCatalogChecked:false}).level==='unknown','item manual pendente impede resumo completo');
ok(inspect({...clean,humanInboxChecked:false}).level==='unknown','sem check humano nao declara completo');
ok(get({...clean,checkedAt:null},'transport').level==='unknown','sem consulta = desconhecido');
ok(get({...clean,checkedAt:'nao-e-data'},'transport').level==='unknown','data malformada = desconhecido');
ok(get({...clean,checkedAt:new Date(NOW-TTL-1).toISOString()},'transport').level==='unknown','consulta vencida = desconhecido');
ok(get({...clean,checkedAt:new Date(NOW-TTL).toISOString()},'transport').level==='ok','borda de cinco minutos ainda e valida');
ok(get({...clean,checkedAt:new Date(NOW+31000).toISOString()},'transport').level==='unknown','relogio remoto no futuro invalida');
ok(get({...clean,checkedAt:new Date(NOW+10000).toISOString()},'transport').level==='ok','pequena oscilacao de relogio tolerada');
ok(get({...clean,remoteError:true},'transport').level==='unknown','erro remoto invalida snapshot anterior');
ok(inspect({...clean,remoteError:true}).level==='unknown','erro remoto nao exibe verde');
ok(get({...clean,remoteState:null},'transport').level==='unknown','sem status = desconhecido');
ok(get({...clean,remoteState:'attention'},'transport').level==='review','alerta remoto = revisao');
ok(get({...clean,remoteState:'quarantine'},'transport').level==='review','quarentena remota = revisao');
ok(get({...clean,outboxPending:1},'transport').level==='review','outbox pendente = revisao');
ok(get({...clean,outboxProcessing:1},'transport').level==='review','outbox processando = revisao');
ok(get({...clean,outboxFailed:1},'transport').level==='review','outbox falhou = revisao');
ok(get({...clean,outboxDead:1},'transport').level==='review','outbox dead letter = revisao');
ok(get({...clean,messagingPending:1},'transport').level==='review','mensagem pendente = revisao');
ok(get({...clean,messagingProcessing:1},'transport').level==='review','mensagem processando = revisao');
ok(get({...clean,messagingQuarantined:1},'transport').level==='review','mensagem em quarentena = revisao');
ok(get({...clean,outboxPending:null},'transport').level==='unknown','contagem ausente = desconhecido');
ok(get({...clean,outboxPending:-1},'transport').level==='unknown','contagem invalida = desconhecido');
ok(get({...clean,outboxPending:NaN},'transport').level==='unknown','NaN invalida contagem');
ok(get({...clean,outboxPending:Infinity},'transport').level==='unknown','infinito invalida contagem');
ok(get({...clean,activeOrders:2},'orders').level==='review','pedidos ativos sinalizados');
ok(get({...clean,attentionOrders:1},'orders').level==='review','alertas locais sinalizados');
ok(get({...clean,historyHasMore:true},'history').level==='unknown','historico paginado nao finge cobertura total');
ok(inspect({...clean,historyHasMore:true}).level==='unknown','historico parcial nao vira verde');
ok(inspect({...clean,activeOrders:1}).level==='review','revisao tem prioridade sobre desconhecido');
ok(inspect({...clean,activeOrders:1,humanInboxChecked:false}).reviews===1,'revisoes separadas de verificacoes pendentes');
ok(!get({...clean,humanInboxChecked:false},'destination').detail.includes('confirmada automaticamente'),'texto de destino nao afirma automacao');
ok(get(clean,'transport').detail.includes('não comprova entrada'),'transporte sem backlog nao prova destino');
const report=format(clean,inspected);
ok(report.includes('DFL SITE | CONFERENCIA OPERACIONAL R41'),'relatorio tem titulo');
ok(report.includes('[OK]'),'relatorio lista estado');
ok(report.includes('2026-10-28T14:00:00.000Z'),'relatorio inclui horario');
ok(report.includes('não contém pedidos nem dados pessoais'),'relatorio avisa limites de dados');
ok(!/(?:telefone|whatsapp|enderec[oç]|cliente:|token:)/i.test(report),'relatorio sem campos pessoais');
const admin=read('src/components/admin/OperationHealthAdmin.tsx');
const css=read('src/components/admin/OperationHealthAdmin.module.css');
for(const [label,token] of [
 ['motor integrado','inspectShiftReadiness(shiftInput)'],['reporte integrado','formatShiftReport(shiftInput,shiftReadiness)'],
 ['checagem humana controlada','checked={manualChecks[task.id]}'],['nunca registro remoto automatico','setManualChecks(previous=>({...previous,[task.id]:e.target.checked}))'],
 ['consulta sob demanda','onClick={()=>void checkIntegration()}'],['sem polling remoto','window.setInterval(()=>setClockMs(Date.now()),60_000)'],
 ['timeout da API','controller.abort(),10000'],['haptics','haptic("success")'],['copiar clipboard','navigator.clipboard.writeText'],
 ['sinaliza erro de copia','Não foi possível copiar'],['classificacao visual','data-level={shiftReadiness.level}'],
 ['apoio a mobile','styles.r41Shift'],['texto de garantia','Fila sem pendências não significa entrega confirmada.'],
 ['marcador release','R41 · ABERTURA DA LOJA'],
])ok(admin.includes(token),label);
for(const [label,token] of [['estilo card','.r41Shift{'],['estilo eixos','.r41ShiftChecks'],['controle de revisao','[data-level="review"]'],['tela pequena','@media(max-width:450px)'],['botao minimo','min-height:44px'],['contraste','.r41ShiftHead'],['itens de turno','.r41ManualTasks']])ok(css.includes(token),label);
ok(!/fetch\(|addDoc\(|setDoc\(|createCustomerOrder\(|runTransaction\(/.test(read(source)),'motor nao consulta nem escreve no Firestore');
for(const p of ['src/lib/operationShiftReadiness.ts','src/components/admin/OperationHealthAdmin.tsx']){
 const ast=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 ok(ast.parseDiagnostics.length===0,'sintaxe: '+p);
}
const preopen=read('src/lib/operationPreopenChecklist.ts');
ok(preopen.includes('remoteState===null')&&preopen.includes('remoteError'),'R39 conserva triagem sem falso verde');
ok(admin.includes('remote?.integration.backlog??null'),'R39 preservado no admin');
const auth=read('src/lib/orderRepository.ts');
ok(auth.includes('ensureIntegrationEventInTransaction(')&&auth.includes('runTransaction('),'outbox de pedidos autenticados preservada');
const checkout=read('src/components/ui/CheckoutModal.tsx');
ok(checkout.includes('orderOutcomeUncertain')&&checkout.includes('canOfferManualOrderFallback(code)'),'pedido incerto impede duplicacao por WhatsApp');
ok(checkout.includes('matchDeliveryRate')&&checkout.includes('calculateDeliveryFee(bairro)'),'frete original nao tocado');
console.log(`R41: ${tested} contratos aprovados. Sem pedidos de teste automaticos.`);
