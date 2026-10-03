package br.com.dafamilialanches.admin;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

public class EntryActivity extends Activity {

    static final String PREFS =
            "dfl_admin_native_diagnostics";

    static final String KEY_CRASH =
            "last_crash";

    static final String KEY_VERSION =
            "last_crash_version";

    static final String KEY_TIME =
            "last_crash_time";

    static final String EXTRA_FORCE_DIAGNOSTIC =
            "dfl_force_diagnostic";

    static final Uri ADMIN_URI =
            Uri.parse(
                    "https://admin.dafamilialanches.com.br/"
            );

    private static final String[] SAFE_BROWSER_PACKAGES = {
            "com.android.chrome",
            "com.sec.android.app.sbrowser",
            "com.brave.browser",
            "org.mozilla.firefox",
            "com.microsoft.emmx",
            "com.opera.browser"
    };

    @Override
    protected void onCreate(
            Bundle savedInstanceState
    ) {
        super.onCreate(savedInstanceState);

        getWindow().setStatusBarColor(
                Color.rgb(9, 9, 11)
        );

        getWindow().setNavigationBarColor(
                Color.rgb(9, 9, 11)
        );

        boolean forced =
                getIntent().getBooleanExtra(
                        EXTRA_FORCE_DIAGNOSTIC,
                        false
                );

        if (
                forced ||
                hasCurrentDiagnostic()
        ) {
            showDiagnostic();
            return;
        }

        launchTwa();
    }

    static SharedPreferences prefs(
            Context context
    ) {
        return context.getSharedPreferences(
                PREFS,
                Context.MODE_PRIVATE
        );
    }

    private static long currentVersionCode(
            Context context
    ) {
        try {
            android.content.pm.PackageInfo info =
                    context.getPackageManager()
                            .getPackageInfo(
                                    context.getPackageName(),
                                    0
                            );

            if (
                    android.os.Build.VERSION.SDK_INT >=
                    android.os.Build.VERSION_CODES.P
            ) {
                return info.getLongVersionCode();
            }

            return info.versionCode;
        } catch (
                android.content.pm.PackageManager.NameNotFoundException error
        ) {
            return -1L;
        }
    }

    static void recordCrash(
            Context context,
            String phase,
            Throwable error
    ) {
        String message =
                error.getClass().getName() +
                ": " +
                String.valueOf(
                        error.getMessage()
                );

        String stack =
                android.util.Log.getStackTraceString(
                        error
                );

        String diagnostic =
                "DFL Admin V21.5\n" +
                "Fase: " + phase + "\n" +
                "Android: " +
                android.os.Build.VERSION.RELEASE +
                " / API " +
                android.os.Build.VERSION.SDK_INT +
                "\n" +
                "Aparelho: " +
                android.os.Build.MANUFACTURER +
                " " +
                android.os.Build.MODEL +
                "\n\n" +
                message +
                "\n\n" +
                stack;

        if (diagnostic.length() > 12000) {
            diagnostic =
                    diagnostic.substring(
                            0,
                            12000
                    );
        }

        prefs(context)
                .edit()
                .putString(
                        KEY_CRASH,
                        diagnostic
                )
                .putLong(
                        KEY_VERSION,
                        currentVersionCode(context)
                )
                .putLong(
                        KEY_TIME,
                        System.currentTimeMillis()
                )
                .commit();
    }

    static void clearDiagnostic(
            Context context
    ) {
        prefs(context)
                .edit()
                .remove(KEY_CRASH)
                .remove(KEY_VERSION)
                .remove(KEY_TIME)
                .apply();
    }

    private boolean hasCurrentDiagnostic() {
        SharedPreferences prefs =
                prefs(this);

        return prefs.getLong(
                KEY_VERSION,
                -1L
        ) == currentVersionCode(this) &&
                !prefs.getString(
                        KEY_CRASH,
                        ""
                ).isEmpty();
    }

    private void launchTwa() {
        Intent target =
                new Intent(
                        getIntent()
                );

        target.setClass(
                this,
                SafeLauncherActivity.class
        );

        target.setPackage(
                getPackageName()
        );

        target.removeExtra(
                EXTRA_FORCE_DIAGNOSTIC
        );

        startActivity(target);
        finish();
    }

    static boolean openAdminInBrowser(
            Context context,
            Uri uri
    ) {
        for (
                String packageName :
                SAFE_BROWSER_PACKAGES
        ) {
            try {
                Intent browser =
                        new Intent(
                                Intent.ACTION_VIEW,
                                uri
                        );

                browser.addCategory(
                        Intent.CATEGORY_BROWSABLE
                );

                browser.setPackage(
                        packageName
                );

                if (!(context instanceof Activity)) {
                    browser.addFlags(
                            Intent.FLAG_ACTIVITY_NEW_TASK
                    );
                }

                context.startActivity(
                        browser
                );

                return true;
            } catch (
                    ActivityNotFoundException |
                    SecurityException ignored
            ) {
                // tenta o próximo navegador conhecido
            }
        }

        return false;
    }

    private int dp(int value) {
        return Math.round(
                value *
                getResources()
                        .getDisplayMetrics()
                        .density
        );
    }

    private TextView text(
            String value,
            float size,
            int color
    ) {
        TextView view =
                new TextView(this);

        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(color);

        return view;
    }

    private Button button(
            String label
    ) {
        Button button =
                new Button(this);

        button.setText(label);
        button.setAllCaps(false);

        LinearLayout.LayoutParams params =
                new LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                );

        params.topMargin = dp(10);
        button.setLayoutParams(params);

        return button;
    }

    private void showDiagnostic() {
        String diagnostic =
                prefs(this).getString(
                        KEY_CRASH,
                        ""
                );

        if (diagnostic.isEmpty()) {
            diagnostic =
                    "O launcher pediu a tela de diagnóstico, " +
                    "mas nenhuma exceção foi registrada.";
        }

        final String copyText =
                diagnostic;

        ScrollView scroll =
                new ScrollView(this);

        scroll.setFillViewport(true);
        scroll.setBackgroundColor(
                Color.rgb(9, 9, 11)
        );

        LinearLayout root =
                new LinearLayout(this);

        root.setOrientation(
                LinearLayout.VERTICAL
        );

        root.setGravity(
                Gravity.CENTER_VERTICAL
        );

        root.setPadding(
                dp(24),
                dp(32),
                dp(24),
                dp(32)
        );

        TextView badge =
                text(
                        "DFL ADMIN · DIAGNÓSTICO NATIVO",
                        12,
                        Color.rgb(
                                160,
                                160,
                                170
                        )
                );

        root.addView(badge);

        TextView title =
                text(
                        "O Android interrompeu a abertura",
                        24,
                        Color.WHITE
                );

        LinearLayout.LayoutParams titleParams =
                new LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                );

        titleParams.topMargin =
                dp(14);

        title.setLayoutParams(
                titleParams
        );

        root.addView(title);

        TextView explanation =
                text(
                        "Agora o erro foi capturado. " +
                        "Você pode copiar o diagnóstico, " +
                        "tentar novamente ou abrir o Admin " +
                        "diretamente no navegador.",
                        15,
                        Color.rgb(
                                205,
                                205,
                                214
                        )
                );

        LinearLayout.LayoutParams explanationParams =
                new LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                );

        explanationParams.topMargin =
                dp(12);

        explanation.setLayoutParams(
                explanationParams
        );

        root.addView(explanation);

        TextView code =
                text(
                        diagnostic,
                        12,
                        Color.rgb(
                                190,
                                190,
                                200
                        )
                );

        code.setTextIsSelectable(true);
        code.setBackgroundColor(
                Color.rgb(
                        20,
                        20,
                        24
                )
        );

        code.setPadding(
                dp(14),
                dp(14),
                dp(14),
                dp(14)
        );

        LinearLayout.LayoutParams codeParams =
                new LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                );

        codeParams.topMargin =
                dp(18);

        code.setLayoutParams(
                codeParams
        );

        root.addView(code);

        Button copy =
                button(
                        "Copiar diagnóstico"
                );

        copy.setOnClickListener(
                view -> {
                    ClipboardManager clipboard =
                            (ClipboardManager)
                                    getSystemService(
                                            Context.CLIPBOARD_SERVICE
                                    );

                    clipboard.setPrimaryClip(
                            ClipData.newPlainText(
                                    "DFL Admin diagnóstico",
                                    copyText
                            )
                    );

                    Toast.makeText(
                            this,
                            "Diagnóstico copiado",
                            Toast.LENGTH_SHORT
                    ).show();
                }
        );

        root.addView(copy);

        Button retry =
                button(
                        "Tentar abrir novamente"
                );

        retry.setOnClickListener(
                view -> {
                    clearDiagnostic(this);
                    launchTwa();
                }
        );

        root.addView(retry);

        Button browser =
                button(
                        "Abrir Admin no navegador"
                );

        browser.setOnClickListener(
                view -> {
                    if (
                            !openAdminInBrowser(
                                    this,
                                    ADMIN_URI
                            )
                    ) {
                        Toast.makeText(
                                this,
                                "Nenhum navegador compatível foi encontrado.",
                                Toast.LENGTH_LONG
                        ).show();
                    }
                }
        );

        root.addView(browser);

        scroll.addView(root);

        setContentView(scroll);
    }
}
