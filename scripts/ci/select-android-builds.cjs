'use strict';
/** Release selector: no dependency, no data mutations, no network calls. */
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

function scopeOf(path) {
  const p=path.replaceAll('\\','/');
  if (!p) return 'none';
  if (/^(?:docs\/|\.github\/ISSUE_TEMPLATE\/|README(?:\.|$)|.*\.(?:md|txt)$)/i.test(p)) return 'none';
  if (/^android-admin\/app\/(?:src\/main\/(?:java\/.*\/UpdateActivity\.java|res\/xml\/dfl_update_paths\.xml|AndroidManifest\.xml)|build\.gradle)/.test(p)) return 'both';
  if (/^(?:android-admin\/|src\/app\/admin\/|src\/components\/admin\/|src\/hooks\/useAdmin|src\/lib\/admin|src\/app\/api\/admin\/|public\/admin[-.]|scripts\/generate-admin-android-assets\.py)/.test(p)) return 'admin';
  if (/^(?:src\/app\/\.well-known\/|\.github\/workflows\/build-admin-android\.yml|src\/components\/layout\/|src\/lib\/firebase\.|src\/lib\/integration\/)/.test(p)) return 'both';
  if (/^(?:android-cliente\/|scripts\/(?:prepare-client-android|verify-client-android-icons|client_android_runtime)\.py|public\/manifest\.json|public\/(?:icon-|apple-touch-icon|favicon)|src\/data\/)/.test(p)) return 'cliente';
  if (/^(?:src\/components\/|src\/app\/|src\/hooks\/|public\/)/.test(p)) return 'cliente';
  if (/^(?:scripts\/|\.github\/)/.test(p)) return 'none';
  // Unknown runtime/config: prefer conservative paired build.
  return 'both';
}
function classify(paths) {
  let admin=false,cliente=false;
  for (const path of paths) {
    const scope=scopeOf(path);
    if(scope==='admin'||scope==='both')admin=true;
    if(scope==='cliente'||scope==='both')cliente=true;
  }
  return {admin,cliente};
}
function select(mode, paths) {
  if(mode==='admin')return {admin:true,cliente:false};
  if(mode==='cliente')return {admin:false,cliente:true};
  if(mode==='ambos')return {admin:true,cliente:true};
  if(mode!=='automatico')throw Error('Modo APK invalido: '+mode);
  return classify(paths);
}
function gitChanged(base,head) {
  const sha=/^[0-9a-f]{40}$/i;
  if(!sha.test(head))throw Error('HEAD_SHA invalido');
  if(!sha.test(base)||/^0+$/.test(base)){
    // New branch and manual workflow: safest pair, not an empty build.
    return null;
  }
  const output=execFileSync('git',['diff','--name-only','-z',base,head],{encoding:'utf8'});
  return output.split('\0').filter(Boolean);
}
function main() {
  const env=process.env;
  const dispatch=env.EVENT_NAME==='workflow_dispatch';
  const mode=dispatch?(env.RELEASE_MODE||'ambos'):'automatico';
  let changed=[];
  let flags;
  if(mode!=='automatico')flags=select(mode,[]);
  else {
    changed=gitChanged(env.BASE_SHA||'',env.HEAD_SHA||'');
    flags=changed===null?{admin:true,cliente:true}:classify(changed);
  }
  const lines=[`admin=${flags.admin}`,`cliente=${flags.cliente}`];
  if(env.GITHUB_OUTPUT)fs.appendFileSync(env.GITHUB_OUTPUT,lines.join('\n')+'\n');
  console.log('DFL Android escopo:',JSON.stringify({mode,changed,flags}));
}
if(require.main===module)main();
module.exports={scopeOf,classify,select,gitChanged};
