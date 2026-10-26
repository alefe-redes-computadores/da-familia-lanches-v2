import { auth } from "@/lib/firebase";

export type AttemptResolution =
  | { outcome: "found"; orderId: string }
  | { outcome: "not_found" | "unknown" };

/** A consulta não cria pedidos. 'not_found' não autoriza nova tentativa paralela. */
export async function resolveCheckoutAttempt(clientRequestId: string, mode: "guest" | "google"): Promise<AttemptResolution> {
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(clientRequestId)) return { outcome: "unknown" };
  const user = auth.currentUser;
  if (mode === "google" && !user) return { outcome: "unknown" };
  if (mode === "guest" && user) return { outcome: "unknown" };
  try {
    const token = mode === "google" ? await user!.getIdToken() : "";
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 7000);
    try {
      const response = await fetch("/api/orders/resolve", {
        method: "POST",
        headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ clientRequestId, mode }),
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) return { outcome: "unknown" };
      const data: unknown = await response.json();
      if (!data || typeof data !== "object") return { outcome: "unknown" };
      const result = data as Record<string, unknown>;
      if (result.outcome === "found" && typeof result.orderId === "string" && /^site_[a-f0-9]{40}$/.test(result.orderId)) {
        return { outcome: "found", orderId: result.orderId };
      }
      return result.outcome === "not_found" ? { outcome: "not_found" } : { outcome: "unknown" };
    } finally { window.clearTimeout(timeout); }
  } catch { return { outcome: "unknown" }; }
}
