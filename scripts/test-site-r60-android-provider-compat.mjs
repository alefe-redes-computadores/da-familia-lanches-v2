import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const read=(file)=>fs.readFileSync(file,'utf8');
const splash=read('scripts/client_android_splash_premium.py');
const manifest=read('android-admin/app/src/main/AndroidManifest.xml');
const paths=read('android-admin/app/src/main/res/xml/dfl_update_paths.xml');
const legacy=read('scripts/test-admin-safe-launcher-v21-4.mjs');
const r252=read('scripts/test-site-r252-client-splash.cjs');
const workflow=read('.github/workflows/build-admin-android.yml');
const safe=read('android-admin/app/src/main/java/br/com/dafamilialanches/admin/SafeLauncherActivity.java');
const updater=read('android-admin/app/src/main/java/br/com/dafamilialanches/admin/UpdateActivity.java');
const center=read('src/components/admin/AdminNotificationCenter.tsx');
const legacySearch=read('scripts/test-site-v87-r3-premium.cjs');
const rankedSearch=read('src/lib/adminQuickSearch.ts');
const checks=[
 ['Admin tem apenas provider da atualizacao', (manifest.match(/<provider\b/g)||[]).length===1],
 ['Provider de update privado e fixo',manifest.includes('android:authorities="${applicationId}.updates.fileprovider"')&&manifest.includes('android:resource="@xml/dfl_update_paths"')],
 ['Updater continua usando propria autoridade',updater.includes('getPackageName() + ".updates.fileprovider"')],
 ['Atualizador nao ganhou acesso ao splash',paths.includes('path="dfl-apk-updates/"')&&!paths.includes('twa_splash/')],
 ['Cold start ABH nao usa metadata splash no Admin',!manifest.includes('SPLASH_IMAGE_DRAWABLE')&&!manifest.includes('FILE_PROVIDER_AUTHORITY')&&safe.includes('extends LauncherActivity')],
 ['R252 adiciona splash separadamente e nao apaga update',splash.includes('_verify_updater_file_provider(app, resource)')&&splash.includes('esperados exatamente 2 FileProviders')],
 ['Provider de splash tem paths isolados',splash.includes("'@xml/dfl_twa_splash_paths'")&&splash.includes('twa_splash/')],
 ['Gate legado Admin preserva seguranca',legacy.includes('providers.length === 1')&&legacy.includes('cold start ou FileProvider exclusivo do atualizador divergiu')],
 ['Gate R252 preserva separacao de origens',r252.includes('R60: novo provider')&&!r252.includes("assert.ok(!admin.includes('FileProvider'))")],
 ['CI sempre valida R60 em ambos os Androids',(workflow.match(/node scripts\/test-site-r60-android-provider-compat\.mjs/g)||[]).length===2],
 ['CI mantém compilacao Gradle real',workflow.includes('gradle -p android-admin clean assembleRelease')&&workflow.includes('gradle -p android-cliente clean assembleRelease')],
 ['V87 R3 preserva busca R58 com prova executavel',legacySearch.includes('quickSearchScore(entry, query)')&&legacySearch.includes('busca combinada real, com acentos e sem falso positivo')&&rankedSearch.includes('if (!score) return 0')],
 ['V32 haptics de preferencia so confirmam gravacao efetiva',center.includes('writeAdminNotificationPrefs(next);\n      setPrefs(next);\n      setMessage("Preferência salva neste aparelho.");\n      haptic("success");')&&center.includes('haptic("step")')&&center.includes('haptic("error")')],
];
for(const [why,passed] of checks){assert.ok(passed,'R60: '+why);console.log('OK:',why)}

// Exercise the *real provider guard* without requiring Pillow on Termux/CI Sales.
// Extract only the stdlib helper from the Python AST and run with genuine XML.
const py=String.raw`
import ast
import pathlib
import xml.etree.ElementTree as ET
import tempfile
from copy import deepcopy
source=pathlib.Path('scripts/client_android_splash_premium.py').read_text()
module=ast.parse(source)
f=[n for n in module.body if isinstance(n,ast.FunctionDef) and n.name=='_verify_updater_file_provider']
assert len(f)==1
A='{http://schemas.android.com/apk/res/android}'
def ensure(v,message):
    if not v:raise RuntimeError('BLOQUEADO: '+message)
namespace={'ET':ET,'A':A,'ensure':ensure}
exec(compile(ast.Module(body=f,type_ignores=[]),'<r60-helper>','exec'),namespace)
check=namespace['_verify_updater_file_provider']
root=ET.parse('android-admin/app/src/main/AndroidManifest.xml').getroot()
app=root.find('application')
resources=pathlib.Path('android-admin/app/src/main/res')
original=check(app,resources)
assert len(original)==1
# The clone can carry two strictly isolated providers (updater + splash).
second=deepcopy(app)
ET.SubElement(second,'provider',{A+'name':'androidx.core.content.FileProvider',A+'authorities':'@string/provider_authority',A+'exported':'false',A+'grantUriPermissions':'true'})
assert len(check(second,resources))==2
# Unknown third, public provider and widened storage path all fail closed.
third=deepcopy(second)
ET.SubElement(third,'provider',{A+'name':'androidx.core.content.FileProvider',A+'authorities':'other',A+'exported':'true'})
try:check(third,resources)
except RuntimeError:pass
else:raise AssertionError('third provider allowed')
public=deepcopy(app)
public.find('provider').set(A+'exported','true')
try:check(public,resources)
except RuntimeError:pass
else:raise AssertionError('public provider allowed')
with tempfile.TemporaryDirectory() as d:
    target=pathlib.Path(d)/'xml';target.mkdir()
    (target/'dfl_update_paths.xml').write_text('<paths><files-path name="dfl-apk-updates" path="." /></paths>')
    try:check(app,pathlib.Path(d))
    except RuntimeError:pass
    else:raise AssertionError('wide update path allowed')
print('R60: 4 verificacoes dinamicas do FileProvider em XML real OK')
`;
const run=spawnSync('python3',['-c',py],{encoding:'utf8',timeout:30000});
assert.equal(run.status,0,`${run.stdout}\n${run.stderr}`);
console.log(run.stdout.trim());
console.log(`R60: ${checks.length+4} contratos de segurança compatíveis com R57, sem APK ou dados reais`);
