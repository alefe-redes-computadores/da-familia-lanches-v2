'use strict';
/** R50: no network, no real messages, no tokens; verifies generated Cliente XML. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const cp = require('node:child_process');
const code = fs.readFileSync('scripts/client_android_runtime.py', 'utf8');
const template = fs.readFileSync('android-admin/app/src/main/AndroidManifest.xml', 'utf8');
const adminJava = fs.readFileSync('android-admin/app/src/main/java/br/com/dafamilialanches/admin/EntryActivity.java','utf8');
const selector = require('./ci/select-android-builds.cjs');
assert(code.includes('R50_SINGLE_HANDLER'), 'R50: patch ausente');
assert(code.includes('safe.remove(shadow[0])'), 'R50: remocao seletiva ausente');
assert(code.includes('R49_PROTECTED_LINK'), 'R49: entrada protegida preservada');
assert(adminJava.includes('launchTwaWithNativeNotificationPermission();'), 'Admin alterado');
assert.deepStrictEqual(selector.classify(['scripts/client_android_runtime.py','scripts/test-site-r50-single-handler.cjs']),{admin:false,cliente:true}, 'build deve ser somente Cliente');
const py = String.raw`
from pathlib import Path
from tempfile import TemporaryDirectory
from client_android_runtime import prepare_client_runtime
import xml.etree.ElementTree as ET
import re
BASE=Path.cwd()
ADMIN=BASE/'android-admin/app/src/main'
NS='{http://schemas.android.com/apk/res/android}'
with TemporaryDirectory(prefix='r50-app-link-') as temp:
    main=Path(temp)/'app/src/main'
    folder=main/'java/br/com/dafamilialanches/cliente'
    folder.mkdir(parents=True)
    java=(ADMIN/'java/br/com/dafamilialanches/admin/EntryActivity.java').read_text(encoding='utf8').replace('package br.com.dafamilialanches.admin;', 'package br.com.dafamilialanches.cliente;').replace('admin.dafamilialanches.com.br','dafamilialanches.com.br')
    (folder/'EntryActivity.java').write_text(java,encoding='utf8')
    original=(ADMIN/'AndroidManifest.xml').read_text(encoding='utf8')
    (main/'AndroidManifest.xml').write_text(original.replace('admin.dafamilialanches.com.br','dafamilialanches.com.br'),encoding='utf8')
    prepare_client_runtime(main)
    output=(folder/'EntryActivity.java').read_text(encoding='utf8')
    root=ET.parse(main/'AndroidManifest.xml').getroot()
    app=root.find('application')
    assert app is not None
    acts={a.attrib.get(NS+'name'):a for a in app.findall('activity')}
    entry,safe=acts['.EntryActivity'],acts['.SafeLauncherActivity']
    isview=lambda f:any(x.attrib.get(NS+'name')=='android.intent.action.VIEW' for x in f.findall('action'))
    entrylinks=[f for f in entry.findall('intent-filter') if isview(f)]
    safelinks=[f for f in safe.findall('intent-filter') if isview(f)]
    assert entry.attrib.get(NS+'exported')=='true'
    assert safe.attrib.get(NS+'exported')=='false'
    assert len(entrylinks)==1 and entrylinks[0].attrib.get(NS+'autoVerify')=='true'
    assert len(safelinks)==0, 'SafeLauncher nao pode disputar link do WhatsApp'
    assert len(entrylinks[0].findall('data'))==1
    assert entrylinks[0].findall('data')[0].attrib.get(NS+'scheme')=='https'
    assert entrylinks[0].findall('data')[0].attrib.get(NS+'host')=='dafamilialanches.com.br'
    assert 'openProtectedTrackingLink()' in output
    assert 'tab.launchUrl(this, incoming)' in output
    assert 'openClienteInBrowser(this, incoming)' in output
    assert 'getIntent().getData()' in output
    assert 'target.setData(incomingUri);' in output
    assert 'POST_NOTIFICATIONS' not in (main/'AndroidManifest.xml').read_text(encoding='utf8')
    assert 'LAUNCHING_BROWSER' not in (main/'AndroidManifest.xml').read_text(encoding='utf8')
    assert 'LAUNCHING_BROWSER' in original
    assert 'POST_NOTIFICATIONS' in original
    assert not any(x.attrib.get(NS+'name')=='.EntryActivity' and x.attrib.get(NS+'exported')=='false' for x in app.findall('activity'))
    try:
        prepare_client_runtime(main)
    except ValueError:
        pass
    else:
        raise AssertionError('R50: gerador nao deve aceitar segunda aplicacao')
print('R50: 18 garantias de link exclusivo, fallback, privacidade e Admin intacto OK')
`;
const o = cp.spawnSync('python3',['-c',py],{encoding:'utf8',timeout:30000,env:{...process.env,PYTHONPATH:'scripts',PYTHONDONTWRITEBYTECODE:'1'}});
assert.equal(o.status,0, (o.stdout||'')+'\\n'+(o.stderr||''));
console.log(o.stdout.trim());
console.log('R50_GATE_OK | sem rede, sem pedidos, sem mensagens');
