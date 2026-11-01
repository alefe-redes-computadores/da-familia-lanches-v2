'use strict';
// Gate puro Node/Termux: sem Pillow, Android SDK, rede ou pedidos comerciais.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const r=path=>fs.readFileSync(path,'utf8');
const source=r('scripts/prepare-client-android.py');
const verify=r('scripts/verify-client-android-icons.py');
const workflow=r('.github/workflows/build-admin-android.yml');
const selector=r('scripts/ci/select-android-builds.cjs');
const manifest=JSON.parse(r('public/manifest.json'));
const {scopeOf}=require('./ci/select-android-builds.cjs');
const checks=[
 ['PWA qualquer tamanho conserva icone publico 192',manifest.icons.some(x=>x.src.startsWith('/icon-192x192.png')&&x.sizes==='192x192')],
 ['PWA qualquer tamanho conserva icone publico 512',manifest.icons.some(x=>x.src.startsWith('/icon-512x512.png')&&x.sizes==='512x512')],
 ['PWA maskable oficial 512',manifest.icons.some(x=>x.src.startsWith('/icon-maskable-512x512.png')&&x.sizes==='512x512'&&x.purpose==='maskable')],
 ['Fonte padrao = PWA publico',source.includes("PWA_STANDARD_192='icon-192x192.png'")],
 ['Splash nao deriva do Admin',source.includes("PWA_STANDARD_512='icon-512x512.png'")],
 ['Fonte adaptativa = maskable oficial',source.includes("PWA_MASKABLE_512='icon-maskable-512x512.png'")],
 ['Verifica manifesto antes de copiar Android',source.indexOf('standard192, standard512, maskable512, theme_color=pwa_assets()')<source.indexOf('shutil.copytree(SOURCE,DEST')],
 ['Sem desenho reduzido de 86% do R229',!source.includes('int(size*.86)')],
 ['Sem foreground reduzido de 68% do R229',!source.includes('foreground(432,.68)')],
 ['Sem fundo fixo Admin/retocado nos icones',!source.includes('(14,14,16,255)')],
 ['PWA maskable ocupa foreground completo',source.includes('maskable512.resize((432,432),Image.Resampling.LANCZOS)')],
 ['Bordas legacy suaves com transparencia',source.includes('painter.rounded_rectangle(')&&source.includes('ImageChops.multiply(')],
 ['Icone round circular nativo',source.includes('painter.ellipse(')&&source.includes("'ic_launcher_round.png'")],
 ['Tema herdado do PWA',source.includes('theme_color=pwa_assets()')||source.includes('theme_color=pwa_assets()')],
 ['Certificador verifica pixels byte a byte da renderizacao',verify.includes('not any(channel.getbbox() for channel in ImageChops.difference(actual,expected).split())')],
 ['Certificador confere maskable sem padding',verify.includes('adaptive foreground = PWA maskable sem reducao')],
 ['CI certifica PNG apos gerar',workflow.includes('python3 scripts/verify-client-android-icons.py')],
 ['CI barra ausencia de maskable adaptativo',workflow.includes('android-cliente/app/src/main/res/drawable-nodpi/ic_launcher_foreground.png')],
 ['CI valida round PNG',workflow.includes('android-cliente/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png')],
 ['Admin CI mantém contratos anteriores',workflow.includes('node scripts/test-site-r229-alarm-client.cjs')],
 ['R230 incluído no gate Android Admin',workflow.includes('node scripts/test-site-r230-client-icon.cjs')],
 ['Classe gerador eh cliente',scopeOf('scripts/prepare-client-android.py')==='cliente'],
 ['Classe validador eh cliente',scopeOf('scripts/verify-client-android-icons.py')==='cliente'],
 ['Classe icon PWA eh cliente',scopeOf('public/icon-maskable-512x512.png')==='cliente'],
 ['Classe workflow eh ambos',scopeOf('.github/workflows/build-admin-android.yml')==='both'],
 ['Identidade do Admin nao foi editada',!source.includes("DEST=ROOT/'android-admin'")],
];
for(const [label,ok] of checks)assert.ok(ok,label);
require('./test-site-r231-client-launcher.cjs');
require('./test-site-r232-client-runtime.cjs');
console.log(`R230: ${checks.length} contratos visuais, fonte unica PWA e protecao de CI OK (sem pedidos reais)`);
