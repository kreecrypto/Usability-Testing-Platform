import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('protected Preview helper fails invalid/empty EOF with or without newline instead of skipping QA',()=>{
 for(const input of ['','{}','{}\n',JSON.stringify({url:'https://usability-testing-platform-qa.vercel.app'})]){
  const r=spawnSync(process.execPath,['scripts/qa/protected-preview.mjs'],{env:{...process.env,UTP_UI_QA_BASE_URL:'https://usability-testing-platform-qa.vercel.app'},input,encoding:'utf8',timeout:5000});
  assert.equal(r.status,1);assert.match(r.stderr,/Protected Preview QA failed/);assert.equal(r.stdout,'');
 }
});
test('helper rejects Production or unrelated origins before authentication',()=>{
 for(const target of ['https://usability-testing-platform.vercel.app','https://example.com']){
  const r=spawnSync(process.execPath,['scripts/qa/protected-preview.mjs'],{env:{...process.env,UTP_UI_QA_BASE_URL:target},input:'{}',encoding:'utf8',timeout:5000});
  assert.equal(r.status,1);assert.equal(r.stdout,'');
 }
});
