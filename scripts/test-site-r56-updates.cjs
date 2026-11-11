#!/usr/bin/env node
'use strict';
/** R56: verificacoes hermeticas; sem rede, instalacao, WhatsApp ou GitHub real. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
let checks=0;
const ok = (value, message) => { assert.ok(value, message); checks++; };
const eq = (left,right,message) => { assert.equal(left,right,message); checks++; };
const read = p => fs.readFileSync(p,'utf8');
const files=[
  ['src/lib/android-updates/policy.ts',ts.ScriptKind.TS],
  ['src/app/api/updates/android/route.ts',ts.ScriptKind.TS],
  ['src/components/updates/AndroidUpdatesCenter.tsx',ts.ScriptKind.TSX],
  ['src/app/atualizacoes/page.tsx',ts.ScriptKind.TSX],
  ['src/app/admin/atualizacoes/page.tsx',ts.ScriptKind.TSX],
];
for (const [file,kind] of files) {
  const result=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,kind);
  eq(result.parseDiagnostics.length,0,'TypeScript parser '+file);
}
const policyPath=files[0][0];
const compiled=ts.transpileModule(read(policyPath),{fileName:policyPath,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
eq((compiled.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,'transpilacao policy sem erro');
const moduleExports={};vm.runInNewContext(compiled.outputText,{exports:moduleExports,require,Map,Number,String,Array,Date,RegExp,Boolean,Object},{timeout:3000});
const {parseSuccessfulRun,parseCertifiedRelease,latestVerifiedRelease,isAndroidFlavor}=moduleExports;
const run={id:55544,run_number:412,head_sha:'a'.repeat(40),head_branch:'main',status:'completed',conclusion:'success',event:'push',path:'.github/workflows/build-admin-android.yml@refs/heads/main'};
const published='2026-11-11T20:00:00Z';
const createRelease=(app='admin',override={})=>{
 const admin=app==='admin',prefix=admin?'dfl-admin-android-':'dfl-cliente-android-',name=`DFL-${admin?'Admin':'Cliente'}-412.apk`;
 return {...{draft:false,prerelease:false,published_at:published,tag_name:`${prefix}412`,target_commitish:run.head_sha,assets:[{id:9993,name,size:4256980,state:'uploaded',digest:'sha256:'+'a'.repeat(64),browser_download_url:`https://github.com/alefe-redes-computadores/da-familia-lanches-v2/releases/download/${prefix}412/${name}`}]},...override};
};
ok(isAndroidFlavor('admin')&&isAndroidFlavor('cliente')&&!isAndroidFlavor('finance'),'somente dois pacotes permitidos');
eq(parseSuccessfulRun(run).build,412,'run assinado no branch e workflow correto');
eq(parseSuccessfulRun({...run,conclusion:'failure'}),null,'Action falha rejeitada');
eq(parseSuccessfulRun({...run,head_branch:'feature'}),null,'branch incorreto rejeitado');
eq(parseSuccessfulRun({...run,path:'.github/workflows/other.yml'}),null,'workflow incorreto rejeitado');
const certified=parseCertifiedRelease(createRelease(),parseSuccessfulRun(run),'admin');
ok(certified,'APK admin certificado');
eq(certified.packageId,'br.com.dafamilialanches.admin','identidade Admin correta');
eq(parseCertifiedRelease(createRelease(),parseSuccessfulRun(run),'cliente'),null,'nunca misturar Cliente e Admin');
ok(parseCertifiedRelease(createRelease('cliente'),parseSuccessfulRun(run),'cliente'),'APK Cliente certificado');
eq(parseCertifiedRelease(createRelease('admin',{target_commitish:'b'.repeat(40)}),parseSuccessfulRun(run),'admin'),null,'commit mismatch rejeitado');
eq(parseCertifiedRelease(createRelease('admin',{tag_name:'dfl-admin-android-411'}),parseSuccessfulRun(run),'admin'),null,'tag mismatch rejeitada');
eq(parseCertifiedRelease(createRelease('admin',{assets:[{...createRelease().assets[0],digest:''}]}),parseSuccessfulRun(run),'admin'),null,'digest ausente rejeitado');
eq(parseCertifiedRelease(createRelease('admin',{assets:[{...createRelease().assets[0],browser_download_url:'https://evil.example/a.apk'}]}),parseSuccessfulRun(run),'admin'),null,'URL alterada rejeitada');
eq(parseCertifiedRelease(createRelease('admin',{assets:[{...createRelease().assets[0],state:'deleted'}]}),parseSuccessfulRun(run),'admin'),null,'asset indisponivel rejeitado');
const full=latestVerifiedRelease({workflow_runs:[run]},{releases:[createRelease()]},'admin');
ok(full&&full.build===412,'melhor release com run associado');
eq(latestVerifiedRelease({workflow_runs:[]},{releases:[createRelease()]},'admin'),null,'release sem workflow rejeitada');
const route=read(files[1][0]);
ok(route.includes('latestVerifiedRelease')&&route.includes('verification_unavailable')&&route.includes('available: false'),'API fail closed');
ok(!route.includes('process.env.GITHUB_TOKEN')&&!route.includes('ghp_'),'API sem credenciais públicas');
const ui=read(files[2][0]);
ok(ui.includes('Ainda não há download nativo') || (ui.includes('intent://updates#Intent') && fs.existsSync('android-admin/app/src/main/java/br/com/dafamilialanches/admin/UpdateActivity.java')), 'versão R56 sem ponte ou R57 com ponte real');
ok(ui.includes('Esta tela web não lê o versionCode') || ui.includes('A tela Android do atualizador consulta o versionCode real'), 'TWA continua sem forjar versionCode na web');
ok(ui.includes("document.addEventListener('visibilitychange'")&&ui.includes('RECHECK_INTERVAL_MS'),'verifica ao retornar, com cooldown');
const adminCenter=read('src/components/admin/AdminNotificationCenter.tsx');
ok(adminCenter.includes('onSyncSuccess')&&adminCenter.includes('Token sincronizado com sucesso'),'confirma evento real');
ok(!adminCenter.includes('setMessage("Alertas de novos pedidos ativados.")'),'nao inventa sucesso por timer');
ok(adminCenter.includes('/admin/atualizacoes'),'link da central Admin');
ok(read('src/components/layout/Footer.tsx').includes('/atualizacoes'),'link Cliente');
const workflow=read('.github/workflows/build-admin-android.yml');
ok(workflow.includes('release-admin-certified:')&&workflow.includes('release-cliente-certified:'),'duas publicacoes independentes');
ok(workflow.includes("vars.DFL_ANDROID_RELEASES_APPROVED == 'true'")&&workflow.includes('contents: write'),'release desativada sem aprovacao');
ok(workflow.includes('apksigner')&&workflow.includes('sha256sum')&&workflow.includes('gh release create'),'certificado e sha publicados apos build');
ok(workflow.includes('node scripts/test-site-r56-updates.cjs'),'gates acoplados a CI');
console.log(`R56: ${checks} contratos locais de autenticidade, identidades, central e CI aprovados (sem rede).`);
