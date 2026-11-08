/** R26 — pure DFL 360 operations policy. No PII, credentials, tokens or I/O. */
export type R26Lane = 'messages'|'acceptances'|'tracking_links';
export type R26Counts = {
  pending:number; processing:number; acknowledged:number; review:number;
  suppressed:number; queued:number; other:number;
};
export type R26LaneSummary = { available:boolean; sample:number; truncated:boolean; counts:R26Counts };
export type R26OperationsFlags = {
  publicTracking:boolean; siteAcceptance:boolean; initialIssue:boolean;
  providerCertified:boolean; manualMessaging:boolean; messageWorkerConfigured:boolean;
};
export const R26_SAMPLE_LIMIT=24;
const allowed=(s:unknown)=>typeof s==='string'?s.trim().toLowerCase():'';
const fresh=():R26Counts=>({pending:0,processing:0,acknowledged:0,review:0,suppressed:0,queued:0,other:0});
export function r26StatusBucket(lane:R26Lane,status:unknown):keyof R26Counts {
  const s=allowed(status);
  if(lane==='messages') {
    if(s==='pending')return 'pending';
    if(s==='processing')return 'processing';
    if(s==='queued')return 'queued';
    if(s==='failed')return 'review';
    if(s==='suppressed')return 'suppressed';
    return 'other';
  }
  if(lane==='acceptances') {
    if(s==='pending')return 'pending';
    if(s==='processing')return 'processing';
    if(s==='acknowledged')return 'acknowledged';
    if(s==='blocked')return 'review';
    return 'other';
  }
  if(s==='reserved'||s==='issuing'||s==='issued_pending_provider')return 'processing';
  if(s==='provider_accepted')return 'acknowledged';
  if(s==='review_required')return 'review';
  return 'other';
}
export function r26Summarize(lane:R26Lane,raw:unknown[],limit=R26_SAMPLE_LIMIT):R26LaneSummary {
  const counts=fresh();
  const safe=raw.slice(0,Math.max(0,Math.min(100,Math.trunc(limit))));
  for(const item of safe){
    const doc=item&&typeof item==='object'&&!Array.isArray(item)
      ? item as Record<string,unknown>:{};
    counts[r26StatusBucket(lane,doc.status)]++;
  }
  return {available:true,sample:safe.length,truncated:safe.length>=limit,counts};
}
export function r26Unavailable():R26LaneSummary {
  return {available:false,sample:0,truncated:false,counts:fresh()};
}
export function r26Flags(env:Record<string,string|undefined>):R26OperationsFlags {
  return {
    publicTracking:env.DFL_SITE_TRACKING_ENABLED==='1',
    siteAcceptance:env.DFL_SITE_TRACKING_AUTO_ACCEPT_ENABLED==='1',
    initialIssue:env.DFL_SITE_TRACKING_AUTO_ISSUE_ENABLED==='1',
    providerCertified:env.DFL_SITE_TRACKING_AUTO_PROVIDER_CERTIFIED==='1',
    manualMessaging:env.DFL_MANUAL_MESSAGING_ENABLED==='true',
    messageWorkerConfigured:Boolean(env.DFL_MESSAGING_WORKER_URL?.trim()&&env.DFL_MESSAGING_WORKER_TOKEN?.trim()),
  };
}
export function r26AutoSiteConfigured(flags:R26OperationsFlags) {
  return flags.publicTracking&&flags.siteAcceptance&&flags.initialIssue&&flags.providerCertified;
}
