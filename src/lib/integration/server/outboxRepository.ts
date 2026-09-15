import "server-only";
import type { DocumentData, DocumentReference } from "firebase-admin/firestore";
import type { IntegrationOutboxRecord } from "../contracts";
import { INTEGRATION_COLLECTIONS } from "../firestore";
import { adminDb } from "./admin";

export interface ClaimedOutboxEvent {
  ref: DocumentReference<DocumentData>;
  record: IntegrationOutboxRecord;
}

const isoNow = () => new Date().toISOString();
const due = (value: string | undefined, now: number) => !value || Date.parse(value) <= now;
const stale = (value: string | undefined, cutoff: number) => !value || Date.parse(value) <= cutoff;

function retryDelayMs(attempts: number) {
  const exponent = Math.max(0, Math.min(attempts - 1, 6));
  return Math.min(15 * 60_000, 5_000 * 2 ** exponent);
}

async function candidates(limit: number) {
  const collection = adminDb.collection(INTEGRATION_COLLECTIONS.outbox);
  const perStatus = Math.max(limit * 2, 10);
  const [pending, failed, processing] = await Promise.all([
    collection.where("status", "==", "pending").limit(perStatus).get(),
    collection.where("status", "==", "failed").limit(perStatus).get(),
    collection.where("status", "==", "processing").limit(perStatus).get(),
  ]);
  return [...pending.docs, ...failed.docs, ...processing.docs];
}

async function claimOutboxRef(
  ref: DocumentReference<DocumentData>,
  options: {
    workerId: string;
    maxAttempts: number;
    lockTimeoutMs: number;
  },
): Promise<ClaimedOutboxEvent | null> {
  const nowMs = Date.now();
  const staleCutoff = nowMs - options.lockTimeoutMs;

  const result = await adminDb.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) return null;

    const record = snapshot.data() as IntegrationOutboxRecord;
    const attempts = Number(record.attempts || 0);

    if (attempts >= options.maxAttempts && record.status !== "sent") {
      tx.update(ref, {
        status: "dead_letter",
        updated_at: isoNow(),
        last_error: record.last_error || "Máximo de tentativas excedido antes do claim.",
      });
      return null;
    }

    const claimable =
      (record.status === "pending" && due(record.next_attempt_at, nowMs)) ||
      (record.status === "failed" && due(record.next_attempt_at, nowMs)) ||
      (record.status === "processing" && stale(record.locked_at, staleCutoff));

    if (!claimable) return null;

    const now = isoNow();
    const next: IntegrationOutboxRecord = {
      ...record,
      status: "processing",
      attempts: attempts + 1,
      locked_by: options.workerId,
      locked_at: now,
      updated_at: now,
    };

    tx.update(ref, {
      status: next.status,
      attempts: next.attempts,
      locked_by: next.locked_by,
      locked_at: next.locked_at,
      updated_at: next.updated_at,
    });

    return next;
  });

  return result ? { ref, record: result } : null;
}

export async function claimOutboxEvent(
  eventId: string,
  options: {
    workerId: string;
    maxAttempts: number;
    lockTimeoutMs: number;
  },
): Promise<ClaimedOutboxEvent | null> {
  const normalized = eventId.trim();
  if (!normalized || normalized.length > 1400) {
    throw new Error("event_id inválido para commissioning seletivo.");
  }

  const collection = adminDb.collection(INTEGRATION_COLLECTIONS.outbox);

  // V1 grava a outbox com document ID == event_id. O fallback por campo mantém
  // compatibilidade caso um registro legado não siga esse detalhe físico.
  const directRef = collection.doc(normalized);
  const directSnapshot = await directRef.get();
  if (directSnapshot.exists) {
    const record = directSnapshot.data() as IntegrationOutboxRecord;
    if (record.event_id !== normalized) {
      throw new Error("Documento de outbox diverge do event_id solicitado.");
    }
    return claimOutboxRef(directRef, options);
  }

  const query = await collection.where("event_id", "==", normalized).limit(2).get();
  if (query.empty) return null;
  if (query.size > 1) throw new Error("event_id duplicado na outbox; commissioning abortado.");

  return claimOutboxRef(query.docs[0].ref, options);
}

export async function claimOutboxBatch(options: {
  workerId: string;
  batchSize: number;
  maxAttempts: number;
  lockTimeoutMs: number;
}): Promise<ClaimedOutboxEvent[]> {
  const docs = await candidates(options.batchSize);
  const claimed: ClaimedOutboxEvent[] = [];

  for (const candidate of docs) {
    if (claimed.length >= options.batchSize) break;
    const result = await claimOutboxRef(candidate.ref, options);
    if (result) claimed.push(result);
  }

  return claimed;
}

export async function markOutboxSent(claimed: ClaimedOutboxEvent, workerId: string) {
  await adminDb.runTransaction(async (tx) => {
    const snapshot = await tx.get(claimed.ref);
    if (!snapshot.exists) return;
    const current = snapshot.data() as IntegrationOutboxRecord;
    if (current.status !== "processing" || current.locked_by !== workerId) return;
    const now = isoNow();
    tx.update(claimed.ref, {
      status: "sent",
      processed_at: now,
      updated_at: now,
      locked_by: null,
      locked_at: null,
      next_attempt_at: null,
      last_error: null,
    });
  });
}

export async function markOutboxFailed(
  claimed: ClaimedOutboxEvent,
  workerId: string,
  error: string,
  maxAttempts: number,
) {
  await adminDb.runTransaction(async (tx) => {
    const snapshot = await tx.get(claimed.ref);
    if (!snapshot.exists) return;
    const current = snapshot.data() as IntegrationOutboxRecord;
    if (current.status !== "processing" || current.locked_by !== workerId) return;
    const attempts = Number(current.attempts || claimed.record.attempts || 1);
    const dead = attempts >= maxAttempts;
    const nowMs = Date.now();
    tx.update(claimed.ref, {
      status: dead ? "dead_letter" : "failed",
      updated_at: new Date(nowMs).toISOString(),
      last_error: error.slice(0, 800),
      next_attempt_at: dead ? null : new Date(nowMs + retryDelayMs(attempts)).toISOString(),
      locked_by: null,
      locked_at: null,
    });
  });
}
