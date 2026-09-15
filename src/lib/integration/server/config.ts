import "server-only";

const truthy = new Set(["1", "true", "yes", "on"]);

const clean = (value: string | undefined) => value?.trim() || undefined;

export interface RelayConfig {
  enabled: boolean;
  targetUrl?: string;
  signingSecret?: string;
  triggerSecret?: string;
  workerId: string;
  batchSize: number;
  maxAttempts: number;
  requestTimeoutMs: number;
  lockTimeoutMs: number;
}

const intEnv = (name: string, fallback: number, min: number, max: number) => {
  const raw = clean(process.env[name]);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} deve ser inteiro entre ${min} e ${max}.`);
  }
  return parsed;
};

export function getRelayConfig(): RelayConfig {
  return {
    enabled: truthy.has((clean(process.env.DFL_INTEGRATION_RELAY_ENABLED) || "false").toLowerCase()),
    targetUrl: clean(process.env.DFL_ENTREGAS_INTEGRATION_URL),
    signingSecret: clean(process.env.DFL_INTEGRATION_SIGNING_SECRET),
    triggerSecret: clean(process.env.DFL_RELAY_TRIGGER_SECRET),
    workerId: clean(process.env.DFL_RELAY_WORKER_ID) || `dfl-site-${process.env.VERCEL_REGION || "server"}`,
    batchSize: intEnv("DFL_RELAY_BATCH_SIZE", 10, 1, 25),
    maxAttempts: intEnv("DFL_RELAY_MAX_ATTEMPTS", 8, 1, 20),
    requestTimeoutMs: intEnv("DFL_RELAY_TIMEOUT_MS", 8000, 1000, 30000),
    lockTimeoutMs: intEnv("DFL_RELAY_LOCK_TIMEOUT_MS", 120000, 30000, 900000),
  };
}

export function assertRelayRuntimeReady(config = getRelayConfig()) {
  if (!config.enabled) throw new Error("DFL integration relay está desativado.");
  if (!config.targetUrl) throw new Error("DFL_ENTREGAS_INTEGRATION_URL não configurada.");
  if (!config.signingSecret) throw new Error("DFL_INTEGRATION_SIGNING_SECRET não configurado.");
  if (!config.triggerSecret) throw new Error("DFL_RELAY_TRIGGER_SECRET não configurado.");
  return config;
}
