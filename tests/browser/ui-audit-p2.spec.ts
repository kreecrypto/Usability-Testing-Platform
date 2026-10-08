import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
for(const width of [1280,320,390])test(`Home entry, touch targets and researcher defaults ${width}px`,async({page},testInfo)=>{
 await page.setViewportSize({width,height:844});await page.goto('/');
 const trial=page.getByRole('link',{name:'เริ่มทดลองใช้งาน',exact:true});const demo=page.getByRole('link',{name:'ดูตัวอย่างแบบอ่านอย่างเดียว',exact:true});
 await expect(trial).toHaveAttribute('href','/trial');await expect(demo).toHaveAttribute('href','/demo/projects');
 await expect(page.getByText('ลำดับการทำงาน',{exact:true})).toHaveCount(1);await expect(page.locator('.homeWorkflow > li')).toHaveCount(6);
 await trial.focus();await expect(trial).toBeFocused();
 for(const link of await page.locator('nav a,.homeActions a').all())expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
 await expect(page.getByText(/ไม่แชร์ข้ามเครื่อง/)).toBeVisible();
 await page.screenshot({path:testInfo.outputPath(`home-${width}.png`),fullPage:true});
 const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();expect(result.violations.map(v=>v.id)).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await demo.click();await expect(page.getByRole('heading',{name:'โปรเจกต์',exact:true})).toBeVisible();
 expect((await page.getByRole('link',{name:'หน้าหลัก',exact:true}).boundingBox())!.height).toBeGreaterThanOrEqual(44);
 await page.getByRole('link',{name:'หน้าหลัก',exact:true}).click();await trial.click();
 await expect(page.getByRole('heading',{name:'โปรเจกต์',exact:true})).toBeVisible();
 for(const link of await page.locator('aside > a,header > a').all())expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);

 let workspaceCreated=false;const writes:{path:string;body:unknown}[]=[];
 await page.route('**/api/**',route=>{
  const request=route.request(),path=new URL(request.url()).pathname,post=request.method()==='POST';
  if(post)writes.push({path,body:request.postDataJSON()});
  if(path==='/api/auth/session')return route.fulfill({json:{user:{id:'synthetic'}}});
  if(path==='/api/workspaces'&&post){workspaceCreated=true;return route.fulfill({json:{workspace:{id:'w'}}});}
  if(path==='/api/workspaces')return route.fulfill({json:{workspaces:workspaceCreated?[{id:'w',name:'พื้นที่ทดสอบ',slug:'qa'}]:[]}});
  if(path==='/api/projects')return route.fulfill({json:post?{project:{id:'p',workspace_id:'w',name:'โปรเจกต์ของฉัน',description:null,status:'active'}}:{projects:[]}});
  if(path==='/api/tests')return route.fulfill({json:post?{test:{id:'t',workspace_id:'w',project_id:'p',title:'แบบทดสอบของฉัน',description:null,status:'draft'}}:{tests:[]}});
  if(path.endsWith('/tasks'))return route.fulfill({json:{tasks:[]}});
  return route.fulfill({status:503,json:{error:'unexpected_fixture_request'}});
 });
 await page.goto('/projects');const workspace=page.getByLabel('ชื่อพื้นที่ทำงานใหม่');await expect(workspace).toHaveValue('');
 await workspace.fill('พื้นที่ทดสอบ');await page.getByRole('button',{name:'สร้างพื้นที่ทำงาน',exact:true}).click();
 const project=page.getByLabel('ชื่อโปรเจกต์ใหม่');await expect(project).toHaveValue('');await project.fill('โปรเจกต์ของฉัน');await page.getByRole('button',{name:'สร้างโปรเจกต์',exact:true}).click();
 const title=page.getByLabel('ชื่อแบบทดสอบใหม่');await expect(title).toHaveValue('');await title.fill('แบบทดสอบของฉัน');await page.getByRole('button',{name:'สร้างแบบทดสอบ',exact:true}).click();
 await expect(page.getByLabel('URL เว็บไซต์ที่จะทดสอบ')).toHaveValue('');
 expect(writes).toEqual([{path:'/api/workspaces',body:{name:'พื้นที่ทดสอบ'}},{path:'/api/projects',body:{workspaceId:'w',name:'โปรเจกต์ของฉัน',description:null}},{path:'/api/tests',body:{workspaceId:'w',projectId:'p',title:'แบบทดสอบของฉัน',description:null}}]);
 for(const button of await page.locator('button.primaryButton').all())expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
