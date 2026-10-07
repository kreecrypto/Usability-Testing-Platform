// Auth URL enters through private stdin, never command arguments or a saved file.
import {chromium} from '@playwright/test';
import {spawn} from 'node:child_process';
const base=process.env.UTP_UI_QA_BASE_URL;
const allowed=new URL(base || 'http://invalid');
if(allowed.username || allowed.password || allowed.pathname!=='/' || allowed.search || allowed.hash || allowed.protocol!=='https:' || !/^usability-testing-platform-[a-z0-9]+\.vercel\.app$/.test(allowed.hostname)) throw new Error('Explicit UTP Preview required; Production is prohibited');
let input='',started=false;
const fail=()=>{console.error('Protected Preview QA failed; credentials and raw errors withheld');process.exit(1);};
function start(){
 if(started)return;started=true;process.stdin.pause();
 if(!input.trim())return fail();
 void run(input).catch(fail);
}
process.stdin.setEncoding('utf8');
process.stdin.on('data',chunk=>{
 input+=chunk;if(input.length>16384)return fail();
 if(input.includes('\n'))start();
});
process.stdin.once('end',start);
process.stdin.once('error',fail);
async function run(raw){
 const url=new URL(JSON.parse(raw).url);
 if(url.origin!==allowed.origin || !url.searchParams.has('_vercel_share') || url.username || url.password)throw new Error('Auth URL does not match selected Preview');
 const browser=await chromium.launch();
 const context=await browser.newContext();
 try{
  const response=await context.request.get(url.href);
  if(!response.ok())throw new Error('Preview authentication failed');
  const state=await context.storageState();
  const cookies=state.cookies.filter(c=>c.domain===allowed.hostname);
  if(!cookies.length)throw new Error('No origin-scoped access cookie');
  await browser.close();
  const child=spawn('npx',['playwright','test','-c','playwright.trial.config.ts',...process.argv.slice(2)],{stdio:'inherit',env:{...process.env,UTP_UI_QA_STORAGE_STATE:JSON.stringify({cookies,origins:[]})}});
  child.on('exit',code=>process.exit(code ?? 1));
 }finally{await browser.close();}
}
