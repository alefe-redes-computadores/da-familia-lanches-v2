/** Site -> Entregas R254 Gate 5 bridge. Only for protected S2S homologation.
 * Never enables tracking customers, issues links or reads order data.
 */
import 'server-only';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const BRIDGE_PATH = '/api/integration/tracking/v1/bridge' as const;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const HEX = /^[a-f0-9]{64}$/;
const ID = /^[A-Za-z0-9_-]{4,64}$/;
const KID = /^[A-Za-z0-9_-]{3,24}$/;
const CHALLENGE = /^[A-Za-z0-9_-]{32,96}$/;
const NONCE = /^[A-Za-z0-9_-]{20,90}$/;
const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
const exact = (v: unknown, names: readonly string[]): v is Record<string,unknown> =>
  Boolean(v && typeof v === 'object' && !Array.isArray(v) &&
    Object.keys(v).length === names.length && names.every(k => Object.prototype.hasOwnProperty.call(v,k)));

export interface BridgeConfig {
  origin: string;
  tenant: string;
  kid: string;
  secret: string;
  host: string;
  ownerUid: string;
}

/** OFF by default. Intentionally independent of the customer tracking feature flag. */
export function bridgeConfiguration(): BridgeConfig | null {
  if (process.env.DFL_SITE_TRACKING_BRIDGE_PROBE_ENABLED !== '1') return null;
  const raw = process.env.DFL_ENTREGAS_TRACKING_ORIGIN || '';
  const tenant = process.env.DFL_TRACKING_TENANT_ID || '';
  const kid = process.env.DFL_TRACKING_S2S_KID || '';
  const secret = process.env.DFL_TRACKING_S2S_SECRET || '';
  const host = process.env.DFL_SITE_TRACKING_PUBLIC_HOST || '';
  const ownerUid = process.env.DFL_SITE_TRACKING_BRIDGE_OWNER_UID || '';
  if (!ID.test(tenant) || !KID.test(kid) || secret.length < 32 || secret.length > 512 ||
    !/^[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/.test(host) || host.length > 253 ||
    ownerUid.length < 6 || ownerUid.length > 128 || /\s/.test(ownerUid)) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== url.hostname ||
        !url.hostname.includes('.') || url.username || url.password || url.pathname !== '/' ||
        url.search || url.hash || url.port || url.origin === `https://${host}`) return null;
    return {origin:url.origin, tenant,kid,secret,host,ownerUid};
  } catch { return null; }
}

export function bridgeRequest(config: BridgeConfig, input?: {challenge?: string; nonce?: string; timestamp?: string}) {
  const challenge = input?.challenge ?? randomBytes(32).toString('base64url');
  const nonce = input?.nonce ?? randomBytes(24).toString('base64url');
  const timestamp = input?.timestamp ?? new Date().toISOString();
  if (!CHALLENGE.test(challenge) || !NONCE.test(nonce) || !UTC.test(timestamp) ||
      !Number.isFinite(Date.parse(timestamp)) || !ID.test(config.tenant) || !KID.test(config.kid) ||
      config.secret.length < 32 || config.secret.length > 512) throw Error('BRIDGE_INVALID_CONFIGURATION');
  const body = JSON.stringify({contract:'dfl.tracking.bridge',version:1,action:'probe',challenge});
  const canonical = ['POST',BRIDGE_PATH,sha(body),timestamp,nonce,config.kid,config.tenant].join('\n');
  const signature = createHmac('sha256', config.secret).update(canonical).digest('hex');
  return {body, challenge, nonce, headers:{
    'content-type':'application/json','accept':'application/json',
    'x-dfl-tracking-timestamp':timestamp,'x-dfl-tracking-nonce':nonce,
    'x-dfl-tracking-kid':config.kid,'x-dfl-tracking-signature':signature,
  }};
}

export function verifyBridgeProof(config: BridgeConfig, request: ReturnType<typeof bridgeRequest>, raw: unknown, now = Date.now()) {
  if (!exact(raw,['contract','version','status','challenge_hash','server_time','proof'])) return false;
  if (raw.contract !== 'dfl.tracking.bridge' || raw.version !== 1 || raw.status !== 'reachable' ||
      typeof raw.challenge_hash !== 'string' || !HEX.test(raw.challenge_hash) ||
      typeof raw.proof !== 'string' || !HEX.test(raw.proof) ||
      typeof raw.server_time !== 'string' || !UTC.test(raw.server_time) ||
      !Number.isFinite(Date.parse(raw.server_time)) ||
      Math.abs(now-Date.parse(raw.server_time)) > 120_000) return false;
  const expectedHash = sha(request.challenge);
  const canonical = ['DFL_TRACKING_BRIDGE_PROOF_V1',BRIDGE_PATH,expectedHash,request.nonce,
      raw.server_time,config.tenant,config.kid].join('\n');
  const expected = createHmac('sha256',config.secret).update(canonical).digest();
  return timingSafeEqual(Buffer.from(raw.challenge_hash,'hex'),Buffer.from(expectedHash,'hex')) &&
    timingSafeEqual(Buffer.from(raw.proof,'hex'),expected);
}

export type BridgeResult = {connected:boolean; public_access_granted:false; messages_sent:false};
export async function probeEntregasBridge(config: BridgeConfig, transport: typeof fetch = fetch): Promise<BridgeResult> {
  const denied: BridgeResult = {connected:false,public_access_granted:false,messages_sent:false};
  const request = bridgeRequest(config);
  // Only the separately deployed, Vercel-protected homologation may use this
  // server-only automation bypass. Never forward it to a caller-selected host.
  let outgoingHeaders: Record<string, string> = request.headers;
  if (process.env.NEXT_PUBLIC_DFL_TRACKING_HOMOLOGATION === '1') {
    const upstreamBypass = process.env.DFL_SITE_TRACKING_UPSTREAM_BYPASS || '';
    if (config.origin !== 'https://dfl-entregas-tracking-hml.vercel.app' ||
        config.host !== 'dfl-site-tracking-hml.vercel.app' ||
        !/^[A-Za-z0-9]{32}$/.test(upstreamBypass)) return denied;
    outgoingHeaders = {...request.headers, 'x-vercel-protection-bypass':upstreamBypass};
  }
  try {
    const response = await transport(config.origin + BRIDGE_PATH, {
      method:'POST',body:request.body,headers:outgoingHeaders,
      cache:'no-store',redirect:'error',credentials:'omit',signal:AbortSignal.timeout(8000),
    });
    if (response.status !== 200 || !(response.headers.get('content-type') || '').toLowerCase().includes('application/json')) return denied;
    const raw = await response.text();
    if (raw.length < 2 || raw.length > 2048) return denied;
    const body: unknown = JSON.parse(raw);
    return {connected:verifyBridgeProof(config,request,body),public_access_granted:false,messages_sent:false};
  } catch { return denied; } // Never log challenge, tokens, tenant, signing material or remote bodies.
}
