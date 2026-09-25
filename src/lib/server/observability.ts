import { randomUUID } from "node:crypto";

type TraceDetails = Record<string, string | number | boolean | null | undefined>;

export type RouteTrace = {
  id: string;
  route: string;
  startedAt: number;
};

export function startRouteTrace(route: string): RouteTrace {
  return { id: randomUUID(), route, startedAt: Date.now() };
}

export function finishRouteTrace(
  trace: RouteTrace,
  outcome: "ok" | "degraded" | "error",
  details: TraceDetails = {},
) {
  const event = {
    schema: "dfl_observability_v1",
    traceId: trace.id,
    route: trace.route,
    outcome,
    durationMs: Date.now() - trace.startedAt,
    ...details,
  };
  const line = JSON.stringify(event);
  if (outcome === "error") console.error(line);
  else if (outcome === "degraded") console.warn(line);
  else console.info(line);
  return event;
}

export function errorCode(error: unknown) {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code?: unknown }).code ?? "unknown").slice(0, 80);
  }
  return error instanceof Error ? error.name : "unknown";
}
