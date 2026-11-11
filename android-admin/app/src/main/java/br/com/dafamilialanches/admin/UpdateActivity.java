package br.com.dafamilialanches.admin;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.StatFs;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;

import androidx.core.content.FileProvider;

import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * R57: atualizador do contêiner TWA. Não aceita URL, versão, pacote ou SHA vindos do Intent.
 * O único manifesto é a API HTTPS first-party, que certifica GitHub Release+Action.
 * O Android continua sendo a autoridade final sobre a confirmação da instalação.
 */
public final class UpdateActivity extends Activity {
    // O gerador Cliente troca somente o valor deste marcador, com comparação exata.
    private static final String FLAVOR = "admin";
    private static final String API_ORIGIN = "https://dafamilialanches.com.br";
    private static final String REPO = "alefe-redes-computadores/da-familia-lanches-v2";
    private static final String OFFICIAL_CERT = "77F688B532060E4135C29F4E24224A6C34C0F174DBD265E4BD27506D88175563";
    private static final long MAX_APK = 150L * 1024L * 1024L;
    private static final long MIN_APK = 64L * 1024L;
    private static final long STORAGE_RESERVE = 24L * 1024L * 1024L;
    private static final int BUFFER_SIZE = 65536;
    private static final int MAX_REDIRECTS = 5;

    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final AtomicBoolean canceled = new AtomicBoolean(false);
    private volatile HttpURLConnection activeConnection;
    private volatile InputStream activeInput;
    private volatile Future<?> downloadJob;
    private volatile boolean busy;
    private volatile boolean downloadedAndVerified;
    private volatile boolean permissionReturnPending;
    private volatile long lastProgressUi;

    private Release release;
    private File verifiedFile;
    private long installedBuild = -1;
    private TextView title, status, detail, progressText;
    private ProgressBar progressBar;
    private Button checkButton, downloadButton, cancelButton, installButton, manualButton;

    private static final class Release {
        long build, bytes;
        String packageId, sha256, url, page;
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        if (getIntent() == null || !Intent.ACTION_VIEW.equals(getIntent().getAction()) ||
                getIntent().getData() == null ||
                !"dflupdate".equals(getIntent().getData().getScheme()) ||
                !"updates".equals(getIntent().getData().getHost())) {
            finish();
            return;
        }
        // Nunca carregar parâmetros do Intent. Até um aplicativo malicioso que abrir
        // esta Activity só poderá consultar o manifesto oficial do seu próprio pacote.
        getWindow().setStatusBarColor(Color.rgb(10, 13, 17));
        getWindow().setNavigationBarColor(Color.rgb(10, 13, 17));
        installedBuild = currentVersion();
        createUi();
        checkRelease();
    }

    private int dp(int n) { return Math.round(n * getResources().getDisplayMetrics().density); }

    private TextView text(String s, int sp, int color) {
        TextView v = new TextView(this);
        v.setText(s);
        v.setTextSize(sp);
        v.setTextColor(color);
        v.setPadding(0, dp(5), 0, dp(5));
        return v;
    }

    private Button button(String s, LinearLayout root) {
        Button b = new Button(this);
        b.setAllCaps(false);
        b.setText(s);
        b.setTextSize(14);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, dp(52));
        lp.topMargin = dp(7);
        root.addView(b, lp);
        return b;
    }

    private void createUi() {
        boolean admin = "admin".equals(FLAVOR);
        int accent = Color.rgb(255, 201, 40);
        int ink = Color.rgb(242, 245, 247);
        int muted = Color.rgb(171, 183, 194);
        LinearLayout body = new LinearLayout(this);
        body.setOrientation(LinearLayout.VERTICAL);
        body.setPadding(dp(20), dp(22), dp(20), dp(32));
        body.setBackgroundColor(admin ? Color.rgb(9, 13, 17) : Color.rgb(17, 15, 13));
        ScrollView scroller = new ScrollView(this);
        scroller.setFillViewport(true);
        scroller.addView(body);
        setContentView(scroller);
        title = text(admin ? "Atualizações · DFL Admin" : "Atualizações · Da Família Lanches", 23, accent);
        title.setGravity(Gravity.START);
        body.addView(title);
        body.addView(text("APK Android · verificação segura", 14, ink));
        status = text("Verificando…", 16, ink);
        body.addView(status);
        detail = text("A página web do Site é atualizada separadamente. O APK só muda quando há uma Release Android certificada.", 13, muted);
        body.addView(detail);
        progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setMax(100);
        progressBar.setProgress(0);
        LinearLayout.LayoutParams progressParams = new LinearLayout.LayoutParams(-1, dp(11));
        progressParams.topMargin = dp(19);
        body.addView(progressBar, progressParams);
        progressText = text("", 13, ink);
        body.addView(progressText);
        checkButton = button("Verificar novamente", body);
        downloadButton = button("Baixar atualização", body);
        cancelButton = button("Cancelar download", body);
        installButton = button("Instalar APK verificado", body);
        manualButton = button("Abrir versão oficial no GitHub", body);
        checkButton.setOnClickListener(v -> checkRelease());
        downloadButton.setOnClickListener(v -> startDownload());
        cancelButton.setOnClickListener(v -> cancelDownload());
        installButton.setOnClickListener(v -> installVerified());
        manualButton.setOnClickListener(v -> openOfficialPage());
        updateButtons();
    }

    private void ui(String message, String details) {
        runOnUiThread(() -> {
            if (isFinishing() || isDestroyed()) return;
            status.setText(message);
            detail.setText(details);
            updateButtons();
        });
    }

    private void updateButtons() {
        boolean update = installedBuild > 0 && release != null && release.build > installedBuild;
        checkButton.setEnabled(!busy);
        downloadButton.setVisibility(update && !downloadedAndVerified ? View.VISIBLE : View.GONE);
        downloadButton.setEnabled(!busy);
        cancelButton.setVisibility(busy && downloadJob != null ? View.VISIBLE : View.GONE);
        cancelButton.setEnabled(!canceled.get());
        installButton.setVisibility(update && downloadedAndVerified ? View.VISIBLE : View.GONE);
        installButton.setEnabled(!busy);
        manualButton.setVisibility(release != null ? View.VISIBLE : View.GONE);
    }

    private long currentVersion() {
        try {
            PackageInfo info = getPackageManager().getPackageInfo(getPackageName(), 0);
            if (Build.VERSION.SDK_INT >= 28) return info.getLongVersionCode();
            return info.versionCode;
        } catch (Exception ignored) { return -1; }
    }

    private String expectedTag() {
        return "admin".equals(FLAVOR) ? "dfl-admin-android-" : "dfl-cliente-android-";
    }

    private String expectedAsset() {
        return "admin".equals(FLAVOR) ? "DFL-Admin-" : "DFL-Cliente-";
    }

    private static String requestJson(URL url) throws Exception {
        if (!"https".equalsIgnoreCase(url.getProtocol()) || !"dafamilialanches.com.br".equalsIgnoreCase(url.getHost())) throw new SecurityException("Servidor inválido");
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setConnectTimeout(10000);
        conn.setReadTimeout(15000);
        conn.setRequestProperty("Accept", "application/json");
        conn.setInstanceFollowRedirects(false);
        try {
            if (conn.getResponseCode() != 200) throw new Exception("Consulta indisponível");
            if (conn.getContentLengthLong() > 65536) throw new SecurityException("Resposta excessiva");
            try (InputStream stream = conn.getInputStream()) {
                byte[] bytes = new byte[65537];
                int n, used = 0;
                while ((n = stream.read(bytes, used, bytes.length - used)) > 0) {
                    used += n;
                    if (used >= bytes.length) throw new SecurityException("Resposta excessiva");
                }
                return new String(bytes, 0, used, java.nio.charset.StandardCharsets.UTF_8);
            }
        } finally { conn.disconnect(); }
    }

    private Release certifiedRelease() throws Exception {
        URL endpoint = new URL(API_ORIGIN + "/api/updates/android?app=" + FLAVOR);
        JSONObject json = new JSONObject(requestJson(endpoint));
        if (!json.optBoolean("ok", false) || !FLAVOR.equals(json.optString("app"))) throw new Exception("Servidor não confirmou a versão");
        if (!json.optBoolean("available", false) || json.isNull("release")) return null;
        JSONObject item = json.optJSONObject("release");
        if (item == null) throw new SecurityException("Release ausente");
        Release r = new Release();
        r.build = item.optLong("build", -1);
        r.bytes = item.optLong("bytes", -1);
        r.packageId = item.optString("packageId", "");
        r.sha256 = item.optString("sha256", "").toLowerCase(Locale.ROOT);
        r.url = item.optString("downloadUrl", "");
        r.page = item.optString("pageUrl", "");
        if (r.build < 1 || r.build > 999999999L || r.bytes < MIN_APK || r.bytes > MAX_APK ||
                !r.packageId.equals(getPackageName()) ||
                !r.sha256.matches("^[a-f0-9]{64}$") || !FLAVOR.equals(item.optString("app", ""))) {
            throw new SecurityException("Identidade da atualização não confirmada");
        }
        String expectedUrl = "https://github.com/" + REPO + "/releases/download/" + expectedTag() + r.build + "/" + expectedAsset() + r.build + ".apk";
        String expectedPage = "https://github.com/" + REPO + "/releases/tag/" + expectedTag() + r.build;
        if (!expectedUrl.equals(r.url) || !expectedPage.equals(r.page)) throw new SecurityException("Origem de atualização divergente");
        return r;
    }

    private void checkRelease() {
        if (busy) return;
        busy = true;
        canceled.set(false);
        downloadedAndVerified = false;
        release = null;
        verifiedFile = null;
        downloadJob = null;
        progressBar.setProgress(0);
        progressText.setText("");
        ui("Verificando versão certificada…", "Aguardando GitHub Release e Action Android do mesmo commit.");
        io.execute(() -> {
            try {
                Release received = certifiedRelease();
                runOnUiThread(() -> {
                    release = received;
                    busy = false;
                    if (received == null) {
                        ui("Nenhum APK certificado disponível", "Versão instalada: " + installedBuild + ". Sem Release verificada, não oferecemos instalação.");
                    } else if (installedBuild < 1) {
                        ui("Versão instalada indisponível", "Não é seguro comparar builds. Reinstale manualmente o APK oficial se necessário.");
                    } else if (received.build <= installedBuild) {
                        ui("Seu aplicativo está atualizado", "Versão instalada: " + installedBuild + " · Última Release: " + received.build);
                    } else {
                        ui("Atualização disponível · " + received.build, "Versão instalada: " + installedBuild + " · APK de " + size(received.bytes) + ". Confirme o download para começar.");
                    }
                });
            } catch (Exception e) {
                runOnUiThread(() -> {
                    busy = false;
                    release = null;
                    ui("Não foi possível verificar a versão", "Nenhum download foi autorizado. Verifique internet ou tente novamente.");
                });
            }
        });
    }

    private static String size(long bytes) {
        return String.format(Locale.forLanguageTag("pt-BR"), "%.1f MB", bytes / 1048576.0);
    }

    private File expectedFile() {
        File dir = new File(getFilesDir(), "dfl-apk-updates");
        if (!dir.isDirectory() && !dir.mkdirs()) throw new IllegalStateException("Sem espaço para a pasta de atualizações");
        return new File(dir, expectedAsset() + release.build + ".apk");
    }

    private void startDownload() {
        if (busy || installedBuild < 1 || release == null || release.build <= installedBuild) return;
        StatFs storage = new StatFs(getFilesDir().getAbsolutePath());
        if (storage.getAvailableBytes() < release.bytes + STORAGE_RESERVE) {
            ui("Espaço insuficiente", "Libere pelo menos " + size(release.bytes + STORAGE_RESERVE) + " antes de baixar.");
            return;
        }
        canceled.set(false);
        downloadedAndVerified = false;
        verifiedFile = null;
        busy = true;
        lastProgressUi = 0;
        progressBar.setProgress(0);
        progressText.setText("Iniciando download…");
        updateButtons();
        downloadJob = io.submit(() -> {
            File partial = null;
            try {
                File output = expectedFile();
                partial = new File(output.getParentFile(), output.getName() + ".part");
                if (partial.exists() && !partial.delete()) throw new Exception("Não foi possível limpar download anterior");
                MessageDigest hash = MessageDigest.getInstance("SHA-256");
                long received = 0;
                try (InputStream input = openOfficialDownload(release.url);
                     BufferedOutputStream dst = new BufferedOutputStream(new FileOutputStream(partial))) {
                    activeInput = input;
                    byte[] chunk = new byte[BUFFER_SIZE];
                    int n;
                    while ((n = input.read(chunk)) != -1) {
                        if (canceled.get() || Thread.currentThread().isInterrupted()) throw new InterruptedException("Cancelado");
                        received += n;
                        if (received > release.bytes) throw new SecurityException("Arquivo maior que o APK certificado");
                        dst.write(chunk, 0, n);
                        hash.update(chunk, 0, n);
                        final long progress = received;
                        long now = System.currentTimeMillis();
                        if (now - lastProgressUi > 150 || received == release.bytes) {
                            lastProgressUi = now;
                            runOnUiThread(() -> {
                                if (!canceled.get()) {
                                    progressBar.setProgress((int) (progress * 100 / release.bytes));
                                    progressText.setText(size(progress) + " / " + size(release.bytes) + " · " + (progress * 100 / release.bytes) + "%");
                                }
                            });
                        }
                    }
                    dst.flush();
                } finally { activeInput = null; closeActiveConnection(); }
                if (canceled.get() || Thread.currentThread().isInterrupted()) throw new InterruptedException("Cancelado");
                if (received != release.bytes) throw new SecurityException("Tamanho divergente");
                if (!hex(hash.digest()).equals(release.sha256)) throw new SecurityException("SHA-256 divergente");
                if (output.exists() && !output.delete()) throw new Exception("Não foi possível limpar APK anterior");
                if (!partial.renameTo(output)) throw new Exception("Não foi possível concluir arquivo");
                if (!verifyApkIdentity(output, release)) { output.delete(); throw new SecurityException("Pacote, versão ou certificado inválido"); }
                if (canceled.get()) { output.delete(); throw new InterruptedException("Cancelado"); }
                verifiedFile = output;
                downloadedAndVerified = true;
                runOnUiThread(() -> {
                    busy = false;
                    downloadJob = null;
                    progressBar.setProgress(100);
                    ui("APK verificado e pronto para instalar", "SHA-256, identidade, versão e certificado conferidos. O Android pedirá sua confirmação.");
                });
            } catch (Exception error) {
                if (partial != null) partial.delete();
                runOnUiThread(() -> {
                    boolean userCanceled = canceled.get();
                    downloadedAndVerified = false;
                    verifiedFile = null;
                    busy = false;
                    downloadJob = null;
                    progressBar.setProgress(0);
                    ui(userCanceled ? "Download cancelado" : "Download interrompido", userCanceled ? "Nenhum APK foi instalado. Você pode tentar novamente." : "Nenhum arquivo foi autorizado para instalação. Verifique internet, espaço e tente novamente.");
                });
            } finally { closeActiveConnection(); }
        });
        updateButtons();
    }

    private InputStream openOfficialDownload(String uri) throws Exception {
        URL target = new URL(uri);
        for (int redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
            if (!"https".equalsIgnoreCase(target.getProtocol())) throw new SecurityException("Redirecionamento sem HTTPS");
            String host = target.getHost().toLowerCase(Locale.ROOT);
            if (!host.equals("github.com") && !host.equals("release-assets.githubusercontent.com") &&
                    !host.equals("objects.githubusercontent.com") && !host.equals("github-releases.githubusercontent.com")) {
                throw new SecurityException("Destino de download não autorizado");
            }
            HttpURLConnection conn = (HttpURLConnection) target.openConnection();
            conn.setInstanceFollowRedirects(false);
            conn.setConnectTimeout(12000);
            conn.setReadTimeout(15000);
            conn.setRequestProperty("Accept", "application/octet-stream");
            activeConnection = conn;
            int code = conn.getResponseCode();
            if (code == 301 || code == 302 || code == 303 || code == 307 || code == 308) {
                String location = conn.getHeaderField("Location");
                conn.disconnect();
                activeConnection = null;
                if (location == null || location.length() > 8192) throw new SecurityException("Redirecionamento inválido");
                target = new URL(target, location);
                continue;
            }
            if (code != 200) { conn.disconnect(); activeConnection = null; throw new Exception("Falha HTTP " + code); }
            return new BufferedInputStream(conn.getInputStream(), BUFFER_SIZE);
        }
        throw new SecurityException("Redirecionamentos excessivos");
    }

    private void cancelDownload() {
        if (!busy || downloadJob == null) return;
        canceled.set(true);
        // O job permanece executável para limpar .part até se a rede ainda não conectou.
        // A conexão HTTPS é interrompida e o loop observa o sinal de cancelamento.
        closeActiveConnection();
        ui("Cancelando download…", "Aguardando encerramento seguro da transferência.");
    }

    private void closeActiveConnection() {
        HttpURLConnection c = activeConnection;
        activeConnection = null;
        if (c != null) c.disconnect();
    }

    private static String hex(byte[] bytes) {
        StringBuilder out = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) out.append(String.format(Locale.ROOT, "%02x", b & 255));
        return out.toString();
    }

    private static String digest(Signature cert) throws Exception {
        return hex(MessageDigest.getInstance("SHA-256").digest(cert.toByteArray())).toUpperCase(Locale.ROOT);
    }

    private boolean verifyApkIdentity(File file, Release expected) {
        try {
            if (!file.isFile() || file.length() != expected.bytes) return false;
            MessageDigest hash = MessageDigest.getInstance("SHA-256");
            try (FileInputStream stream = new FileInputStream(file)) {
                byte[] bytes = new byte[BUFFER_SIZE];
                int n;
                while ((n = stream.read(bytes)) > 0) hash.update(bytes, 0, n);
            }
            if (!hex(hash.digest()).equals(expected.sha256)) return false;
            PackageManager pm = getPackageManager();
            int flags = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
            PackageInfo candidate = pm.getPackageArchiveInfo(file.getAbsolutePath(), flags);
            PackageInfo current = pm.getPackageInfo(getPackageName(), flags);
            if (candidate == null || current == null || !getPackageName().equals(candidate.packageName)) return false;
            long nextVersion = Build.VERSION.SDK_INT >= 28 ? candidate.getLongVersionCode() : candidate.versionCode;
            if (nextVersion != expected.build || nextVersion <= Math.max(installedBuild, currentVersion())) return false;
            Signature[] installed, replacement;
            if (Build.VERSION.SDK_INT >= 28) {
                if (current.signingInfo == null || candidate.signingInfo == null) return false;
                installed = current.signingInfo.getApkContentsSigners();
                replacement = candidate.signingInfo.getApkContentsSigners();
            } else {
                installed = current.signatures;
                replacement = candidate.signatures;
            }
            if (installed == null || replacement == null || installed.length != 1 || replacement.length != 1) return false;
            if (!digest(installed[0]).equals(OFFICIAL_CERT) || !digest(replacement[0]).equals(OFFICIAL_CERT)) return false;
            return Arrays.equals(installed[0].toByteArray(), replacement[0].toByteArray());
        } catch (Exception ignored) { return false; }
    }

    private void installVerified() {
        if (busy || !downloadedAndVerified || verifiedFile == null || release == null) return;
        if (Build.VERSION.SDK_INT >= 26 && !getPackageManager().canRequestPackageInstalls()) {
            permissionReturnPending = true;
            ui("Autorização do Android necessária", "Autorize a instalação para este aplicativo. Ao retornar, revalidaremos o APK antes de abrir o instalador.");
            try {
                Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + getPackageName()));
                startActivity(settings);
            } catch (ActivityNotFoundException ex) {
                permissionReturnPending = false;
                ui("Permissão indisponível", "Autorize a instalação nas configurações do aparelho; não tentaremos contornar o bloqueio.");
            }
            return;
        }
        // Nunca fazer SHA de dezenas de MB na thread principal do Android.
        busy = true;
        updateButtons();
        ui("Revalidando APK e assinatura…", "A instalação só abrirá após nova conferência.");
        final File file = verifiedFile;
        final Release approved = release;
        io.execute(() -> {
            boolean valid = verifyApkIdentity(file, approved);
            runOnUiThread(() -> {
                busy = false;
                if (isFinishing() || isDestroyed()) return;
                if (!valid) {
                    downloadedAndVerified = false;
                    verifiedFile = null;
                    ui("Verificação expirada", "APK alterado ou identidade inválida. Baixe novamente.");
                } else {
                    openAndroidInstaller();
                }
            });
        });
    }

    @Override protected void onResume() {
        super.onResume();
        if (!permissionReturnPending) return;
        permissionReturnPending = false;
        if (Build.VERSION.SDK_INT >= 26 && !getPackageManager().canRequestPackageInstalls()) {
            ui("Instalação ainda não autorizada", "A permissão continua bloqueada; você pode tentar novamente ou usar a página oficial.");
            return;
        }
        // Revalidar o arquivo no retorno real das Configurações antes da instalação.
        if (downloadedAndVerified && release != null && verifiedFile != null) installVerified();
    }

    private void openAndroidInstaller() {
        try {
            Uri content = FileProvider.getUriForFile(this, getPackageName() + ".updates.fileprovider", verifiedFile);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(content, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
            ui("Instalador oficial aberto", "Confirme ou cancele na tela do Android. Nunca instalamos silenciosamente.");
        } catch (Exception e) {
            ui("Não foi possível abrir o instalador", "O APK continua verificado. Confira as permissões ou utilize a alternativa oficial.");
        }
    }

    private void openOfficialPage() {
        if (release == null) return;
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(release.page)));
        } catch (Exception e) {
            ui("Navegador indisponível", "Não foi possível abrir a página oficial do GitHub neste aparelho.");
        }
    }

    @Override protected void onDestroy() {
        canceled.set(true);
        Future<?> active = downloadJob;
        if (active != null) active.cancel(true);
        closeActiveConnection();
        io.shutdownNow();
        super.onDestroy();
    }
}
