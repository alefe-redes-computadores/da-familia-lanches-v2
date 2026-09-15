import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export function integrationSignature(body: string, timestamp: string, secret: string) {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`, "utf8").digest("hex");
}

export function safeSecretEquals(actual: string | null, expected: string) {
  if (!actual) return false;
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function signingSecret() {
  const secret = process.env.DFL_INTEGRATION_SIGNING_SECRET?.trim();
  if (!secret) throw new Error("DFL_INTEGRATION_SIGNING_SECRET ausente.");
  return secret;
}

export function assertSignedIntegrationRequest(input: {
  body: string;
  timestamp: string | null;
  signature: string | null;
  eventId: string | null;
  expectedEventId: string;
}) {
  const timestamp = input.timestamp?.trim();
  const signature = input.signature?.trim();
  const eventId = input.eventId?.trim();

  if (!timestamp || !signature || !eventId) {
    throw new Error("Cabeçalhos de assinatura ausentes.");
  }
  if (eventId !== input.expectedEventId) {
    throw new Error("x-dfl-event-id diverge do envelope.");
  }

  const timestampMs = Number(timestamp);
  if (!Number.isFinite(timestampMs)) throw new Error("Timestamp de assinatura inválido.");
  if (Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) {
    throw new Error("Timestamp de assinatura fora da janela permitida.");
  }

  const expected = integrationSignature(input.body, timestamp, signingSecret());
  if (!safeSecretEquals(signature, expected)) throw new Error("Assinatura de integração inválida.");
}
