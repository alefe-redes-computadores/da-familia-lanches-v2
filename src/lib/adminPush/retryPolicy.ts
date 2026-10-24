/** V87 R2: política pura (sem Firebase) de recuperação de envio FCM.
 * O FCM confirma aceitação da mensagem, não a exibição no aparelho.
 */
export const MAX_ADMIN_PUSH_ATTEMPTS = 6;
export const ADMIN_PUSH_MAX_AGE_MS = 60 * 60 * 1000;
export const ADMIN_PUSH_LEASE_MS = 90 * 1000;

export type AdminPushDispatchState = {
  status?: string;
  attemptCount?: number;
  nextAttemptAtMs?: number;
  leaseUntilMs?: number;
  firstSeenAtMs?: number;
};

export function retryDelayMs(attempt: number, noSubscribers = false): number {
  if (noSubscribers) return 120000;
  const retry = Math.max(1, Math.min(8, Math.floor(attempt)));
  return Math.min(120000, 15000 * 2 ** (retry - 1));
}

export function mayClaimAdminPush(state: AdminPushDispatchState | null, now: number) {
  if (!state) return { claim: true as const, reason: "new" as const };
  if (["sent", "dead_letter", "expired", "cancelled"].includes(state.status || "")) {
    return { claim: false as const, reason: "terminal" as const };
  }
  const age = now - (state.firstSeenAtMs || now);
  const tries = state.attemptCount || 0;
  if (age > ADMIN_PUSH_MAX_AGE_MS || tries >= MAX_ADMIN_PUSH_ATTEMPTS) {
    return { claim: false as const, reason: "expired" as const };
  }
  if (state.status === "processing" && (state.leaseUntilMs || 0) > now) {
    return { claim: false as const, reason: "leased" as const };
  }
  if ((state.status === "retry" || state.status === "no_subscribers") &&
      (state.nextAttemptAtMs || 0) > now) {
    return { claim: false as const, reason: "backoff" as const };
  }
  return { claim: true as const, reason: "recovery" as const };
}
