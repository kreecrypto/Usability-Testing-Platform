import {test,expect,type Page,type Route} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function scan(page:Page){const r=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();expect(r.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))).toEqual([]);}
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(r=>resolve=r);return {promise,resolve};}
const project=(id:string,w='B')=>({id,workspace_id:w,name:id,description:null,status:'active'});
const study=(id:string,p='BP2')=>({id,workspace_id:'B',project_id:p,title:id,description:null,status:'draft'});
const task=(id:string)=>({id,title:id,ordinal:1});
const snapshot={testId:'qa-test',testVersionId:'qa-version',versionNo:1,title:'Synthetic retry QA',description:null,target:{provider:'external_web',sourceUrl:'https://example.com',launchMode:'new_tab',embedUrl:null,liveEmbedUrl:null,startScreenId:null,instrumentation:'none'},tasks:[{id:'qa-task',ordinal:1,title:'คำสั่งตัวอย่าง',scenario:null,instruction:'ค้นหาข้อมูล',timeoutSeconds:null,postTaskQuestions:{}}]};
async function fulfill(route:Route,json:unknown){await route.fulfill({json}).catch(()=>{});}

for(const width of [1280,320,390])test(`Projects bootstrap retry and restricted state ${width}px`,async({page})=>{
 let status=503;
 await page.route('**/api/**',route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/auth/session')return route.fulfill({json:{user:{id:'synthetic'}}});
  if(path==='/api/workspaces')return route.fulfill({status,json:status===200?{workspaces:[]}:{error:'synthetic_error'}});
  return route.fulfill({status:503,json:{error:'unexpected_fixture_request'}});
 });
 await page.setViewportSize({width,height:844});await page.goto('/projects');
 await expect(page.getByRole('main').getByRole('alert')).toContainText('โหลดพื้นที่ทำงานไม่สำเร็จ');await expect(page.getByText('กำลังโหลดพื้นที่ทำงาน…')).toHaveCount(0);await scan(page);
 status=403;await page.getByRole('button',{name:'ลองอีกครั้ง',exact:true}).click();await expect(page.getByRole('main').getByRole('alert')).toContainText('ไม่มีสิทธิ์');await expect(page).toHaveURL(/\/projects$/);
 status=200;await page.getByRole('button',{name:'ลองอีกครั้ง',exact:true}).click();await expect(page.getByRole('button',{name:'สร้างพื้นที่ทำงาน',exact:true})).toBeVisible();await scan(page);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('Projects authentication expiry redirects; network failure remains retryable',async({page})=>{
 await page.route('**/api/**',route=>route.abort());await page.goto('/projects');await expect(page.getByRole('main').getByRole('alert')).toContainText('โหลดพื้นที่ทำงานไม่สำเร็จ');
 await page.unroute('**/api/**');await page.route('**/api/**',route=>route.fulfill({status:401,json:{error:'authentication_required'}}));
 await page.getByRole('button',{name:'ลองอีกครั้ง',exact:true}).click();await expect(page).toHaveURL(/\/login/);
});
test('out-of-order Workspace, Project and Task reads cannot restore old context or published links',async({page})=>{
 const oldWorkspace=deferred(),oldTests=deferred(),oldTasks=deferred();let aRequests=0,failProject=false;
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url()),path=url.pathname;
  if(path==='/api/auth/session')return fulfill(route,{user:{id:'synthetic'}});
  if(path==='/api/workspaces')return fulfill(route,{workspaces:[{id:'A',name:'Workspace A',slug:'a'},{id:'B',name:'Workspace B',slug:'b'}]});
  if(path==='/api/projects'){
   if(url.searchParams.get('workspaceId')==='A'){aRequests++;if(aRequests===1)await oldWorkspace.promise;return fulfill(route,{projects:[project('AP','A')]});}
   return fulfill(route,{projects:[project('BP1'),project('BP2')]});
  }
  if(path==='/api/tests'){
   const p=url.searchParams.get('projectId');
   if(failProject&&p==='BP1')return route.fulfill({status:503,json:{error:'network_fixture'}});
   if(p==='BP1'){await oldTests.promise;return fulfill(route,{tests:[study('OLD-test','BP1')]});}
   return fulfill(route,{tests:[study('T1'),study('T2')]});
  }
  if(path==='/api/tests/T1/tasks'){await oldTasks.promise;return fulfill(route,{tasks:[task('OLD-task')]});}
  if(path.endsWith('/tasks'))return fulfill(route,{tasks:[task('T2-task')]});
  if(path.endsWith('/publish'))return fulfill(route,{preview:{testVersionId:'qa-published'}});
  return route.fulfill({status:503,json:{error:'unexpected_fixture_request'}});
 });
 await page.goto('/projects');await expect(page.getByLabel('พื้นที่ทำงาน',{exact:true})).toBeVisible();
 await expect.poll(()=>aRequests).toBe(1);await page.getByLabel('พื้นที่ทำงาน',{exact:true}).selectOption('B');
 await expect(page.getByLabel('โปรเจกต์',{exact:true})).toBeEnabled();oldWorkspace.resolve();
 await page.getByLabel('โปรเจกต์',{exact:true}).selectOption('BP2');
 await expect(page.getByLabel('แบบทดสอบ',{exact:true})).toBeEnabled();oldTests.resolve();
 await page.getByLabel('แบบทดสอบ',{exact:true}).selectOption('T2');
 await expect(page.getByText('T2-task',{exact:false})).toBeVisible();oldTasks.resolve();
 await expect(page.getByLabel('โปรเจกต์',{exact:true})).toHaveValue('BP2');await expect(page.getByLabel('แบบทดสอบ',{exact:true})).toHaveValue('T2');
 await expect(page.getByText('OLD-task')).toHaveCount(0);await expect(page.locator('option',{hasText:'OLD-test'})).toHaveCount(0);await expect(page.locator('option',{hasText:'AP'})).toHaveCount(0);
 await page.getByRole('button',{name:'เผยแพร่เวอร์ชันนี้',exact:true}).click();await expect(page.getByRole('link',{name:'/t/qa-published',exact:true})).toBeVisible();
 failProject=true;await page.getByLabel('โปรเจกต์',{exact:true}).selectOption('BP1');await expect(page.getByRole('main').getByRole('alert')).toContainText('โหลดแบบทดสอบไม่สำเร็จ');
 await expect(page.getByRole('link',{name:'/t/qa-published',exact:true})).toHaveCount(0);await expect(page.getByText('T2-task',{exact:false})).toHaveCount(0);await expect(page.getByRole('button',{name:'เผยแพร่เวอร์ชันนี้',exact:true})).toBeDisabled();
 failProject=false;await page.getByRole('button',{name:'ลองโหลดแบบทดสอบอีกครั้ง',exact:true}).click();await expect(page.getByLabel('แบบทดสอบ',{exact:true})).toBeEnabled();await scan(page);
});
for(const failure of ['network','500','malformed','bad-shape','render-shape'] as const)test(`Participant ${failure} retries without session creation or premature events`,async({page})=>{
 let failing=true;const writes:string[]=[];
 await page.route('**/api/**',route=>{
  const r=route.request(),path=new URL(r.url()).pathname;if(r.method()==='POST')writes.push(path);
  if(path==='/api/public/tests/qa-version'){
   if(failing){if(failure==='network')return route.abort();if(failure==='500')return route.fulfill({status:500,json:{error:'data_request_failed'}});if(failure==='malformed')return route.fulfill({body:'broken',contentType:'application/json'});return route.fulfill({json:failure==='render-shape'?{test:{...snapshot,tasks:[{...snapshot.tasks[0],instruction:{bad:true}}]}}:{test:{}}});}
   return route.fulfill({json:{test:snapshot}});
  }
  return route.fulfill({status:401,json:{error:'no_session'}});
 });
 await page.route('**/v1/events',()=>{throw new Error('No preconsent events permitted');});
 await page.goto('/t/qa-version');await expect(page.getByRole('heading',{name:'ยังโหลดแบบทดสอบไม่ได้'})).toBeVisible();await scan(page);
 failing=false;await page.getByRole('button',{name:'ลองอีกครั้ง',exact:true}).click();await expect(page.getByRole('button',{name:'ยินยอมและเริ่ม',exact:true})).toBeVisible();expect(writes).toEqual([]);
});
for(const [status,error] of [[400,'invalid_version_id'],[404,'published_test_not_found']] as const)test(`Participant invalid ${status} stays distinct from retryable failure`,async({page})=>{
 await page.route('**/api/**',route=>route.fulfill({status,json:{error}}));await page.goto('/t/qa-version');await expect(page.getByRole('heading',{name:'แบบทดสอบนี้ใช้งานไม่ได้'})).toBeVisible();await expect(page.getByRole('button',{name:'ลองอีกครั้ง',exact:true})).toHaveCount(0);
});
test('snapshot retry resumes existing session and delivers the original pending event once',async({page})=>{
 const pending={schemaVersion:2,eventId:'qa-original-event',idempotencyKey:'qa-original-key',eventType:'prototype_click',occurredAt:'2026-10-08T00:00:00Z',sessionId:'qa-session',participantId:'qa-participant',testId:'qa-test',testVersionId:'qa-version',taskId:'qa-task',eventLayer:'raw',source:'prototype_adapter',sequence:7,metadata:{}};
 const key='utp:event-outbox:v1:qa-session';
 await page.addInitScript(({key,pending,origin})=>{if(location.origin===origin&&!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify([pending]));},{key,pending,origin:process.env.UTP_UI_QA_BASE_URL||'http://127.0.0.1:3033'});
 let failing=true;const events:unknown[]=[];const writes:string[]=[];
 await page.route('**/api/**',route=>{
  const r=route.request(),path=new URL(r.url()).pathname;if(r.method()==='POST')writes.push(path);
  if(path==='/api/public/tests/qa-version')return route.fulfill({status:failing?503:200,json:failing?{error:'unavailable'}:{test:snapshot}});
  if(path.endsWith('/state'))return route.fulfill({json:{context:{sessionId:'qa-session',participantId:'qa-participant',testId:'qa-test',testVersionId:'qa-version'},state:{sessionId:'qa-session',status:'active',completedAt:null,lastSequence:6,taskStates:[{taskId:'qa-task',outcome:null,startedAt:'2026-10-08T00:00:00Z',endedAt:null}]}}});
  if(path.endsWith('/token'))return route.fulfill({json:{ingestionToken:'synthetic-only',ingestionTokenExpiresAt:new Date(Date.now()+300000).toISOString()}});
  return route.fulfill({status:503,json:{error:'unexpected_write'}});
 });
 await page.route('**/v1/events',route=>{events.push(...route.request().postDataJSON().events);return route.fulfill({json:{accepted:true}});});
 await page.goto('/t/qa-version');await expect(page.getByRole('heading',{name:'ยังโหลดแบบทดสอบไม่ได้'})).toBeVisible();
 expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),key)).toEqual([pending]);expect(events).toEqual([]);
 failing=false;await page.getByRole('button',{name:'ลองอีกครั้ง',exact:true}).click();await expect(page.getByRole('button',{name:'ทำงานนี้ต่อไม่ได้',exact:true})).toBeVisible();
 expect(events).toEqual([pending]);expect(writes).toEqual(['/api/public/sessions/token']);expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBeNull();
});
