import assert from 'node:assert/strict';
import test from 'node:test';
import {createProjectTestCrud,CrudValidationError,CrudProviderError,type TestRow} from '../src/lib/project-test-crud.ts';
import {createTestOverviewReader} from '../src/lib/test-overview.ts';
const workspaceId='10000000-0000-4000-8000-000000000001';
const projectId='20000000-0000-4000-8000-000000000001';
const testId='30000000-0000-4000-8000-000000000001';
const row={id:testId,workspace_id:workspaceId,project_id:projectId} as TestRow;
const token=`e30.${Buffer.from(JSON.stringify({sub:'researcher'})).toString('base64url')}.signature`;

test('pagination, literal search and exact count stay inside caller workspace/project',async()=>{
 let called=false;
 const crud=createProjectTestCrud({supabaseUrl:'https://db.example',anonKey:'public',accessToken:token,fetchImpl:async(input,init)=>{
  called=true;const url=new URL(String(input));const h=new Headers(init?.headers);
  assert.equal(url.searchParams.get('workspace_id'),`eq.${workspaceId}`);
  assert.equal(url.searchParams.get('project_id'),`eq.${projectId}`);
  assert.equal(url.searchParams.get('offset'),'20');assert.equal(url.searchParams.get('limit'),'20');
  assert.equal(url.searchParams.get('status'),'eq.published');
  assert.equal(url.searchParams.get('title'),'ilike."%quote\\"),or(\\%\\_\\*%"');
  assert.equal(h.get('authorization'),`Bearer ${token}`);assert.equal(h.get('prefer'),'count=exact');
  return Response.json([row],{headers:{'content-range':'20-20/21'}});
 }});
 const result=await crud.pageTests(workspaceId,{projectId,page:2,status:'published',search:'quote"),or(%_*'});
 assert.ok(called);assert.deepEqual(result.pagination,{page:2,pageSize:20,total:21,totalPages:2});
});
test('invalid paging/status rejects before DB; absent exact total cannot become zero',async()=>{
 let calls=0;const crud=createProjectTestCrud({supabaseUrl:'https://db.example',anonKey:'public',accessToken:token,fetchImpl:async()=>{calls++;return Response.json([]);}});
 for(const options of [{page:0},{page:1e20},{page:1.2},{pageSize:101},{status:'invalid'}]) await assert.rejects(()=>crud.pageProjects(workspaceId,options),CrudValidationError);
 assert.equal(calls,0);await assert.rejects(()=>crud.pageProjects(workspaceId),CrudProviderError);
});
test('version history continues beyond server cap and scopes every page to the test',async()=>{
 let calls=0;const reader=createTestOverviewReader({url:'https://db.example',key:'public',token,fetchImpl:async(input)=>{
  const url=new URL(String(input));assert.equal(url.searchParams.get('test_id'),`eq.${testId}`);assert.equal(url.searchParams.get('workspace_id'),`eq.${workspaceId}`);
  const offset=url.searchParams.get('offset');calls++;
  return Response.json([{id:offset==='0'?'v2':'v1',version_no:offset==='0'?2:1,lifecycle_status:'published',study_mode:'methods'}],{headers:{'content-range':`${offset}-${offset}/2`}});
 }});
 assert.deepEqual((await reader.versions(row)).map(v=>v.id),['v2','v1']);assert.equal(calls,2);
});
test('viewer gets restricted counts without probing sessions; admin does not imply research persona',async()=>{
 const reader=createTestOverviewReader({url:'https://db.example',key:'public',token,fetchImpl:async(input)=>{
  assert.ok(String(input).includes('/workspace_members?'));return Response.json([{user_id:'researcher',system_role:'admin',product_persona:'product_viewer'}]);
 }});
 assert.deepEqual(await reader.participants(row,'v1'),{availability:'restricted',started:null,completed:null});
});
test('session counts use exact version, caller JWT and persona; unavailable counts throw',async()=>{
 let counts=0;const reader=createTestOverviewReader({url:'https://db.example',key:'public',token,fetchImpl:async(input,init)=>{
  const url=new URL(String(input));assert.equal(new Headers(init?.headers).get('authorization'),`Bearer ${token}`);
  if(url.pathname.endsWith('/workspace_members')) return Response.json([{user_id:'researcher',product_persona:'researcher'}]);
  assert.equal(url.searchParams.get('test_version_id'),'eq.v1');assert.equal(url.searchParams.get('workspace_id'),`eq.${workspaceId}`);counts++;
  return Response.json([],{headers:{'content-range':`*/${url.searchParams.has('status')?2:3}`}});
 }});
 assert.deepEqual(await reader.participants(row,'v1'),{availability:'available',started:3,completed:2});assert.equal(counts,2);
});
