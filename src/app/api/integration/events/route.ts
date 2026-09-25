import { NextRequest, NextResponse } from "next/server";
import { isIntegrationEventEnvelope } from "@/lib/integration/contracts";
import { assertSignedIntegrationRequest } from "@/lib/integration/server/signature";
import {
  assertReverseIntegrationEvent,
  consumeDflEntregasEvent,
} from "@/lib/integration/server/reversePersistence";
import { projectEntregasNativeDeliveryEvent } from "@/lib/analytics/server/projector";
import { errorCode,finishRouteTrace,startRouteTrace } from "@/lib/server/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function failure(error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : "Falha de integração reversa.";
  console.error("[integration/reverse-inbound]", message);
  return NextResponse.json({ ok: false, error: message.slice(0, 300) }, { status });
}

export async function POST(request: NextRequest) {
  const trace=startRouteTrace("integration.events.inbound");
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

    const payload = event.payload && typeof event.payload === "object" && !Array.isArray(event.payload) ? event.payload as Record<string, unknown> : {};
    if (event.source_system === "dfl_entregas" && event.entity_type === "delivery" && payload.analyticsNativeDelivery === true) {
      const result = await projectEntregasNativeDeliveryEvent(event);
      finishRouteTrace(trace,"ok",{eventType:event.event_type,analytics:true,status:201});
      return NextResponse.json({ ok:true, accepted:true, analytics:"native_delivery", ...result }, { status:201,headers:{"x-dfl-trace-id":trace.id} });
    }
    assertReverseIntegrationEvent(event);
    const result = await consumeDflEntregasEvent(event);
    finishRouteTrace(trace,"ok",{eventType:event.event_type,alreadyProcessed:result.already_processed,status:result.already_processed?200:201});
    return NextResponse.json(
      { ok: true, accepted: true, ...result },
      { status: result.already_processed ? 200 : 201,headers:{"x-dfl-trace-id":trace.id} },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    finishRouteTrace(trace,"error",{errorCode:errorCode(error),authentication:/assinatura|timestamp|SIGNING_SECRET|Cabeçalhos/i.test(message)});
    return failure(error, /assinatura|timestamp|SIGNING_SECRET|Cabeçalhos/i.test(message) ? 401 : 400);
  }
}
