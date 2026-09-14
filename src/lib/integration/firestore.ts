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

/**
 * Cria o evento de outbox dentro da MESMA transaction do domínio.
 *
 * Importante:
 * o cliente do Site não possui permissão de leitura em integration_outbox.
 * Portanto o cliente não deve fazer leitura transacional da outbox aqui.
 *
 * A proteção contra sobrescrever evento existente fica nas Firestore Rules:
 * o cliente pode CREATE, mas não UPDATE. Se o mesmo event_id já existir,
 * uma tentativa de set será tratada como update e será recusada, impedindo
 * reset acidental de evento já processado.
 */
export async function ensureIntegrationEventInTransaction<
  TPayload,
>(
  transaction: Transaction,
  event: IntegrationEventEnvelope<TPayload>,
): Promise<{
  created: true;
  record: IntegrationOutboxRecord<TPayload>;
}> {
  const ref = doc(
    db,
    INTEGRATION_COLLECTIONS.outbox,
    integrationDocumentId(event.event_id),
  );

  const record =
    buildOutboxRecord(event);

  transaction.set(ref, record);

  return {
    created: true,
    record,
  };
}
