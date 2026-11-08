'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const {classify,select,scopeOf}=require('./ci/select-android-builds.cjs');
const hook=fs.readFileSync('src/hooks/useAdminOrders.ts','utf8');
const sw=fs.readFileSync('public/admin-sw.js','utf8');
const assetlinks=fs.readFileSync('src/app/.well-known/assetlinks.json/route.ts','utf8');
const workflow=fs.readFileSync('.github/workflows/build-admin-android.yml','utf8');
const builder=fs.readFileSync('scripts/prepare-client-android.py','utf8');
const page=fs.readFileSync('src/app/admin/page.tsx','utf8');
const checks=[
  ['Alarme nao perde a flag de aceite',hook.includes('acknowledgedPendingIdsRef.current.add(cleanId)')],
  ['Aceite encerra toque sem depender de outros pendentes',/acknowledgedPendingIdsRef\.current\.add\(cleanId\);[\s\S]{0,410}silenceAlarm\(\);/.test(hook)],
  ['Cancelamento invalida play pendente',hook.includes('alarmGenerationRef.current += 1')],
  ['Promise de audio revalida geracao',hook.includes('alarmGenerationRef.current !== generation || !alarmActiveRef.current')],
  ['Tem limite de toque por lote',hook.includes('}, 35000)')],
  ['Timer sempre cancelado ao silenciar',hook.includes('clearTimeout(alarmTimeoutRef.current)')],
  ['Vibracao cancelada ao aceitar',hook.includes('navigator.vibrate?.(0)')],
  ['Push ja aceito nao reativa',hook.includes('if (!known || !isAwaitingCommercialAcceptance(known)) return') && hook.includes('isAwaitingCommercialAcceptance')],
  ['Um unico listener Firestore', (hook.match(/onSnapshot\s*\(/g)||[]).length===1],
  ['Service worker fecha notificacao por pedido',sw.includes('DFL_ADMIN_ACK_ORDER')&&sw.includes('getNotifications({tag:`new-order-${id}`})')],
  ['FCM continua ativo',sw.includes('messaging.onBackgroundMessage')],
  ['Admin continua com reconhecimento e rollback',page.includes('reconhecerPedido(id)')&&page.includes('desfazerReconhecimentoPedido(id)')],
  ['Identidade Admin preservada',assetlinks.includes('br.com.dafamilialanches.admin')],
  ['Identidade Cliente declarada',assetlinks.includes('br.com.dafamilialanches.cliente')],
  ['SHA digital asset links estavel',assetlinks.includes('77:F6:88:B5:32:06:0E:41:35:C2:9F:4E:24:22:4A:6C:34:C0:F1:74:DB:D2:65:E4:BD:27:50:6D:88:17:55:63')],
  ['Gerador nao edita android-admin',builder.includes('shutil.copytree(SOURCE,DEST')&&builder.includes("DEST=ROOT/'android-cliente'")],
  ['Gerador troca package e destino',builder.includes("TARGET_PACKAGE='br.com.dafamilialanches.cliente'")&&builder.includes("TARGET_HOST='dafamilialanches.com.br'")],
  ['Build cliente produz release real',workflow.includes('gradle -p android-cliente clean assembleRelease')],
  ['App cliente exige assinatura estavel',workflow.includes('DFL_ADMIN_KEYSTORE_BASE64')&&workflow.includes('keytool -list -v')],
  ['App cliente confere pacote',workflow.includes("package: name='br.com.dafamilialanches.cliente'")],
  ['Actions selecionam escopo antes de builds',workflow.includes('needs: scope')&&workflow.includes('needs.scope.outputs.cliente')&&workflow.includes('needs.scope.outputs.admin')],
  ['CI inclui testes R229',workflow.includes('node scripts/test-site-r229-alarm-client.cjs')],
];
for(const [label,ok] of checks)assert.ok(ok,label);
for(const [n,s,kind] of [['useAdminOrders.ts',hook,ts.ScriptKind.TS],['assetlinks.ts',assetlinks,ts.ScriptKind.TS]]) {
 const parsed=ts.createSourceFile(n,s,ts.ScriptTarget.Latest,true,kind);
 assert.equal(parsed.parseDiagnostics.length,0,'Sintaxe: '+n);
}
assert.equal(select('automatico',['src/components/admin/AdminPwa.tsx']).admin,true);
assert.deepEqual(classify(['src/components/admin/AdminPwa.tsx']),{admin:true,cliente:false});
assert.deepEqual(classify(['src/components/product/ProductPublicPage.tsx']),{admin:false,cliente:true});
assert.deepEqual(classify(['src/lib/integration/server/relay.ts']),{admin:true,cliente:true});
assert.deepEqual(classify(['docs/registro.md']),{admin:false,cliente:false});
assert.deepEqual(select('admin',[]),{admin:true,cliente:false});
assert.deepEqual(select('cliente',[]),{admin:false,cliente:true});
assert.deepEqual(select('ambos',[]),{admin:true,cliente:true});
assert.equal(scopeOf('src/app/.well-known/assetlinks.json/route.ts'),'both');
assert.equal(scopeOf('src/hooks/useAdminOrders.ts'),'admin');
console.log('R229: '+(checks.length+2+9)+' contratos de alarme, APK Cliente e selecao de workflow OK. Zero pedidos reais.');
