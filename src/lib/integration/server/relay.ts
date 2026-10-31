import "server-only";
import { isIntegrationEventEnvelope, type IntegrationEventEnvelope } from "../contracts";
import { assertRelayRuntimeReady, getRelayConfig } from "./config";
import {
  claimOutboxBatch,
  claimOutboxEvent,
  readSentOutboxEvent,
  markOutboxFailed,
  markOutboxSent,
  markOutboxTransportAcknowledged,
  type ClaimedOutboxEvent,
} from "./outboxRepository";
import { integrationSignature } from "./signature";
import { ensureCommercialMessagingIntent } from "./messagingProjection";
import { drainMessagingIntentFastLane } from "./messagingFastLane";
import { projectOrderEvent } from "@/lib/analytics/server/projector";

export interface RelayDrainResult {
  claimed: number;
  sent: number;
  failed: number;
  deadLetterCandidates: number;
  results: Array<{ eventId: string; ok: boolean; status?: number; error?: string }>;
}

function eventFromOutbox(record: Record<string, unknown>): IntegrationEventEnvelope {
  const event = {
    event_id: record.event_id,
    event_type: record.event_type,
    occurred_at: record.occurred_at,
    source_system: record.source_system,
    entity_type: record.entity_type,
    entity_id: record.entity_id,
    schema_version: record.schema_version,
    payload: record.payload,
    ...(record.correlation_id ? { correlation_id: record.correlation_id } : {}),
    ...(record.causation_id ? { causation_id: record.causation_id } : {}),
  };
  if (!isIntegrationEventEnvelope(event)) throw new Error("Evento inválido encontrado na outbox.");
  return event;
}

function canonicalEntregasEventsUrl(rawTargetUrl: string) {
  const url = new URL(rawTargetUrl);
  const path = url.pathname.replace(/\/+$/, "");

  // Aceita tanto a origem do DFL Entregas quanto o endpoint completo.
  // Isso evita que uma variável Production apontando só para o domínio
  // transforme todo order.created em POST / (404/405).
  if (!path || path === "/") url.pathname = "/api/integration/events";
  return url.toString();
}

async function responseFailure(response: Response) {
  let detail = "";
  try {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = (await response.json()) as { error?: unknown };
      if (typeof data?.error === "string") detail = data.error.trim();
    } else {
      detail = (await response.text()).replace(/\s+/g, " ").trim();
    }
  } catch {
    // O status HTTP continua sendo suficiente para retry/dead-letter.
  }
  const safe = detail.slice(0, 220);
  return `Destino DFL Entregas respondeu HTTP ${response.status}${safe ? `: ${safe}` : "."}`;
}

async function sendEvent(targetUrl: string, signingSecret: string, event: IntegrationEventEnvelope, timeoutMs: number) {
  const body = JSON.stringify(event);
  const timestamp = new Date().toISOString();
  const signature = integrationSignature(body, timestamp, signingSecret);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(canonicalEntregasEventsUrl(targetUrl), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-dfl-event-id": event.event_id,
        "x-dfl-timestamp": timestamp,
        "x-dfl-signature": `sha256=${signature}`,
      },
      body,
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(await responseFailure(response));
    return response.status;
  } finally {
    clearTimeout(timer);
  }
}

async function processClaimed(
  claimed: ClaimedOutboxEvent[],
  config: ReturnType<typeof assertRelayRuntimeReady>,
): Promise<RelayDrainResult> {
  const result: RelayDrainResult = {
    claimed: claimed.length,
    sent: 0,
    failed: 0,
    deadLetterCandidates: 0,
    results: [],
  };

  for (const item of claimed) {
    const eventId = item.record.event_id;
    const startedAtMs = Date.now();
    try {
      const event = eventFromOutbox(item.record as unknown as Record<string, unknown>);
      // Logistica e persistencia da mensagem iniciam juntas.
      // Uma espera de WhatsApp jamais antecede o POST ao Entregas.
      const previouslyAcknowledged = Boolean(item.record.transport_acknowledged_at);
      const firstAttemptAt = new Date().toISOString();
      const transport = previouslyAcknowledged
        ? Promise.resolve(Number(item.record.transport_http_status) || 200)
        : sendEvent(config.targetUrl!, config.signingSecret!, event, config.requestTimeoutMs);
      const projection = ensureCommercialMessagingIntent(event);
      const [transportOutcome, projectionOutcome] = await Promise.allSettled([transport, projection]);

      // A mensagem tem fila e tentativas proprias. Fast-lane nao altera o estado
      // de entrega ao Entregas; erros nao ressuscitam eventos ja recebidos.
      const lane: Promise<unknown> = projectionOutcome.status === "fulfilled" &&
        "intentId" in projectionOutcome.value && projectionOutcome.value.intentId
        ? drainMessagingIntentFastLane(projectionOutcome.value.intentId)
            .then((delivery) => {
              if (delivery.attempted && !delivery.queued)
                console.warn("[integration/messaging] fast-lane pendente; fila preservada", {
                  eventId, reason: delivery.reason,
                });
            })
            .catch((error) => {
              console.warn("[integration/messaging] fast-lane falhou; fila preservada", {
                eventId, kind: error instanceof Error ? error.name : "unknown",
              });
            })
        : Promise.resolve();

      if (transportOutcome.status === "fulfilled" && !previouslyAcknowledged) {
        const acknowledged = await markOutboxTransportAcknowledged(
          item, config.workerId, transportOutcome.value, firstAttemptAt,
        );
        if (!acknowledged) {
          await lane;
          throw new Error("Lease alterado antes de persistir o 2xx da logística.");
        }
      }
      if (transportOutcome.status === "rejected") {
        await lane;
        throw transportOutcome.reason;
      }
      // Quando a mensagem nao pode sequer ser persistida, retemos o evento
      // para retry SEM repetir o HTTP ja reconhecido pelo Entregas.
      if (projectionOutcome.status === "rejected") {
        await lane;
        throw projectionOutcome.reason;
      }

      const markedSent = await markOutboxSent(item, config.workerId);
      if (!markedSent) {
        await lane;
        throw new Error("Lease alterado antes do fechamento da outbox.");
      }
      result.sent++;
      result.results.push({ eventId, ok: true, status: transportOutcome.value });

      // Analytics e fast-lane sao pos-ack: falhas nao mudam uma entrega 2xx
      // para failed, nem geram um POST duplicado a cada retry analitico.
      const analytics: Promise<unknown> = event.entity_type === "order" &&
        (event.event_type === "order.created" || event.event_type === "order.updated")
        ? projectOrderEvent(event) : Promise.resolve();
      const effects = await Promise.allSettled([lane, analytics]);
      if (effects[1].status === "rejected") {
        console.warn("[integration/analytics] falha isolada; backfill continua disponivel", {
          eventId, kind: effects[1].reason instanceof Error ? effects[1].reason.name : "unknown",
        });
      }
      console.info("[integration/relay] entrega reconhecida", {
        eventId, status: transportOutcome.value,
        alreadyAcknowledged: previouslyAcknowledged,
        originalEventAt: event.occurred_at,
        durationMs: Date.now() - startedAtMs,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha desconhecida no relay.";
      await markOutboxFailed(item, config.workerId, message, config.maxAttempts);
      result.failed++;
      if (item.record.attempts >= config.maxAttempts) result.deadLetterCandidates++;
      result.results.push({ eventId, ok: false, error: message });
      console.warn("[integration/relay] retry preservado", {
        eventId, durationMs: Date.now() - startedAtMs,
        kind: error instanceof Error ? error.name : "unknown",
      });
    }
  }
  return result;
}

export async function drainIntegrationOutbox(): Promise<RelayDrainResult> {
  const config = assertRelayRuntimeReady(getRelayConfig());
  const claimed = await claimOutboxBatch(config);
  return processClaimed(claimed, config);
}

export async function drainIntegrationOutboxEvent(eventId: string): Promise<RelayDrainResult> {
  const config = assertRelayRuntimeReady(getRelayConfig());
  const claimed = await claimOutboxEvent(eventId, config);

  // Fundamental para commissioning: ID inexistente/não claimable NÃO pode cair
  // silenciosamente para o drain em lote.
  if (!claimed) {
    return {
      claimed: 0,
      sent: 0,
      failed: 0,
      deadLetterCandidates: 0,
      results: [{ eventId, ok: false, error: "Evento não encontrado ou não está disponível para claim." }],
    };
  }

  return processClaimed([claimed], config);
}

export async function replaySentIntegrationOutboxEvent(eventId: string) {
  const config = assertRelayRuntimeReady(getRelayConfig());
  const record = await readSentOutboxEvent(eventId);
  if (!record) return { replayed: false, eventId, status: 404, error: "Evento sent não encontrado." };
  const event = eventFromOutbox(record as unknown as Record<string, unknown>);
  const status = await sendEvent(config.targetUrl!, config.signingSecret!, event, config.requestTimeoutMs);
  return { replayed: true, eventId, status };
}
