import { NextRequest, NextResponse } from "next/server";
import { getRelayConfig } from "@/lib/integration/server/config";
import { drainIntegrationOutbox } from "@/lib/integration/server/relay";
import { safeSecretEquals } from "@/lib/integration/server/signature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorize(request: NextRequest) {
  const config = getRelayConfig();
  if (!config.triggerSecret) return { ok: false as const, status: 503, message: "Relay trigger não configurado." };
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || null;
  if (!safeSecretEquals(bearer, config.triggerSecret)) return { ok: false as const, status: 401, message: "Não autorizado." };
  return { ok: true as const, config };
}

export async function POST(request: NextRequest) {
  const auth = authorize(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  if (!auth.config.enabled) {
    return NextResponse.json({ ok: false, enabled: false, message: "Relay preparado, porém desativado por configuração." }, { status: 503 });
  }

  try {
    const result = await drainIntegrationOutbox();
    return NextResponse.json({ ok: result.failed === 0, ...result }, { status: result.failed === 0 ? 200 : 207 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha interna no relay.";
    console.error("[integration-relay] drain failed", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET() {
  const config = getRelayConfig();
  return NextResponse.json({
    service: "dfl-site-integration-relay",
    enabled: config.enabled,
    targetConfigured: Boolean(config.targetUrl),
    signingConfigured: Boolean(config.signingSecret),
    triggerConfigured: Boolean(config.triggerSecret),
  });
}
