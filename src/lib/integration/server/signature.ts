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
