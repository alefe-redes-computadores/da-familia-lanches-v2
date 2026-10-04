"use client";

import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[DFL ADMIN RUNTIME]", error);
  }, [error]);

  const message = error?.message || "Erro desconhecido";
  const stack = error?.stack || "";
  const digest = error?.digest || "";

  return (
    <main style={{
      minHeight: "100dvh",
      background: "#080b0f",
      color: "#f4f7fa",
      padding: "24px 16px",
      fontFamily: "system-ui, sans-serif",
    }}>
      <section style={{
        maxWidth: 760,
        margin: "0 auto",
        border: "1px solid rgba(255,100,110,.28)",
        borderRadius: 18,
        background: "#10151b",
        padding: 18,
      }}>
        <span style={{
          display: "inline-block",
          color: "#ff8b94",
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: ".12em",
        }}>DFL ADMIN · DIAGNÓSTICO</span>

        <h1 style={{ fontSize: 22, margin: "10px 0 8px" }}>
          O Admin encontrou uma exceção
        </h1>

        <p style={{ color: "#aeb8c2", fontSize: 14, lineHeight: 1.5 }}>
          Esta tela é temporária e serve para mostrar o erro real da versão atual.
        </p>

        <div style={{
          marginTop: 16,
          padding: 14,
          borderRadius: 12,
          background: "#090d12",
          border: "1px solid rgba(255,255,255,.08)",
        }}>
          <strong style={{ display: "block", color: "#ffd4d7", marginBottom: 8 }}>
            Mensagem
          </strong>
          <pre style={{
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            margin: 0,
            color: "#f0b9be",
            fontSize: 12,
            lineHeight: 1.45,
          }}>{message}</pre>
        </div>

        {digest && (
          <div style={{ marginTop: 12, color: "#8d98a3", fontSize: 12 }}>
            Digest: {digest}
          </div>
        )}

        {stack && (
          <details style={{ marginTop: 14 }}>
            <summary style={{ cursor: "pointer", color: "#d6dde4", fontWeight: 700 }}>
              Ver stack
            </summary>
            <pre style={{
              marginTop: 10,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              color: "#87929d",
              fontSize: 10,
              lineHeight: 1.45,
            }}>{stack}</pre>
          </details>
        )}

        <div style={{ display: "grid", gap: 8, marginTop: 18 }}>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              minHeight: 46,
              border: 0,
              borderRadius: 12,
              background: "#ffd12b",
              color: "#111",
              fontWeight: 900,
            }}
          >
            Tentar novamente
          </button>

          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              minHeight: 44,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,.12)",
              background: "#171d24",
              color: "#d8dfe6",
              fontWeight: 800,
            }}
          >
            Recarregar página
          </button>
        </div>
      </section>
    </main>
  );
}
