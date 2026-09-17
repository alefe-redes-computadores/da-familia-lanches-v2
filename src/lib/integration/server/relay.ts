import "server-only";
import { isIntegrationEventEnvelope, type IntegrationEventEnvelope } from "../contracts";
import { assertRelayRuntimeReady, getRelayConfig } from "./config";
import {
  claimOutboxBatch,
  claimOutboxEvent,
  readSentOutboxEvent,
  markOutboxFailed,
  markOutboxSent,
  type ClaimedOutboxEvent,
} from "./outboxRepository";
import { integrationSignature } from "./signature";
import { ensureCommercialMessagingIntent } from "./messagingProjection";

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

async function sendEvent(targetUrl: string, signingSecret: string, event: IntegrationEventEnvelope, timeoutMs: number) {
  const body = JSON.stringify(event);
  const timestamp = new Date().toISOString();
  const signature = integrationSignature(body, timestamp, signingSecret);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(targetUrl, {
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
    if (!response.ok) throw new Error(`Destino respondeu HTTP ${response.status}.`);
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
    try {
      const event = eventFromOutbox(item.record as unknown as Record<string, unknown>);
      const status = await sendEvent(config.targetUrl!, config.signingSecret!, event, config.requestTimeoutMs);
      await ensureCommercialMessagingIntent(event);
      await markOutboxSent(item, config.workerId);
      result.sent += 1;
      result.results.push({ eventId, ok: true, status });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha desconhecida no relay.";
      await markOutboxFailed(item, config.workerId, message, config.maxAttempts);
      result.failed += 1;
      if (item.record.attempts >= config.maxAttempts) result.deadLetterCandidates += 1;
      result.results.push({ eventId, ok: false, error: message });
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
