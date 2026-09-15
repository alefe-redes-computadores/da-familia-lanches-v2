import { NextRequest, NextResponse } from "next/server";
import { getRelayConfig } from "@/lib/integration/server/config";
import { drainIntegrationOutbox, drainIntegrationOutboxEvent, replaySentIntegrationOutboxEvent } from "@/lib/integration/server/relay";
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

async function drainRequest(request: NextRequest): Promise<{ eventId: string | null; replaySent: boolean }> {
  const raw = await request.text();
  if (!raw.trim()) return { eventId: null, replaySent: false };
  let body: unknown;
  try { body = JSON.parse(raw); } catch { throw new Error("JSON inválido."); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Body inválido.");
  const candidate = body as { event_id?: unknown; replay_sent?: unknown };
  if (candidate.replay_sent !== undefined && typeof candidate.replay_sent !== "boolean") throw new Error("replay_sent deve ser boolean.");
  const replaySent = candidate.replay_sent === true;
  const eventId = candidate.event_id;
  if (eventId == null || eventId === "") {
    if (replaySent) throw new Error("replay_sent exige event_id explícito.");
    return { eventId: null, replaySent: false };
  }
  if (typeof eventId !== "string" || !eventId.trim() || eventId.trim().length > 1400) throw new Error("event_id inválido.");
  return { eventId: eventId.trim(), replaySent };
}

export async function POST(request: NextRequest) {
  const auth = authorize(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.message }, { status: auth.status });
  if (!auth.config.enabled) {
    return NextResponse.json(
      { ok: false, enabled: false, message: "Relay preparado, porém desativado por configuração." },
      { status: 503 },
    );
  }

  try {
    const { eventId, replaySent } = await drainRequest(request);
    if (replaySent) {
      const replay = await replaySentIntegrationOutboxEvent(eventId!);
      return NextResponse.json({ ok: replay.replayed, mode: "replay_sent", ...replay }, { status: replay.replayed ? 200 : replay.status });
    }
    const result = eventId ? await drainIntegrationOutboxEvent(eventId) : await drainIntegrationOutbox();

    if (eventId && result.claimed === 0) {
      return NextResponse.json(
        { ok: false, mode: "selective", requestedEventId: eventId, ...result },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        ok: result.failed === 0,
        mode: eventId ? "selective" : "batch",
        ...(eventId ? { requestedEventId: eventId } : {}),
        ...result,
      },
      { status: result.failed === 0 ? 200 : 207 },
    );
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
    selectiveDrainSupported: true,
    sentReplaySupported: true,
  });
}
