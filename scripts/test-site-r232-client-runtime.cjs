'use strict';
// R232: deterministic launch smoke with only stdlib/Python, zero network,
// no Firestore, no Android SDK and absolutely no order creation.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const cp=require('node:child_process');
const rd=p=>fs.readFileSync(p,'utf8');
const builder=rd('scripts/prepare-client-android.py');
const runtime=rd('scripts/client_android_runtime.py');
const iconGate=rd('scripts/verify-client-android-icons.py');
const fromR230=rd('scripts/test-site-r230-client-icon.cjs');
const original=rd('android-admin/app/src/main/java/br/com/dafamilialanches/admin/EntryActivity.java');
const originalManifest=rd('android-admin/app/src/main/AndroidManifest.xml');
const selector=require('./ci/select-android-builds.cjs');
const checks=[
 ['Admin possui onCreate e retry de diagnostico com gate de notificacao',
   (original.match(/launchTwaWithNativeNotificationPermission\(\);/g)||[]).length===2],
 ['R232-R2: ambos pontos especificos serao transformados',runtime.includes('_ONCREATE_CALL')&&runtime.includes('_RETRY_CALL')],
 ['Admin preserva permissao no seu manifesto',originalManifest.includes('android.permission.POST_NOTIFICATIONS')],
 ['Cliente gera versao quiet sem tocar no Admin',builder.includes('from client_android_runtime import prepare_client_runtime')&&builder.includes('prepare_client_runtime(main)')],
 ['Novo helper so usa Python stdlib',!runtime.includes('from PIL import')],
 ['Template exige pacote cliente',runtime.includes("PACKAGE = 'br.com.dafamilialanches.cliente'")],
 ['Inicio muda para launchTwa direto',runtime.includes('        launchTwa();')],
 ['Remove a Activity de permissao',runtime.includes('_PERMISSION_ACTIVITY')],
 ['Remove a declaracao POST_NOTIFICATIONS',runtime.includes('_PERMISSION_MANIFEST')],
 ['Nao desativa INTERNET',runtime.includes("'android.permission.INTERNET' in permissions")],
 ['Conserva TWA delegacao',runtime.includes("'.DelegationService'")],
 ['Confere HTTPS e host',runtime.includes("'https' and d.attrib.get(ANDROID_NS+'host') == HOST")],
 ['Confere foreground maskable PWA',runtime.includes('ic_launcher_foreground.png')],
 ['Confere icone round PWA',runtime.includes('ic_launcher_round.png')],
 ['Confere link da assinatura',runtime.includes('77:F6:88:B5:32:06:0E:41:35:C2:9F:4E:24:22:4A:6C:34:C0:F1:74:DB:D2:65:E4:BD:27:50:6D:88:17:55:63')],
 ['Verificador visual dispara gate runtime',iconGate.includes('validate_client_runtime(ROOT)')],
 ['Gate R230 chama gate R232',fromR230.includes("require('./test-site-r232-client-runtime.cjs')")],
 ['Selector so exige compilacao Cliente',JSON.stringify(selector.classify(['scripts/prepare-client-android.py','scripts/verify-client-android-icons.py']))===JSON.stringify({admin:false,cliente:true})],
];
for(const [title,ok] of checks)assert.ok(ok,title);
const smoke=String.raw`
from pathlib import Path
from tempfile import TemporaryDirectory
from client_android_runtime import prepare_client_runtime
import xml.etree.ElementTree as ET
base=Path.cwd()
admin=base/'android-admin/app/src/main'
with TemporaryDirectory(prefix='r232-no-push-') as temp:
    main=Path(temp)/'app/src/main'
    java=main/'java/br/com/dafamilialanches/cliente'
    java.mkdir(parents=True)
    original=(admin/'java/br/com/dafamilialanches/admin/EntryActivity.java').read_text(encoding='utf-8')
    original=original.replace('package br.com.dafamilialanches.admin;','package br.com.dafamilialanches.cliente;')
    original=original.replace('admin.dafamilialanches.com.br','dafamilialanches.com.br')
    (java/'EntryActivity.java').write_text(original,encoding='utf-8')
    xml=(admin/'AndroidManifest.xml').read_text(encoding='utf-8').replace('admin.dafamilialanches.com.br','dafamilialanches.com.br')
    (main/'AndroidManifest.xml').write_text(xml,encoding='utf-8')
    prepare_client_runtime(main)
    output=(java/'EntryActivity.java').read_text(encoding='utf-8')
    root=ET.parse(main/'AndroidManifest.xml').getroot()
    permissions=[a.attrib.get('{http://schemas.android.com/apk/res/android}name') for a in root.findall('uses-permission')]
    assert 'android.permission.INTERNET' in permissions
    assert 'android.permission.POST_NOTIFICATIONS' not in permissions
    assert 'launchTwa();' in output and 'requestPermissions(' not in output
    assert 'onRequestPermissionsResult(' not in output
    assert 'launchTwaWithNativeNotificationPermission' not in output
    assert 'retry.setOnClickListener(' in output
    assert 'clearDiagnostic(this);\n                    launchTwa();' in output
    assert output.count('launchTwa();') >= 2
    # Os dois pontos de acesso existentes seguem abrindo TWA.
    assert original.count('launchTwaWithNativeNotificationPermission();') == 2
    assert output.count('launchTwaWithNativeNotificationPermission();') == 0
    # fail closed: same directory cannot silently be transformed twice
    try:
        prepare_client_runtime(main)
    except ValueError as e:
        assert 'R232: ancora ausente' in str(e)
    else:
        raise AssertionError('unexpected idempotent mutation')
print('R232-R2: onCreate e retry sem notificacoes, admin inalterado OK')
`;
const py=cp.spawnSync('python3',['-c',smoke],{encoding:'utf8',env:{...process.env,PYTHONPATH:'scripts',PYTHONDONTWRITEBYTECODE:'1'}});
assert.equal(py.status,0,`R232 Python smoke failed: ${py.stdout}\n${py.stderr}`);
console.log(py.stdout.trim());
console.log(`R232-R2: ${checks.length+8} contratos de abertura, permissao, escopo e isolamento OK. Nenhum pedido real.`);
