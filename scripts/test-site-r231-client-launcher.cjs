"use strict";
// R231: safegate de Java TWA; sem Pillow, SDK Android, banco ou pedidos reais.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const child=require('node:child_process');
const p='scripts/prepare-client-android.py';
const source=fs.readFileSync(p,'utf8');
const files=['EntryActivity.java','SafeLauncherActivity.java','DelegationService.java'];
const base='android-admin/app/src/main/java/br/com/dafamilialanches/admin/';
for(const name of files){
  const text=fs.readFileSync(base+name,'utf8');
  assert.ok(text.includes('package br.com.dafamilialanches.admin;'),name+' sem package base');
}
const safe=fs.readFileSync(base+'SafeLauncherActivity.java','utf8');
assert.ok(!safe.includes('admin.dafamilialanches.com.br'),'Fixture precisa reproduzir URL opcional ausente');
assert.ok(!safe.includes('dfl_admin_native_diagnostics'),'Fixture precisa reproduzir preferencia opcional ausente');
assert.match(source,/def rewrite_optional\(path,changes\):/,'Substituicao opcional ausente');
assert.match(source,/source=source\.replace\(old,new\)/,'Opcional ainda obriga ancora');
assert.match(source,/rewrite\(path,\[\('package br\.com\.dafamilialanches\.admin','package '\+TARGET_PACKAGE\)\]\)/,'Package Java deve continuar obrigatorio');
assert.match(source,/rewrite_optional\(path,\[/,'Java sem campos opcionais tem que passar');
const loop=source.slice(source.indexOf("for path in sorted(java.glob('*.java')):"),source.indexOf('java.rename('));
assert.ok(loop.indexOf('rewrite_optional(')>loop.indexOf('rewrite(path,['),'Ordem obrigatorio -> opcional');
assert.ok(loop.includes("rewrite_optional(path,[\n          ('admin.dafamilialanches.com.br',TARGET_HOST)"),'Host obrigatoriamente opcional');
assert.match(source,/assert 'br\.com\.dafamilialanches\.admin' not in content/,'Confere referencia antiga no Java de saida');
assert.match(source,/assert 'admin\.dafamilialanches\.com\.br' not in content/,'Confere dominio Admin no Java de saida');
assert.ok(source.includes("PWA_MASKABLE_512='icon-maskable-512x512.png'"),'Fonte maskable PWA intocada');
assert.ok(source.includes('maskable512.resize((432,432),Image.Resampling.LANCZOS)'),'Adaptive original intocado');
assert.ok(source.includes('rounded_launcher(standard192,size)'), 'Legacy PWA intocado');
assert.ok(!source.includes('dfl-admin-icon-master.png'),'Cliente nao pode herdar master Admin');
assert.equal((source.match(/shutil\.copytree\(SOURCE,DEST/g)||[]).length,1,'Template do Admin nao pode ser modificado');
// Parse Python source in runtime sem Pillow, sem executar gerador.
const python=child.spawnSync('python3',['-c','import ast,sys;ast.parse(sys.stdin.read())'],{input:source,encoding:'utf8'});
assert.equal(python.status,0,`Sintaxe Python invalida: ${python.stderr}`);
console.log('R231: 17 contratos do launcher Cliente, Java opcional e identidade oficial PWA OK; zero pedidos reais');
