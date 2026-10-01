import { after, NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/integration/server/adminAuth";
import { isAdminEmail } from "@/lib/adminAuthorization";
import { drainIntegrationOutboxEvent } from "@/lib/integration/server/relay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authorize(req: NextRequest) {
  const token =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || "";

  if (!token) return false;

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return Boolean(
      decoded.email &&
      isAdminEmail(decoded.email)
    );
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!(await authorize(req))) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const body = await req
    .json()
    .catch(() => ({})) as {
      eventId?: unknown;
    };

  const eventId = String(body.eventId ?? "").trim();

  if (!eventId) {
    return NextResponse.json(
      { ok: false, error: "eventId ausente" },
      { status: 400 },
    );
  }

  after(async () => {
    try {
      await drainIntegrationOutboxEvent(eventId);
    } catch (error) {
      console.error(
        "[admin/orders/relay] targeted fast-lane failed",
        { eventId, error },
      );
    }
  });

  return NextResponse.json(
    {
      ok: true,
      accepted: true,
      eventId,
    },
    { status: 202 },
  );
}
