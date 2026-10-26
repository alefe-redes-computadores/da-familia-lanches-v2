import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// R8: provider isolated behind server-only key and a disabled-by-default flag.
// This endpoint ONLY suggests streets. It never determines coverage or delivery prices.
const jsonHeaders = { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" };
const json = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers: jsonHeaders });
const normalized = (v: unknown) => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const safePart = (v: unknown, max: number) => typeof v === "string" && v.trim().length <= max && !/[<>\x00-\x1f]/.test(v) ? v.trim() : "";
const buckets = new Map<string, { start: number; count: number }>();

export async function POST(request: NextRequest) {
  if (process.env.GEOAPIFY_STREET_ENABLED !== "true") return json({ ok: false, code: "STREET_SEARCH_DISABLED", suggestions: [] }, 503);
  const key = process.env.GEOAPIFY_API_KEY;
  if (!key) return json({ ok: false, code: "STREET_SEARCH_UNAVAILABLE", suggestions: [] }, 503);
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return json({ ok: false, code: "ORIGIN_DENIED", suggestions: [] }, 403);
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 320) return json({ ok: false, code: "INPUT_INVALID", suggestions: [] }, 400);
  let data: unknown;
  try { const raw = await request.text(); if (raw.length > 320) throw new Error("invalid"); data = JSON.parse(raw); }
  catch { return json({ ok: false, code: "INPUT_INVALID", suggestions: [] }, 400); }
  if (!data || typeof data !== "object" || Array.isArray(data)) return json({ ok: false, code: "INPUT_INVALID", suggestions: [] }, 400);
  const payload = data as Record<string, unknown>;
  const street = safePart(payload.street, 90), district = safePart(payload.district, 90);
  if (street.length < 3 || district.length < 3 || /\d{4,}/.test(street)) return json({ ok: false, code: "INPUT_INVALID", suggestions: [] }, 400);

  // Best-effort per-instance throttling. A shared edge/WAF quota is required before enabling publicly.
  const ip = request.headers.get("x-real-ip") || (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  const now = Date.now(), prev = buckets.get(ip);
  if (buckets.size > 2000) buckets.clear();
  const bucket = prev && now - prev.start < 60_000 ? prev : { start: now, count: 0 };
  bucket.count++; buckets.set(ip, bucket);
  if (bucket.count > 12) return json({ ok: false, code: "RATE_LIMITED", suggestions: [] }, 429);

  const endpoint = new URL("https://api.geoapify.com/v1/geocode/autocomplete");
  endpoint.searchParams.set("text", `${street}, ${district}, Patos de Minas, Minas Gerais, Brasil`);
  endpoint.searchParams.set("type", "street");
  endpoint.searchParams.set("filter", "countrycode:br");
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("limit", "5");
  endpoint.searchParams.set("lang", "pt");
  endpoint.searchParams.set("apiKey", key);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(endpoint, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) return json({ ok: false, code: response.status === 429 ? "STREET_SEARCH_BUSY" : "STREET_SEARCH_UNAVAILABLE", suggestions: [] }, 503);
    const data: unknown = await response.json();
    const results = data && typeof data === "object" && "results" in data && Array.isArray(data.results) ? data.results : [];
    const seen = new Set<string>();
    const suggestions = results.flatMap((item: unknown) => {
      if (!item || typeof item !== "object") return [];
      const record = item as Record<string, unknown>;
      const name = safePart(record.street, 120);
      const city = normalized(record.city);
      const state = normalized(record.state);
      if (!name || city !== "patos de minas" || (state !== "minas gerais" && normalized(record.state_code) !== "mg") || normalized(record.country_code) !== "br") return [];
      const unique = normalized(name);
      if (seen.has(unique)) return [];
      seen.add(unique);
      return [{ name, city: "Patos de Minas", state: "MG" }];
    }).slice(0, 5);
    return json({ ok: true, suggestions });
  } catch { return json({ ok: false, code: "STREET_SEARCH_UNAVAILABLE", suggestions: [] }, 503); }
  finally { clearTimeout(timer); }
}
