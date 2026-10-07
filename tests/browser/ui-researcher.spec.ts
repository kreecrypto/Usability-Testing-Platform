import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
async function scan(page:Page){const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();expect(result.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))).toEqual([]);}
for(const width of [1280,320,390]){
 test(`Researcher UI native forms and errors ${width}px (synthetic only)`,async({page})=>{
  const writes:Record<string,unknown>[]=[];
  await page.route('**/api/**',async route=>{
   const r=route.request(),p=new URL(r.url()).pathname;
   if(r.method()==='POST')writes.push(r.postDataJSON());
   if(p==='/api/auth/session')return route.fulfill({json:{user:{id:'qa-only'}}});
   if(p==='/api/workspaces')return route.fulfill({json:{workspaces:[{id:'w',name:'Synthetic UI QA',slug:'qa'}]}});
   if(p==='/api/projects'&&r.method()==='POST')return route.fulfill({json:{project:{id:'p',workspace_id:'w',name:'Fixture Project',description:null,status:'active'}}});
   if(p==='/api/projects')return route.fulfill({json:{projects:[]}});
   if(p==='/api/tests')return route.fulfill({json:{tests:[]}});
   if(p.endsWith('/tasks'))return route.fulfill({json:{tasks:[]}});
   return route.fulfill({status:503,json:{error:'qa_network_failure'}});
  });
  await page.setViewportSize({width,height:844});await page.goto('/projects');
  await expect(page.getByRole('heading',{level:1})).toBeVisible();
  await page.getByLabel('ชื่อโปรเจกต์ใหม่').fill('Fixture Project');
  await page.getByRole('button',{name:'สร้างโปรเจกต์',exact:true}).click();
  await expect.poll(()=>writes.length).toBe(1);expect(writes[0].name).toBe('Fixture Project');expect(writes[0].workspaceId).toBe('w');
  await scan(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  for(const part of ['prototype','tasks','criteria','rules','questions','review']){
   await page.goto(`/builder/qa-study/${part}`);await expect(page.getByRole('heading',{level:1})).toBeVisible();
   await expect(page.getByText(/กำลังโหลด/)).toHaveCount(0);await scan(page);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
 });
}
test('Builder task submit retains exact body; no UI access change on authentication expiry',async({page})=>{
 let body:unknown=null;
 await page.route('**/api/tests/qa-study/tasks',async route=>{
  if(route.request().method()==='POST'){body=route.request().postDataJSON();return route.fulfill({status:503,json:{error:'qa_network_failure'}});}
  return route.fulfill({json:{tasks:[]}});
 });
 await page.goto('/builder/qa-study/tasks');await expect(page.getByRole('heading',{level:1})).toBeVisible();
 await page.getByLabel('ชื่องาน',{exact:true}).fill('Fixture instruction');await page.getByLabel('สถานการณ์',{exact:true}).fill('QA scenario');
 await page.getByLabel('คำสั่งที่ผู้เข้าร่วมจะเห็น',{exact:true}).fill('QA instruction');
 await page.getByRole('button',{name:'เพิ่มงาน',exact:true}).click();
 await expect.poll(()=>body).toEqual({title:'Fixture instruction',scenario:'QA scenario',instruction:'QA instruction'});
 await page.unroute('**/api/tests/qa-study/tasks');await page.route('**/api/tests/qa-study/tasks',route=>route.fulfill({status:401,json:{error:'authentication_required'}}));
 await page.goto('/builder/qa-study/tasks');await expect(page).toHaveURL(/\/login/);
});
