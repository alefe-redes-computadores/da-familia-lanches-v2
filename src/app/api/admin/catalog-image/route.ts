import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/integration/server/adminAuth";
import { isAdminEmail } from "@/lib/adminAuthorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OWNER = process.env.DFL_GITHUB_OWNER?.trim() || "alefe-redes-computadores";
const REPO = process.env.DFL_GITHUB_REPO?.trim() || "da-familia-lanches-v2";
const BRANCH = process.env.DFL_GITHUB_BRANCH?.trim() || "main";
const TOKEN = process.env.DFL_GITHUB_TOKEN?.trim() || "";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/webp"]);

function safeStem(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56) || "produto";
}

function extension() { return "webp"; }

async function authenticate(request: NextRequest) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() || "";
  if (!bearer) return null;
  const decoded = await adminAuth.verifyIdToken(bearer, true);
  return isAdminEmail(decoded.email) ? decoded : null;
}

async function github(path: string, init?: RequestInit) {
  return fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
}

export async function POST(request: NextRequest) {
  try {
    const decoded = await authenticate(request);
    if (!decoded) return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 });
    if (!TOKEN) return NextResponse.json({ ok: false, error: "GITHUB_UPLOAD_NOT_CONFIGURED" }, { status: 503 });

    const form = await request.formData();
    const candidate = form.get("file");
    const productId = safeStem(String(form.get("productId") || "produto"));
    if (!(candidate instanceof File)) return NextResponse.json({ ok: false, error: "IMAGE_REQUIRED" }, { status: 400 });
    if (!ALLOWED.has(candidate.type)) return NextResponse.json({ ok: false, error: "IMAGE_TYPE_INVALID" }, { status: 415 });
    if (!candidate.size || candidate.size > MAX_BYTES) return NextResponse.json({ ok: false, error: "IMAGE_SIZE_INVALID" }, { status: 413 });

    const path = `public/img/catalog/${productId}.${extension()}`;
    const existing = await github(path);
    let sha: string | undefined;
    if (existing.ok) {
      const current = await existing.json() as { sha?: string };
      sha = current.sha;
    } else if (existing.status !== 404) {
      return NextResponse.json({ ok: false, error: "GITHUB_LOOKUP_FAILED" }, { status: 502 });
    }

    const bytes = Buffer.from(await candidate.arrayBuffer());
    const body = {
      message: `catalog: update image ${productId}`,
      content: bytes.toString("base64"),
      branch: BRANCH,
      ...(sha ? { sha } : {}),
    };

    const saved = await github(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!saved.ok) {
      const detail = await saved.text().catch(() => "");
      console.error("[catalog-image] github write failed", saved.status, detail.slice(0, 500));
      return NextResponse.json({ ok: false, error: "GITHUB_WRITE_FAILED" }, { status: 502 });
    }

    return NextResponse.json(
      { ok: true, path: `/img/catalog/${productId}.${extension()}` },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[api/admin/catalog-image]", error);
    return NextResponse.json({ ok: false, error: "CATALOG_IMAGE_UPLOAD_FAILED" }, { status: 500 });
  }
}
