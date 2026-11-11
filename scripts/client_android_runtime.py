#!/usr/bin/env python3
"""R232: launch and isolation guards for DFL Cliente TWA (stdlib only).

The customer-facing application has no push registration, so it must NOT ask
for Android notification permission before letting a buyer browse the menu.
Admin app sources are never changed; only a generated android-cliente tree.
"""
from pathlib import Path
import json
import re
import xml.etree.ElementTree as ET

PACKAGE = 'br.com.dafamilialanches.cliente'
HOST = 'dafamilialanches.com.br'
ORIGIN = 'https://' + HOST
ANDROID_NS = '{http://schemas.android.com/apk/res/android}'

_PERM_FIELD = '''    private static final int
            REQUEST_NATIVE_NOTIFICATIONS =
            2901;

'''
_PERMISSION_METHOD = '''    private void launchTwaWithNativeNotificationPermission() {'''
# Existem DOIS pontos de chamada no Admin atual: onCreate e botao de retry
# da tela de diagnostico. Ambos devem abrir o Cliente diretamente.
_ONCREATE_CALL = '''        launchTwaWithNativeNotificationPermission();
    }

    private void launchTwaWithNativeNotificationPermission() {'''
_RETRY_CALL = '''                    clearDiagnostic(this);
                    launchTwaWithNativeNotificationPermission();'''

_AFTER_PERMISSION_METHOD = '''    static SharedPreferences prefs('''
_PERMISSION_MANIFEST = '''    <uses-permission
        android:name="android.permission.POST_NOTIFICATIONS" />

'''
_PERMISSION_ACTIVITY = '''        <activity
            android:name="com.google.androidbrowserhelper.trusted.NotificationPermissionRequestActivity"
            android:exported="false" />

'''


def _exactly_once(source: str, needle: str, where: str):
    if source.count(needle) != 1:
        raise ValueError('R232: ancora ausente ou duplicada em ' + where + ': ' + needle.strip()[:72])


def prepare_client_runtime(main: Path):
    """Called only on freshly copied android-cliente/app/src/main."""
    entry = main / 'java/br/com/dafamilialanches/cliente/EntryActivity.java'
    manifest = main / 'AndroidManifest.xml'
    code = entry.read_text(encoding='utf-8')
    xml = manifest.read_text(encoding='utf-8')
    if 'package ' + PACKAGE + ';' not in code or 'admin.dafamilialanches.com.br' in code:
        raise ValueError('R232: launcher cliente sem isolamento Java')
    _exactly_once(code, _PERM_FIELD, 'EntryActivity/constante')
    # Fail closed if upstream changes the two Android entry points.
    if code.count('launchTwaWithNativeNotificationPermission();') != 2:
        raise ValueError('R232-R2: numero inesperado de chamadas nativas no Cliente (esperadas 2: abertura e retry)')
    _exactly_once(code, _ONCREATE_CALL, 'EntryActivity/onCreate')
    _exactly_once(code, _RETRY_CALL, 'EntryActivity/retry diagnostico')
    _exactly_once(code, _PERMISSION_METHOD, 'EntryActivity/inicio permission gate')
    _exactly_once(code, _AFTER_PERMISSION_METHOD, 'EntryActivity/fim permission gate')
    start = code.index(_PERMISSION_METHOD)
    end = code.index(_AFTER_PERMISSION_METHOD, start)
    if 'onRequestPermissionsResult(' not in code[start:end]:
        raise ValueError('R232: bloco de permissao Java inesperado')
    # Primeiro troca SOMENTE os dois pontos de entrada reconhecidos.
    # Depois remove o metodo de permissao e seu callback. Nunca editar Admin.
    code = code.replace(_ONCREATE_CALL, _ONCREATE_CALL.replace(
        'launchTwaWithNativeNotificationPermission();', 'launchTwa();'), 1)
    code = code.replace(_RETRY_CALL, _RETRY_CALL.replace(
        'launchTwaWithNativeNotificationPermission();', 'launchTwa();'), 1)
    start = code.index(_PERMISSION_METHOD)
    end = code.index(_AFTER_PERMISSION_METHOD, start)
    code = code[:start] + code[end:]
    code = code.replace(_PERM_FIELD, '', 1)
    _exactly_once(xml, _PERMISSION_MANIFEST, 'AndroidManifest/POST_NOTIFICATIONS')
    _exactly_once(xml, _PERMISSION_ACTIVITY, 'AndroidManifest/NotificationPermissionRequestActivity')
    xml = xml.replace(_PERMISSION_MANIFEST, '', 1).replace(_PERMISSION_ACTIVITY, '', 1)

    # R48 Cliente-only: allow Android Browser Helper to choose any installed TWA
    # browser instead of forcing a named package. The current strict per-host
    # HTTPS VIEW filter and Entry -> SafeLauncher intent data/fragment stay intact.
    fixed = re.findall(
        r'\s*<meta-data\s+android:name="android\.support\.customtabs\.trusted\.LAUNCHING_BROWSER(?:_NAME)?"\s+android:value="[^"]+"\s*/>',
        xml,
    )
    if len(fixed) != 2:
        raise ValueError('R48: browser pin mismatch in customer-only manifest')
    for item in fixed:
        xml = xml.replace(item, '', 1)

    # R50_SINGLE_HANDLER: Android App Links must have exactly ONE receiving
    # Activity. SafeLauncher is internal and non-exported; keeping its duplicate
    # VIEW filter makes Android/WhatsApp resolution ambiguous. Preserve its
    # private role, all metadata, TWA splash and the public EntryActivity filter.
    # Never inspect, store or log the private #t= fragment here.
    ET.register_namespace('android', 'http://schemas.android.com/apk/res/android')
    root = ET.fromstring(xml)
    app = root.find('application')
    if app is None:
        raise ValueError('R50: application ausente no manifesto Cliente')
    aa = {x.attrib.get(ANDROID_NS+'name'): x for x in app.findall('activity')}
    entry_activity = aa.get('.EntryActivity')
    safe = aa.get('.SafeLauncherActivity')
    if entry_activity is None or safe is None or entry_activity.attrib.get(ANDROID_NS+'exported') != 'true' or safe.attrib.get(ANDROID_NS+'exported') != 'false':
        raise ValueError('R50: fronteiras Entry/SafeLauncher divergiram')
    is_view = lambda f: any(x.attrib.get(ANDROID_NS+'name') == 'android.intent.action.VIEW' for x in f.findall('action'))
    incoming = [f for f in entry_activity.findall('intent-filter') if is_view(f)]
    shadow = [f for f in safe.findall('intent-filter') if is_view(f)]
    if len(incoming) != 1 or len(shadow) != 1 or incoming[0].attrib.get(ANDROID_NS+'autoVerify') != 'true':
        raise ValueError('R50: filtros externos divergentes; nenhuma alteracao aplicada')
    for flt in (incoming[0], shadow[0]):
        datas = flt.findall('data')
        if not datas or any(d.attrib.get(ANDROID_NS+'scheme') != 'https' or d.attrib.get(ANDROID_NS+'host') != HOST for d in datas):
            raise ValueError('R50: dominio/HTTPS inesperado')
    safe.remove(shadow[0])
    if any(is_view(f) for f in safe.findall('intent-filter')):
        raise ValueError('R50: SafeLauncher ainda expoe links')
    ET.indent(root, space='    ')
    xml = '<?xml version="1.0" encoding="utf-8"?>\n' + ET.tostring(root, encoding='unicode')
    if any(value not in code for value in (
        'getIntent().getData()', 'target.setAction(Intent.ACTION_VIEW);',
        'target.setData(incomingUri);', 'startActivity(target);',
    )):
        raise ValueError('R48: original deep-link URI forwarding changed')

    # R49_PROTECTED_LINK: avoid the Android TWA re-dispatch path for a private
    # incoming HTTPS /acompanhar URL. Open it in a browser-owned Custom Tab
    # (app-hosted experience), then a browser-only fallback. Never log/copy
    # fragments, grant data to another app, or modify the Admin template.
    launch_point = '        launchTwa();\n    }\n'
    if code.count(launch_point) != 1:
        raise ValueError('R49: ponto onCreate inesperado')
    code = code.replace(launch_point,
        '        if (openProtectedTrackingLink()) {\n'
        '            return;\n'
        '        }\n\n' + launch_point, 1)

    method_point = '    static SharedPreferences prefs(\n'
    if code.count(method_point) != 1:
        raise ValueError('R49: ponto helper inesperado')
    tracking_method = r'''    /** R49: only the protected, same-origin public tracking entry is diverted.
     * This avoids TWA browser provider ambiguity when launched from WhatsApp.
     * The opaque fragment is forwarded unchanged and never logged or persisted.
     */
    private boolean openProtectedTrackingLink() {
        Intent intent = getIntent();
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction())) return false;
        Uri incoming = intent.getData();
        if (incoming == null ||
                !"https".equalsIgnoreCase(incoming.getScheme()) ||
                !"dafamilialanches.com.br".equalsIgnoreCase(incoming.getHost()) ||
                incoming.getPort() != -1 || incoming.getUserInfo() != null ||
                !("/acompanhar".equals(incoming.getPath()) ||
                  "/acompanhar/".equals(incoming.getPath()))) return false;
        // Avoid another Android App Links resolution loop: explicitly select
        // a real browser package for each attempt, not our own app.
        for (String browserPackage : SAFE_BROWSER_PACKAGES) {
            try {
                androidx.browser.customtabs.CustomTabsIntent tab =
                    new androidx.browser.customtabs.CustomTabsIntent.Builder()
                        .setShowTitle(true).build();
                tab.intent.setPackage(browserPackage);
                tab.launchUrl(this, incoming);
                finish();
                return true;
            } catch (ActivityNotFoundException | SecurityException |
                     IllegalArgumentException unavailable) {
                // Browser missing or without Custom Tabs: try the next.
            }
        }
        if (openClienteInBrowser(this, incoming)) {
            finish();
            return true;
        }
        Toast.makeText(this, "Não foi possível abrir o acompanhamento. Verifique o navegador.",
                       Toast.LENGTH_LONG).show();
        // Fail closed: do not silently show a different order/cardápio.
        return true;
    }

'''
    code = code.replace(method_point, tracking_method + method_point, 1)

    if any(x in code for x in ('REQUEST_NATIVE_NOTIFICATIONS', 'requestPermissions(', 'onRequestPermissionsResult(', 'launchTwaWithNativeNotificationPermission')):
        raise ValueError('R232: sobrou um gate de permissoes no Cliente')
    if 'android.permission.POST_NOTIFICATIONS' in xml or 'NotificationPermissionRequestActivity' in xml:
        raise ValueError('R232: sobrou permissao push no manifesto Cliente')
    # Verify syntax of XML before touching generated files.
    ET.fromstring(xml)
    entry.write_text(code, encoding='utf-8')
    manifest.write_text(xml, encoding='utf-8')
    print('R232: abertura imediata do Cliente sem alerta de notificacao desnecessario')


def validate_client_runtime(root: Path):
    """Independent CI-only check; no Android/Gradle/network and no order writes."""
    main = root / 'android-cliente/app/src/main'
    entries = []
    def check(condition, label):
        if not condition:
            raise ValueError('R232 APK CLIENTE REPROVADO: ' + label)
        entries.append(label)

    manifest = ET.parse(main / 'AndroidManifest.xml').getroot()
    app = manifest.find('application')
    check(app is not None, 'application Android declarada')
    permissions = [e.attrib.get(ANDROID_NS+'name') for e in manifest.findall('uses-permission')]
    check('android.permission.INTERNET' in permissions, 'internet cliente preservada')
    check('android.permission.POST_NOTIFICATIONS' not in permissions, 'sem permissao push antes do cardapio')
    components = app.findall('activity')
    names = [a.attrib.get(ANDROID_NS+'name') for a in components]
    check('com.google.androidbrowserhelper.trusted.NotificationPermissionRequestActivity' not in names, 'activity de prompt desabilitada')
    check('.EntryActivity' in names and '.SafeLauncherActivity' in names, 'launchers TWA preservados')
    entry_activity = next(a for a in components if a.attrib.get(ANDROID_NS+'name') == '.EntryActivity')
    safe_activity = next(a for a in components if a.attrib.get(ANDROID_NS+'name') == '.SafeLauncherActivity')
    check(entry_activity.attrib.get(ANDROID_NS+'exported') == 'true' and safe_activity.attrib.get(ANDROID_NS+'exported') == 'false', 'exportacao segura de activities')
    check(any(a.attrib.get(ANDROID_NS+'name') == '.DelegationService' for a in app.findall('service')), 'delegacao TWA original preservada')
    # R50_SINGLE_HANDLER: public Entry exclusively owns verified incoming links.
    is_view = lambda f: any(a.attrib.get(ANDROID_NS+'name') == 'android.intent.action.VIEW' for a in f.findall('action'))
    entry_links = [f for f in entry_activity.findall('intent-filter') if is_view(f)]
    safe_links = [f for f in safe_activity.findall('intent-filter') if is_view(f)]
    check(len(entry_links) == 1 and entry_links[0].attrib.get(ANDROID_NS+'autoVerify') == 'true', 'R50: um App Link verificado pertence somente a EntryActivity')
    datas = [d for f in entry_links for d in f.findall('data')]
    check(bool(datas) and all(d.attrib.get(ANDROID_NS+'scheme') == 'https' and d.attrib.get(ANDROID_NS+'host') == HOST for d in datas), 'deep links HTTPS apenas na origem Cliente')
    check(len(safe_links) == 0 and safe_activity.attrib.get(ANDROID_NS+'exported') == 'false', 'R50: SafeLauncher interna nao recebe links externos')
    check(any(cat.attrib.get(ANDROID_NS+'name') == 'android.intent.category.LAUNCHER' for f in entry_activity.findall('intent-filter') for cat in f.findall('category')), 'app possui launcher principal')
    code = (main / 'java/br/com/dafamilialanches/cliente/EntryActivity.java').read_text(encoding='utf-8')
    safe = (main / 'java/br/com/dafamilialanches/cliente/SafeLauncherActivity.java').read_text(encoding='utf-8')
    check('package '+PACKAGE+';' in code and 'package '+PACKAGE+';' in safe, 'package Java Cliente exclusivo')
    check('launchTwa();' in code and 'launchTwaWithNativeNotificationPermission' not in code and 'requestPermissions(' not in code, 'TWA inicia sem prompt de push')
    check('clearDiagnostic(this);\n                    launchTwa();' in code and 'retry.setOnClickListener(' in code, 'retry nativo reabre Cliente sem solicitar notificacoes')
    check(ORIGIN+'/' in code and 'admin.dafamilialanches.com.br' not in code and 'admin.dafamilialanches.com.br' not in safe, 'launcher nao redireciona para Admin')
    check('openClienteInBrowser(' in safe and 'openClienteInBrowser(' in code, 'fallback de navegador cliente preservado')
    check('LAUNCHING_BROWSER' not in (main / 'AndroidManifest.xml').read_text(encoding='utf-8'), 'R48: TWA provider dinamico, sem exigir Chrome fixo')
    check('getIntent().getData()' in code and 'target.setData(incomingUri);' in code, 'R48: link HTTPS e fragmento recebidos intactos no TWA')
    strings = ET.parse(main / 'res/values/strings.xml').getroot()
    strs = {x.attrib['name']: x.text or '' for x in strings.findall('string')}
    check(strs.get('app_name') == 'Da Família Lanches', 'nome correto do Cliente')
    check(strs.get('launch_url') == ORIGIN+'/', 'origem HTTPS correta')
    check(ORIGIN in strs.get('asset_statements','') and 'admin.dafamilialanches.com.br' not in strs.get('asset_statements',''), 'TWA asset statements somente origem Cliente')
    gradle = (root / 'android-cliente/app/build.gradle').read_text(encoding='utf-8')
    check('applicationId "'+PACKAGE+'"' in gradle and 'namespace "'+PACKAGE+'"' in gradle, 'package do APK nao conflita com Admin')
    check('DFL_ADMIN_KEYSTORE_PATH' in gradle, 'assinatura Android estavel preservada')
    check((main/'res/drawable-nodpi/ic_launcher_foreground.png').is_file(), 'icone adaptativo oficial presente')
    check((main/'res/mipmap-xxxhdpi/ic_launcher_round.png').is_file(), 'icone redondo oficial presente')
    assetlinks = (root / 'src/app/.well-known/assetlinks.json/route.ts').read_text(encoding='utf-8')
    check(PACKAGE in assetlinks and 'br.com.dafamilialanches.admin' in assetlinks, 'Digital Asset Links cobre Cliente e Admin')
    check('77:F6:88:B5:32:06:0E:41:35:C2:9F:4E:24:22:4A:6C:34:C0:F1:74:DB:D2:65:E4:BD:27:50:6D:88:17:55:63' in assetlinks, 'certificado oficial preservado')
    print('R232 APK CLIENTE: '+str(len(entries))+' validacoes de abertura, permissao, dominio, assinatura e identidade OK; sem pedidos comerciais')


if __name__ == '__main__':
    validate_client_runtime(Path(__file__).resolve().parents[1])
