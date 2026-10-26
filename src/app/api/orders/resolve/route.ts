import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/integration/server/adminAuth";
import { adminDb } from "@/lib/integration/server/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const responseHeaders = { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" };
const reject = () => NextResponse.json({ ok: false, outcome: "unknown" }, { status: 400, headers: responseHeaders });
const unavailable = () => NextResponse.json({ ok: false, outcome: "unknown" }, { status: 503, headers: responseHeaders });
function safeEqual(a: string, b: string) {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}
function validAttempt(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{16,80}$/.test(value);
}

/**
 * Read-only status of the *same* idempotent order attempt. Never creates, retries,
 * sends notifications, or exposes customer information.
 * A 'not_found' answer is not proof that a concurrent POST cannot commit later.
 */
export async function POST(request: NextRequest) {
  try {
    const raw = await request.text();
    if (!raw || raw.length > 400) return reject();
    const body: unknown = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) return reject();
    const record = body as Record<string, unknown>;
    if (!validAttempt(record.clientRequestId) || (record.mode !== "guest" && record.mode !== "google")) return reject();
    const key = record.clientRequestId;
    const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || "";
    // Google accounts must present their own verified Firebase ID token.
    if (record.mode === "guest" && bearer) return reject();
    if (record.mode === "google" && !bearer) return reject();
    let actorId: string;
    if (record.mode === "google") {
      const decoded = await adminAuth.verifyIdToken(bearer, true);
      if (!decoded?.uid) return reject();
      actorId = decoded.uid;
    } else {
      actorId = `guest_${createHash("sha256").update(key).digest("hex").slice(0, 24)}`;
    }
    const orderId = `site_${createHash("sha256").update(actorId + ":" + key).digest("hex").slice(0, 40)}`;
    const snap = await adminDb.collection("Pedidos").doc(orderId).get();
    if (!snap.exists) return NextResponse.json({ ok: true, outcome: "not_found" }, { headers: responseHeaders });
    const saved = snap.data() || {};
    if (!safeEqual(String(saved.userId ?? ""), actorId) ||
        !safeEqual(String(saved.clientRequestId ?? ""), key) ||
        saved.customerMode !== record.mode || saved.checkoutChannel !== "site") return reject();
    return NextResponse.json({ ok: true, outcome: "found", orderId }, { headers: responseHeaders });
  } catch (error) {
    // Never put tokens, private addresses, request bodies or Firestore error messages in logs.
    if (error instanceof SyntaxError) return reject();
    return unavailable();
  }
}
