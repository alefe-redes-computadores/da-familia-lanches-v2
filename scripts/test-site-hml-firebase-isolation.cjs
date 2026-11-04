'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const src = fs.readFileSync('src/lib/firebaseConfig.ts', 'utf8');
const entry = fs.readFileSync('src/lib/firebase.ts', 'utf8');
const code = ts.transpileModule(src, {compilerOptions: {module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022}}).outputText;
const env = {
  NEXT_PUBLIC_DFL_TRACKING_HOMOLOGATION: '1',
  NEXT_PUBLIC_FIREBASE_API_KEY: 'AIza' + 'A'.repeat(35),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'dfl-finance.firebaseapp.com',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'dfl-finance',
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'dfl-finance.firebasestorage.app',
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '726269935852',
  NEXT_PUBLIC_FIREBASE_APP_ID: '1:726269935852:web:628cd23152f0f3d1f6a5c9',
};
function evaluate(values){ const exports={}; vm.runInNewContext(code,{exports,process:{env:values}}); return exports.firebaseConfigForCurrentBuild(); }
const prod=evaluate({}); assert.equal(prod.projectId,'da-familia-lanches'); assert.equal(prod.appId,'1:106857147317:web:769c98aed26bb8fc9e87fc');
const test=evaluate(env); assert.equal(test.projectId,'dfl-finance'); assert.equal(test.appId,env.NEXT_PUBLIC_FIREBASE_APP_ID);
for(const key of ['NEXT_PUBLIC_FIREBASE_API_KEY','NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN','NEXT_PUBLIC_FIREBASE_PROJECT_ID','NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET','NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID','NEXT_PUBLIC_FIREBASE_APP_ID']) {
  const wrong={...env}; delete wrong[key]; assert.throws(()=>evaluate(wrong),/DFL_TRACKING_HML_FIREBASE_ISOLATION_REQUIRED/,`missing ${key}`);
}
for(const [key,value] of [['NEXT_PUBLIC_FIREBASE_PROJECT_ID','da-familia-lanches'],['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN','da-familia-lanches.firebaseapp.com'],['NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET','da-familia-lanches.appspot.com'],['NEXT_PUBLIC_FIREBASE_APP_ID','1:106857147317:web:769c98aed26bb8fc9e87fc'],['NEXT_PUBLIC_FIREBASE_API_KEY','bad']]) {
  assert.throws(()=>evaluate({...env,[key]:value}),/DFL_TRACKING_HML_FIREBASE_ISOLATION_REQUIRED/,`wrong ${key}`);
}
assert.match(entry,/firebaseConfigForCurrentBuild\(\)/);
assert.ok(!entry.includes('da-familia-lanches.firebaseapp.com'),'No baked production configuration in client SDK entry');
console.log('DFL HML Firebase isolation: 17 assertions PASS');
