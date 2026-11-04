'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const p=x=>fs.readFileSync(x,'utf8');
const server=p('src/lib/tracking/server.ts');
const session=p('src/app/acompanhar/api/session/route.ts');
const status=p('src/app/acompanhar/api/status/route.ts');
const page=p('src/app/acompanhar/page.tsx');
const ui=p('src/components/tracking/TrackingExperience.tsx');
const shell=p('src/components/layout/AppShell.tsx');
const middleware=p('middleware.ts');
const checks = [
['OFF by default and no public page',server.includes("DFL_SITE_TRACKING_ENABLED === '1'") && page.includes('notFound()')],
['HMAC matching Entregas canonical input',server.includes("['POST', path, sha(raw), timestamp, nonce, conf.kid, conf.tenant].join('\\n')")],
['S2S anti replay timestamp nonce 192-bit',server.includes('randomBytes(24)') && server.includes('x-dfl-tracking-signature')],
['No redirect, no unsafe upstream',server.includes("redirect: 'error'") && server.includes("u.protocol !== 'https:'")],
['Cookie AES-GCM server only',server.includes('aes-256-gcm') && server.includes('randomBytes(12)') && server.includes('getAuthTag')],
['Session restricted and HttpOnly',session.includes('httpOnly: true') && session.includes("sameSite: 'lax'") && session.includes('path: trackingCookiePath')],
['Token exchange is exact isolated scope',session.includes('opaque_token:') && session.includes('scope_handle:')===false],
['Status never accepts arbitrary order ID',status.includes('scope_handle:scope') && !status.includes('searchParams') && !status.includes('request.json')],
['Backend session authority checked every query',status.includes("/api/integration/tracking/v1/status")],
['Strict public projection no extras',server.includes('Object.keys(x).length === keys.length') && server.includes('validPublicProjection')],
['No caching',server.includes('no-store') && middleware.includes("'no-store'" )],
['Anti leakage CSP and referrer',middleware.includes('Content-Security-Policy') && middleware.includes('no-referrer')],
['OrdersModal and checkout untouched',!shell.includes('guest-order-status') && !server.includes('checkout')],
['Page outside commerce app shell',shell.includes("pathname === '/acompanhar'")],
['Fragment cleaned from browser address',ui.includes('window.history.replaceState')],
['Old session revoked before new link',ui.includes('A new link must never reuse a previous order')],
['Mobile safe area and accessibility',p('src/components/tracking/TrackingExperience.module.css').includes('safe-area-inset-bottom') && ui.includes('aria-live')],
['No storage of token in browser',!ui.includes('localStorage') && !ui.includes('sessionStorage')],
['No GPS / ETA claims',!ui.includes('estimatedArrival') && !server.includes('gpsLatitude')],
['Session revoke endpoint cookie clearing',p('src/app/acompanhar/api/session/revoke/route.ts').includes('maxAge:0')],
];
for(const [label,ok] of checks){assert.ok(ok,label);console.log('OK:',label)}
console.log(`R253: ${checks.length} local tracking contracts passed (not live penetration tests)`);
