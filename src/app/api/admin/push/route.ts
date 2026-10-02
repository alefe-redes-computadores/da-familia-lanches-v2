import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth } from "@/lib/integration/server/adminAuth";
import { adminDb } from "@/lib/integration/server/admin";
import { isAdminEmail } from "@/lib/adminAuthorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLLECTION = "AdminPushSubscriptions";

function tokenId(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function authenticate(request: NextRequest) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || "";
  if (!bearer) return null;
  const decoded = await adminAuth.verifyIdToken(bearer, true);
  return isAdminEmail(decoded.email) ? decoded : null;
}

function cleanToken(value: unknown) {
  const token = String(value ?? "").trim();
  if (token.length < 20 || token.length > 4096) throw new Error("TOKEN_INVALID");
  return token;
}

export async function GET(request: NextRequest) {
  try {
    const decoded = await authenticate(request);
    if (!decoded) return NextResponse.json({ ok:false, error:"AUTH_REQUIRED" }, { status:401 });
    const vapidPublicKey = process.env.DFL_ADMIN_WEB_PUSH_VAPID_PUBLIC_KEY?.trim() || "";
    if (!vapidPublicKey) return NextResponse.json({ ok:false, error:"VAPID_NOT_CONFIGURED" }, { status:503 });
    return NextResponse.json({ ok:true, vapidPublicKey }, { headers:{ "Cache-Control":"no-store, max-age=0" } });
  } catch (error) {
    console.error("[admin/push] config", error);
    return NextResponse.json({ ok:false, error:"PUSH_CONFIG_FAILED" }, { status:500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const decoded = await authenticate(request);
    if (!decoded) return NextResponse.json({ ok:false, error:"AUTH_REQUIRED" }, { status:401 });
    const body = await request.json() as { token?: unknown; userAgent?: unknown };
    const token = cleanToken(body.token);
    const id = tokenId(token);
    const now = FieldValue.serverTimestamp();
    await adminDb.collection(COLLECTION).doc(id).set({
      token, enabled:true, uid:decoded.uid,
      email:String(decoded.email || "").trim().toLowerCase(),
      userAgent:String(body.userAgent ?? "").slice(0,500),
      updatedAt:now, lastSeenAt:now, schemaVersion:1,
    }, { merge:true });
    return NextResponse.json({ ok:true, subscriptionId:id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PUSH_SUBSCRIBE_FAILED";
    return NextResponse.json({ ok:false, error:message === "TOKEN_INVALID" ? message : "PUSH_SUBSCRIBE_FAILED" }, { status:message === "TOKEN_INVALID" ? 400 : 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const decoded = await authenticate(request);
    if (!decoded) return NextResponse.json({ ok:false, error:"AUTH_REQUIRED" }, { status:401 });
    const body = await request.json() as { token?: unknown };
    const token = cleanToken(body.token);
    await adminDb.collection(COLLECTION).doc(tokenId(token)).set({
      enabled:false, disabledAt:FieldValue.serverTimestamp(), updatedAt:FieldValue.serverTimestamp(),
    }, { merge:true });
    return NextResponse.json({ ok:true });
  } catch (error) {
    console.error("[admin/push] unsubscribe", error);
    return NextResponse.json({ ok:false, error:"PUSH_UNSUBSCRIBE_FAILED" }, { status:500 });
  }
}
