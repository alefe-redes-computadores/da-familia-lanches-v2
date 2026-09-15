import { NextRequest, NextResponse } from "next/server";
import { isIntegrationEventEnvelope } from "@/lib/integration/contracts";
import { assertSignedIntegrationRequest } from "@/lib/integration/server/signature";
import {
  assertReverseIntegrationEvent,
  consumeDflEntregasEvent,
} from "@/lib/integration/server/reversePersistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function failure(error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : "Falha de integração reversa.";
  console.error("[integration/reverse-inbound]", message);
  return NextResponse.json({ ok: false, error: message.slice(0, 300) }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    if (!body || body.length > 512_000) return failure(new Error("Payload vazio ou grande demais."), 413);

    const event = JSON.parse(body) as unknown;
    if (!isIntegrationEventEnvelope(event)) return failure(new Error("Envelope de integração inválido."), 400);

    assertSignedIntegrationRequest({
      body,
      timestamp: request.headers.get("x-dfl-timestamp"),
      signature: request.headers.get("x-dfl-signature"),
      eventId: request.headers.get("x-dfl-event-id"),
      expectedEventId: event.event_id,
    });

    assertReverseIntegrationEvent(event);
    const result = await consumeDflEntregasEvent(event);
    return NextResponse.json(
      { ok: true, accepted: true, ...result },
      { status: result.already_processed ? 200 : 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return failure(error, /assinatura|timestamp|SIGNING_SECRET|Cabeçalhos/i.test(message) ? 401 : 400);
  }
}
