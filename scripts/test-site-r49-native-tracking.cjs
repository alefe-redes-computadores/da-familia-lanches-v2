'use strict';
/** R49 isolated build-time Cliente deep-link regression. No network/order/message. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const cp=require('node:child_process');
const read=p=>fs.readFileSync(p,'utf8');
const runtime=read('scripts/client_android_runtime.py');
const admin=read('android-admin/app/src/main/java/br/com/dafamilialanches/admin/EntryActivity.java');
const selector=require('./ci/select-android-builds.cjs');
assert.deepEqual(selector.classify(['scripts/client_android_runtime.py']),{admin:false,cliente:true},'CI recompila APENAS Cliente');
assert(runtime.includes('R49_PROTECTED_LINK'),'R49 guard presente no gerador');
assert(admin.includes('launchTwaWithNativeNotificationPermission();'),'template Admin intocado');
assert(!admin.includes('openProtectedTrackingLink'),'Admin nunca recebe R49');
const python=String.raw`
from pathlib import Path
from tempfile import TemporaryDirectory
from client_android_runtime import prepare_client_runtime
import xml.etree.ElementTree as ET
base=Path.cwd()
admin=base/'android-admin/app/src/main'
with TemporaryDirectory(prefix='r49-client-only-') as tmp:
    main=Path(tmp)/'app/src/main'
    java=main/'java/br/com/dafamilialanches/cliente'
    java.mkdir(parents=True)
    src=(admin/'java/br/com/dafamilialanches/admin/EntryActivity.java').read_text(encoding='utf-8')
    src=src.replace('package br.com.dafamilialanches.admin;','package br.com.dafamilialanches.cliente;')
    src=src.replace('admin.dafamilialanches.com.br','dafamilialanches.com.br')
    (java/'EntryActivity.java').write_text(src,encoding='utf-8')
    xml=(admin/'AndroidManifest.xml').read_text(encoding='utf-8').replace('admin.dafamilialanches.com.br','dafamilialanches.com.br')
    (main/'AndroidManifest.xml').write_text(xml,encoding='utf-8')
    prepare_client_runtime(main)
    generated=(java/'EntryActivity.java').read_text(encoding='utf-8')
    manifest=(main/'AndroidManifest.xml').read_text(encoding='utf-8')
    assert generated.count('private boolean openProtectedTrackingLink()')==1
    assert generated.count('if (openProtectedTrackingLink())')==1
    assert generated.index('if (openProtectedTrackingLink())')<generated.index('        launchTwa();')
    assert '"/acompanhar".equals(incoming.getPath())' in generated
    assert '"https".equalsIgnoreCase(incoming.getScheme())' in generated
    assert '"dafamilialanches.com.br".equalsIgnoreCase(incoming.getHost())' in generated
    assert 'Intent.ACTION_VIEW.equals(intent.getAction())' in generated
    assert 'tab.intent.setPackage(browserPackage);' in generated
    assert 'tab.launchUrl(this, incoming);' in generated
    assert 'openClienteInBrowser(this, incoming)' in generated
    assert generated.count('getFragment()')==0
    assert generated.count('getEncodedFragment()')==0
    assert 'openProtectedTrackingLink' not in src
    assert 'LAUNCHING_BROWSER' not in manifest
    assert 'android.permission.POST_NOTIFICATIONS' not in manifest
    assert 'android.permission.POST_NOTIFICATIONS' in (admin/'AndroidManifest.xml').read_text()
    assert 'launchTwa();' in generated
    ET.fromstring(manifest)
print('R49_CLIENTE: generated Java/manifest/link preserved, no Admin change or token log')
`;
const result=cp.spawnSync('python3',['-c',python],{encoding:'utf8',env:{...process.env,PYTHONPATH:'scripts',PYTHONDONTWRITEBYTECODE:'1'},timeout:30000});
assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
console.log(result.stdout.trim());
console.log('R49_GATE_OK | Android Cliente only | URL token preserved | no sends');
