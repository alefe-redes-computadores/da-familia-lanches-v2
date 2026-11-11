'use strict';
/** Offline contracts only. Gradle compilation and signed-APK checks run on GitHub Actions. */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
let checks = 0;
const rd = p => fs.readFileSync(p, 'utf8');
const ok = (value, name) => { assert.ok(value, 'R57 ' + name); console.log('OK:', name); checks++; };
const java = rd('android-admin/app/src/main/java/br/com/dafamilialanches/admin/UpdateActivity.java');
const manifest = rd('android-admin/app/src/main/AndroidManifest.xml');
const gradle = rd('android-admin/app/build.gradle');
const maker = rd('scripts/prepare-client-android.py');
const selector = require('./ci/select-android-builds.cjs');
const web = rd('src/components/updates/AndroidUpdatesCenter.tsx');
const css = rd('src/components/updates/AndroidUpdatesCenter.module.css');
const workflow = rd('.github/workflows/build-admin-android.yml');
const paths = rd('android-admin/app/src/main/res/xml/dfl_update_paths.xml');
const api = rd('src/app/api/updates/android/route.ts');
const policy = rd('src/lib/android-updates/policy.ts');
const legacy = rd('scripts/test-site-r56-updates.cjs');

ok(java.includes('private static final String FLAVOR = "admin"'), 'template nativo Admin distinto');
ok(java.includes('private static final String API_ORIGIN = "https://dafamilialanches.com.br"'), 'API first-party imutável');
ok(java.includes('"dflupdate".equals(getIntent().getData().getScheme())') && java.includes('"updates".equals(getIntent().getData().getHost())'), 'Intent só abre tela sem payload externo');
ok(!java.includes('getStringExtra(') && !java.includes('getQueryParameter('), 'não aceita URL, SHA ou versão do Intent');
ok(java.includes('getLongVersionCode()') && java.includes('release.build <= installedBuild'), 'versão real instalada e somente upgrades');
ok(java.includes('expectedUrl.equals(r.url)') && java.includes('expectedPage.equals(r.page)') && java.includes('r.packageId.equals(getPackageName())'), 'APK fixado ao pacote e GitHub oficiais');
ok(java.includes('"release-assets.githubusercontent.com"') && java.includes('MAX_REDIRECTS = 5') && java.includes('Redirecionamento sem HTTPS'), 'rede HTTPS com hosts e redirects limitados');
ok(java.includes('getFilesDir()') && java.includes('STORAGE_RESERVE') && !java.includes('WRITE_EXTERNAL_STORAGE'), 'arquivo privado e falta de espaço');
ok(java.includes('size(progress)') && java.includes('progressBar.setProgress') && java.includes('cancelDownload()'), 'download real com MB, porcentagem e cancelamento');
ok(java.includes('if (canceled.get()') && java.includes('partial.delete()') && java.includes('downloadedAndVerified = false'), 'cancelado não vira download concluído');
ok(java.includes('MessageDigest.getInstance("SHA-256")') && java.includes('verifyApkIdentity(output, release)') && java.includes('verifyApkIdentity(file, approved)'), 'SHA-256 revalidado antes de instalar');
ok(java.includes('getPackageArchiveInfo') && java.includes('getApkContentsSigners()') && java.includes('getPackageName().equals(candidate.packageName)'), 'identidade de pacote e assinatura, inclusive arquivos alterados');
ok(java.includes('OFFICIAL_CERT') && java.includes('getPackageInfo(getPackageName()') && java.includes('getPackageArchiveInfo'), 'certificado fixo igual ao da loja/CI');
ok(java.includes('getPackageManager().canRequestPackageInstalls()') && java.includes('Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES') && java.includes('permissionReturnPending = false'), 'permissão Android explícita e retomada controlada');
ok(java.includes('FileProvider.getUriForFile') && java.includes('Intent.FLAG_GRANT_READ_URI_PERMISSION') && java.includes('application/vnd.android.package-archive'), 'instalador Android oficial via FileProvider');
ok(java.includes('io.shutdownNow()') && java.includes('active.cancel(true)'), 'tarefas interrompidas no encerramento da Activity');
ok(paths.includes('files-path') && paths.includes('dfl-apk-updates/'), 'FileProvider concede apenas diretório privado de APKs');
ok(manifest.includes('android.permission.REQUEST_INSTALL_PACKAGES') && manifest.includes('.UpdateActivity') && manifest.includes('android:scheme="dflupdate"') && manifest.includes('${applicationId}.updates.fileprovider'), 'Manifest do Android atualizado sem exportar provider');
ok(manifest.includes('android:exported="false"\n            android:grantUriPermissions="true"'), 'provider não exportado');
ok(gradle.includes('"androidx.core:core:1.13.1"') && gradle.includes('versionCode Math.max(1, runNumber.toInteger())'), 'AndroidX e versionCode de Action intacto');
ok(maker.includes("updater=java.parent/'cliente/UpdateActivity.java'") && maker.includes('FLAVOR = "cliente"') && maker.includes('update_source.count(marker)!=1'), 'geração Cliente isola flavor e mantém assinatura');
ok(selector.scopeOf('android-admin/app/src/main/java/br/com/dafamilialanches/admin/UpdateActivity.java') === 'both', 'alteração da Activity reconstrói Cliente e Admin');
ok(selector.scopeOf('android-admin/app/src/main/AndroidManifest.xml') === 'both' && selector.scopeOf('android-admin/app/build.gradle') === 'both', 'mudança em permissões/pacote reconstrói os dois');
ok(workflow.match(/node scripts\/test-site-r57-native-updater\.cjs/g)?.length===2 && workflow.includes('release-admin-certified:') && workflow.includes('release-cliente-certified:'), 'CI protege builds e mantém Release OFF');
ok(api.includes('latestVerifiedRelease') && policy.includes('parseSuccessfulRun') && policy.includes('parseCertifiedRelease'), 'fonte certificada R56 preservada');
ok(legacy.includes('fs.existsSync(\'android-admin/app/src/main/java/br/com/dafamilialanches/admin/UpdateActivity.java\')') && legacy.includes('intent://updates#Intent'), 'gate R56 continua conferindo ponte real R57');
ok(web.includes('intent://updates#Intent;scheme=dflupdate;package=${release.packageId}') && web.includes('encodeURIComponent(release.pageUrl)') && web.includes('alternativa manual'), 'CTA da Web abre Activity e oferece fallback oficial');
ok(!web.includes('Ainda não há download nativo') && web.includes('A primeira instalação do R57 ainda é manual'), 'não promete update na versão anterior');
ok(css.includes('.nativeFallback:focus-visible'), 'fallback acessível');
const parsed = ts.transpileModule(web, { fileName: 'AndroidUpdatesCenter.tsx', compilerOptions: { jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true });
ok(!(parsed.diagnostics||[]).some(d=>d.category === ts.DiagnosticCategory.Error), 'TSX sem erros de parser');
const javaChecks=[
  ['release alterada', '!hex(hash.digest()).equals(release.sha256)'],
  ['tamanho divergente', 'received != release.bytes'],
  ['certificado inválido', '!digest(replacement[0]).equals(OFFICIAL_CERT)'],
  ['versão superior', 'nextVersion <= Math.max(installedBuild, currentVersion())'],
  ['permite cancelar', 'canceled.set(true)'],
  ['não instala silenciosamente', 'startActivity(intent)'],
];
for(const [label,code] of javaChecks)ok(java.includes(code),'contrato ' + label);
console.log(`R57 CONTRATOS NATIVOS: ${checks} verificações OK (sem build Gradle local)`);
