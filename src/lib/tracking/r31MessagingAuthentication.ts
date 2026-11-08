/** R31 — sign Site->Supabase P9 with TWO existing independent secrets.
 * No raw credential is transmitted; all signatures are domain-separated.
 * This file is server-only and never writes or logs a token or payload.
 */
import 'server-only';
import {createHmac} from 'node:crypto';
const CONTEXT='DFL-P9-R31';
export type R31Credentials={ingestToken:string;workerToken:string};
export function r31SignedHeaders(body:string,credentials:R31Credentials,now=Date.now()):Record<string,string> {
  if(typeof body!=='string'||body.length<15||body.length>2048||
    credentials.ingestToken.length<24||credentials.workerToken.length<24||
    credentials.ingestToken===credentials.workerToken||!Number.isFinite(now))throw new Error('R31_INVALID_SIGNING_INPUT');
  const stamp=String(Math.trunc(now));
  const message=`${CONTEXT}\n${stamp}\n${body}`;
  return {
    'x-dfl-p9-timestamp':stamp,
    'x-dfl-p9-signature-a':createHmac('sha256',credentials.ingestToken).update(message).digest('hex'),
    'x-dfl-p9-signature-b':createHmac('sha256',credentials.workerToken).update(message).digest('hex'),
  };
}
