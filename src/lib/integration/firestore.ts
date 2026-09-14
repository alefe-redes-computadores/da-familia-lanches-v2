// src/lib/integration/firestore.ts

import {
  doc,
  type Transaction,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  buildOutboxRecord,
  type IntegrationEventEnvelope,
  type IntegrationOutboxRecord,
} from "./contracts";

export const INTEGRATION_COLLECTIONS = {
  outbox: "integration_outbox",
  inbox: "integration_inbox",
  identities:
    "integration_external_identities",
} as const;

const MAX_DOCUMENT_ID_LENGTH = 1400;

const integrationDocumentId = (
  raw: string,
) => {
  const cleaned = raw.trim();

  if (!cleaned) {
    throw new Error(
      "ID de integração vazio.",
    );
  }

  const encoded =
    encodeURIComponent(cleaned);

  if (
    encoded.length >
    MAX_DOCUMENT_ID_LENGTH
  ) {
    throw new Error(
      "ID de integração excede o limite seguro.",
    );
  }

  return encoded;
};

export async function ensureIntegrationEventInTransaction<
  TPayload,
>(
  transaction: Transaction,
  event: IntegrationEventEnvelope<TPayload>,
): Promise<{
  created: boolean;
  record: IntegrationOutboxRecord<TPayload>;
}> {
  const ref = doc(
    db,
    INTEGRATION_COLLECTIONS.outbox,
    integrationDocumentId(event.event_id),
  );

  const snapshot =
    await transaction.get(ref);

  if (snapshot.exists()) {
    return {
      created: false,
      record:
        snapshot.data() as IntegrationOutboxRecord<TPayload>,
    };
  }

  const record =
    buildOutboxRecord(event);

  transaction.set(ref, record);

  return {
    created: true,
    record,
  };
}
