"use client";

import { useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { haptic } from "@/lib/haptics";
import styles from "./AdminAuthGate.module.css";

type Props = {
  deniedEmail?: string | null;
};

function getAuthCode(error: unknown) {
  if (!error || typeof error !== "object") return "";

  const code = (error as { code?: unknown }).code;

  return typeof code === "string" ? code : "";
}

function authMessage(code: string) {
  switch (code) {
    case "auth/unauthorized-domain":
      return "Este domínio ainda não está autorizado no Firebase Authentication.";

    case "auth/popup-blocked":
      return "O navegador bloqueou a janela do Google.";

    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Login cancelado.";

    case "auth/network-request-failed":
      return "Falha de conexão. Verifique a internet e tente novamente.";

    case "auth/operation-not-allowed":
      return "O login com Google está desativado no Firebase Authentication.";

    default:
      return "Não foi possível entrar no painel agora.";
  }
}

function createGoogleProvider() {
  const provider = new GoogleAuthProvider();

  provider.setCustomParameters({
    prompt: "select_account",
  });

  return provider;
}

export function AdminAuthGate({
  deniedEmail,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [errorCode, setErrorCode] = useState("");

  const adminHost =
    typeof window !== "undefined" &&
    window.location.hostname ===
      "admin.dafamilialanches.com.br";

  useEffect(() => {
    void getRedirectResult(auth).catch((error) => {
      const code = getAuthCode(error);

      console.error(
        "[admin-auth] redirect-result",
        code,
        error,
      );

      setErrorCode(code || "auth/unknown");
    });
  }, []);

  const login = async () => {
    if (loading) return;

    setLoading(true);
    setErrorCode("");

    try {
      await signInWithPopup(
        auth,
        createGoogleProvider(),
      );

      haptic("success");
    } catch (error) {
      const code = getAuthCode(error);

      console.error(
        "[admin-auth] popup",
        code,
        error,
      );

      if (code === "auth/popup-blocked") {
        try {
          await signInWithRedirect(
            auth,
            createGoogleProvider(),
          );

          return;
        } catch (redirectError) {
          const redirectCode =
            getAuthCode(redirectError);

          console.error(
            "[admin-auth] redirect-start",
            redirectCode,
            redirectError,
          );

          setErrorCode(
            redirectCode ||
              code ||
              "auth/unknown",
          );

          haptic("error");
        }
      } else {
        setErrorCode(
          code ||
            "auth/unknown",
        );

        haptic("error");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <header className={styles.brand}>
          <div className={styles.logo}>
            DFL
          </div>

          <div>
            <small>
              DA FAMÍLIA LANCHES
            </small>

            <strong>
              Central administrativa
            </strong>
          </div>
        </header>

        {deniedEmail ? (
          <>
            <span className={styles.denied}>
              ACESSO NEGADO
            </span>

            <h1>
              Esta conta não possui
              permissão administrativa.
            </h1>

            <p>
              {deniedEmail}
            </p>

            <button
              className={styles.google}
              type="button"
              onClick={login}
              disabled={loading}
            >
              {loading
                ? "Trocando conta..."
                : "Entrar com outra conta Google"}
            </button>
          </>
        ) : (
          <>
            <span className={styles.kicker}>
              ACESSO RESTRITO
            </span>

            <h1>
              Entre para abrir a operação
              da loja.
            </h1>

            <p>
              Use uma conta Google autorizada.
              Os dados administrativos só são
              carregados depois da autenticação.
            </p>

            <button
              className={styles.google}
              type="button"
              onClick={login}
              disabled={loading}
            >
              <svg
                width="21"
                height="21"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>

              {loading
                ? "Conectando..."
                : "Continuar com Google"}
            </button>
          </>
        )}

        {errorCode && (
          <div
            className={styles.error}
            role="alert"
          >
            <strong>
              {authMessage(errorCode)}
            </strong>

            <code>
              {errorCode}
            </code>

            {errorCode ===
              "auth/unauthorized-domain" &&
              adminHost && (
                <p>
                  Adicione
                  {" "}
                  <b>
                    admin.dafamilialanches.com.br
                  </b>
                  {" "}
                  em Firebase Console →
                  Authentication → Settings →
                  Authorized domains.
                </p>
              )}
          </div>
        )}

        <footer className={styles.host}>
          <span>
            Domínio
          </span>

          <strong>
            {adminHost
              ? "admin.dafamilialanches.com.br"
              : "rota administrativa"}
          </strong>
        </footer>
      </section>
    </main>
  );
}
