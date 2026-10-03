package br.com.dafamilialanches.admin;

import android.content.Intent;
import android.os.Bundle;

import androidx.annotation.Nullable;

import com.google.androidbrowserhelper.trusted.LauncherActivity;
import com.google.androidbrowserhelper.trusted.TwaLauncher;

import java.util.concurrent.atomic.AtomicBoolean;

public class SafeLauncherActivity
        extends LauncherActivity {

    private static final AtomicBoolean
            HANDLER_INSTALLED =
            new AtomicBoolean(false);

    private static
    Thread.UncaughtExceptionHandler
            previousHandler;

    @Override
    protected void onCreate(
            @Nullable Bundle savedInstanceState
    ) {
        installCrashJournal();

        try {
            super.onCreate(
                    savedInstanceState
            );
        } catch (Throwable error) {
            reportAndOpenDiagnostic(
                    "launcher.onCreate",
                    error
            );
        }
    }

    @Override
    protected TwaLauncher.FallbackStrategy
    getFallbackStrategy() {

        return (
                context,
                twaBuilder,
                providerPackage,
                completionCallback
        ) -> {
            try {
                boolean opened =
                        EntryActivity
                                .openAdminInBrowser(
                                        context,
                                        twaBuilder.getUri()
                                );

                if (!opened) {
                    throw new IllegalStateException(
                            "NO_SAFE_BROWSER_AVAILABLE"
                    );
                }

                if (
                        completionCallback != null
                ) {
                    completionCallback.run();
                }
            } catch (Throwable error) {
                reportAndOpenDiagnostic(
                        "launcher.fallback",
                        error
                );
            }
        };
    }

    private void installCrashJournal() {
        if (
                !HANDLER_INSTALLED
                        .compareAndSet(
                                false,
                                true
                        )
        ) {
            return;
        }

        previousHandler =
                Thread.getDefaultUncaughtExceptionHandler();

        Thread.setDefaultUncaughtExceptionHandler(
                (thread, error) -> {
                    try {
                        EntryActivity.recordCrash(
                                getApplicationContext(),
                                "uncaught." +
                                        thread.getName(),
                                error
                        );
                    } catch (
                            Throwable ignored
                    ) {
                    }

                    if (
                            previousHandler != null
                    ) {
                        previousHandler
                                .uncaughtException(
                                        thread,
                                        error
                                );
                        return;
                    }

                    android.os.Process.killProcess(
                            android.os.Process.myPid()
                    );

                    System.exit(10);
                }
        );
    }

    private void reportAndOpenDiagnostic(
            String phase,
            Throwable error
    ) {
        EntryActivity.recordCrash(
                getApplicationContext(),
                phase,
                error
        );

        Intent diagnostic =
                new Intent(
                        this,
                        EntryActivity.class
                );

        diagnostic.putExtra(
                EntryActivity
                        .EXTRA_FORCE_DIAGNOSTIC,
                true
        );

        diagnostic.addFlags(
                Intent.FLAG_ACTIVITY_CLEAR_TOP |
                Intent.FLAG_ACTIVITY_NEW_TASK
        );

        try {
            startActivity(
                    diagnostic
            );
        } catch (
                Throwable ignored
        ) {
        }

        finish();
    }
}
