/** MSG-M5: contrato puro, conservador e sem dependencia da camada Firebase. */
export type RetryCategory =
  | 'transient_network' | 'transient_service' | 'transient_rate_limit'
  | 'blocked_auth' | 'blocked_data' | 'blocked_config'
  | 'blocked_cancelled' | 'blocked_unsupported' | 'unknown';
export type RetryInput = {
  status: unknown; error: unknown; manualRetryCount: unknown;
  manualRetryAt: unknown; createdAt: unknown; now?: number;
};
export type RetryDecision = {
  category: RetryCategory;
  explanation: string;
  retryable: boolean;
  remaining: number;
  waitUntil: string | null;
  reason: 'allowed' | 'not_failed' | 'permanent' | 'limit_reached' | 'cooldown' | 'too_old';
};
export const MANUAL_RETRY_LIMIT = 2;
export const MANUAL_RETRY_COOLDOWN_MS = 2 * 60_000;
export const MANUAL_RETRY_MAX_AGE_MS = 48 * 60 * 60_000;

function timestamp(value: unknown): number | null {
  if (value && typeof value === 'object' && 'toMillis' in value &&
    typeof (value as {toMillis?:unknown}).toMillis === 'function') {
    try { const v = (value as {toMillis:()=>number}).toMillis(); return Number.isFinite(v)?v:null; }
    catch { return null; }
  }
  const n = typeof value === 'string' || typeof value === 'number'
    ? new Date(value).getTime() : NaN;
  return Number.isFinite(n) ? n : null;
}
export const manualRetryCount = (value: unknown) => Math.min(2, Math.max(0,
  Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : 0));

export function classifyFailure(value: unknown): { category: RetryCategory; explanation: string; transient: boolean } {
  const s = String(value ?? '').trim().toLowerCase().slice(0, 500);
  if (!s) return {category:'unknown',explanation:'A causa não foi registrada. Revisão técnica necessária.',transient:false};
  // Erro de autenticação, dados inválidos e bloqueios de negócio nunca serão reexecutados.
  if (/401|403|unauthoriz|forbidden|permission|invalid.signature|assinatura|token|credencial|jwt/.test(s))
    return {category:'blocked_auth',explanation:'Autorização ou credencial inválida. Corrija o acesso antes de enviar.',transient:false};
  if (/cancel|skipped_order_cancelled|opt.in|consent|sem permiss|suppressed|monotonic/.test(s))
    return {category:'blocked_cancelled',explanation:'Evento bloqueado por cancelamento, consentimento ou regra do pedido.',transient:false};
  if (/ev olution_not_configured|evolution_not_configured|not.configured|configuration_invalid|missing.secret|not configured|env.var/.test(s))
    return {category:'blocked_config',explanation:'Integração não configurada. Repetir não corrige configuração.',transient:false};
  if (/invalid|missing|sem dados|incomplet|phone|telefone|without|unsupported|not claimable|order_not_found/.test(s))
    return {category:'blocked_data',explanation:'Dados obrigatórios ou evento inválido. É necessário corrigir a origem.',transient:false};
  if (/429|rate.?limit|quota|too many|limite.de.requisi/.test(s))
    return {category:'transient_rate_limit',explanation:'O serviço atingiu um limite temporário. Aguarde antes de repetir.',transient:true};
  if (/timeout|timed out|abort|network|fetch.failed|socket|econn|dns|conex|offline/.test(s))
    return {category:'transient_network',explanation:'A rede ou o tempo de resposta falhou. Nova tentativa controlada é possível.',transient:true};
  if (/503|502|500|504|http_5\d\d|unavailable|temporar|service|worker.error/.test(s))
    return {category:'transient_service',explanation:'Serviço temporariamente indisponível. Nova tentativa controlada é possível.',transient:true};
  return {category:'unknown',explanation:'Falha ainda não classificada. Reenvio bloqueado para evitar duplicações.',transient:false};
}
export function evaluateManualRetry(input: RetryInput): RetryDecision {
  const failure=classifyFailure(input.error);
  const count=manualRetryCount(input.manualRetryCount);
  const remaining=MANUAL_RETRY_LIMIT-count;
  const status=String(input.status||'').trim().toLowerCase();
  const base={category:failure.category,explanation:failure.explanation,remaining,waitUntil:null as string|null};
  if(status!=='failed')return {...base,retryable:false,reason:'not_failed'};
  if(!failure.transient)return {...base,retryable:false,reason:'permanent'};
  if(count>=MANUAL_RETRY_LIMIT)return {...base,retryable:false,reason:'limit_reached'};
  const now=input.now??Date.now();
  const created=timestamp(input.createdAt);
  if(created===null||created>now+60_000||now-created>MANUAL_RETRY_MAX_AGE_MS)
    return {...base,retryable:false,reason:'too_old'};
  const previous=timestamp(input.manualRetryAt);
  if(previous!==null && now<previous+MANUAL_RETRY_COOLDOWN_MS)
    return {...base,retryable:false,waitUntil:new Date(previous+MANUAL_RETRY_COOLDOWN_MS).toISOString(),reason:'cooldown'};
  return {...base,retryable:true,reason:'allowed'};
}
