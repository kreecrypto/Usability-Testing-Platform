import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function scan(page:Page){const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();expect(result.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))).toEqual([]);}
async function fixture(page:Page){
 const events:{eventType:string;eventId:string;testVersionId:string}[]=[];
 const writes:string[]=[];
 await page.route('**/api/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname;
  if(request.method()==='POST')writes.push(path);
  if(path==='/api/public/tests/qa-version')return route.fulfill({json:{test:{testId:'qa-test',testVersionId:'qa-version',versionNo:1,title:'Synthetic UI QA',description:null,target:{provider:'external_web',sourceUrl:'https://example.com',launchMode:'new_tab',embedUrl:null,liveEmbedUrl:null,startScreenId:null,instrumentation:'none'},tasks:[{id:'qa-task',ordinal:1,title:'ค้นหาข้อมูล',scenario:'ข้อมูลสำหรับทดสอบ UI เท่านั้น',instruction:'เปิดเว็บไซต์และค้นหาข้อมูล',timeoutSeconds:null,postTaskQuestions:{seq:{enabled:true,required:true},open_feedback:{enabled:true,required:false}}}]}}});
  if(path.endsWith('/session'))return route.fulfill({json:{session:{participantId:'qa-participant',sessionId:'qa-session',testId:'qa-test',testVersionId:'qa-version',startedAt:new Date().toISOString(),ingestionToken:'synthetic-only',ingestionTokenExpiresAt:new Date(Date.now()+300000).toISOString()}}});
  if(path.endsWith('/token'))return route.fulfill({json:{ingestionToken:'synthetic-only',ingestionTokenExpiresAt:new Date(Date.now()+300000).toISOString()}});
  return route.fulfill({status:401,json:{error:'no_fixture_session'}});
 });
 await page.route('**/v1/events',async route=>{events.push(...route.request().postDataJSON().events);await route.fulfill({json:{accepted:true}});});
 return {events,writes};
}
for(const width of [1280,320,390])test(`Participant consent, dialog keyboard and feedback ${width}px (synthetic only)`,async({page})=>{
 const {events,writes}=await fixture(page);await page.setViewportSize({width,height:844});
 await page.goto('/t/qa-version');await expect(page.getByRole('button',{name:'ยินยอมและเริ่ม',exact:true})).toBeVisible();
 expect(events).toEqual([]);expect(writes).toEqual([]);await scan(page);
 await page.getByRole('button',{name:'ไม่ยินยอม',exact:true}).click();expect(events).toEqual([]);expect(writes).toEqual([]);
 await page.reload();await page.getByRole('button',{name:'ยินยอมและเริ่ม',exact:true}).click();
 await page.getByRole('button',{name:'เริ่มงาน',exact:true}).click();
 const trigger=page.getByRole('button',{name:'ทำงานนี้ต่อไม่ได้',exact:true});await trigger.click();
 const dialog=page.getByRole('dialog'),cancel=dialog.getByRole('button',{name:'ลองต่อ',exact:true});
 await expect(cancel).toBeFocused();await scan(page);
 for(let i=0;i<8;i++){await page.keyboard.press('Tab');expect(await dialog.evaluate(e=>e.contains(document.activeElement))).toBe(true);}
 await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(trigger).toBeFocused();
 expect(events.filter(e=>e.eventType==='task_give_up')).toHaveLength(0);
 await trigger.click();await dialog.getByRole('button',{name:'ยุติงานนี้',exact:true}).click();
 await expect(page.getByRole('heading',{name:'งานนี้ทำได้ง่ายหรือยากเพียงใด?'})).toBeVisible();
 await page.getByRole('button',{name:'ส่งคำตอบ',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'โปรดให้คะแนน'})).toBeVisible();
 const rating=page.getByRole('radio',{name:'4',exact:true});await rating.focus();await page.keyboard.press('Space');await expect(rating).toBeChecked();await scan(page);
 expect(events.filter(e=>e.eventType==='task_give_up')).toHaveLength(1);
 expect(events.every(e=>e.testVersionId==='qa-version')).toBe(true);
 expect(new Set(events.map(e=>e.eventId)).size).toBe(events.length);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(writes.filter(path=>path!=='/api/public/sessions/token')).toEqual(['/api/public/tests/qa-version/session']);
});
test('Participant invalid link and network failure keep recovery guidance',async({page})=>{
 await page.route('**/api/**',route=>route.fulfill({status:404,json:{error:'not_found'}}));
 await page.goto('/t/qa-missing');await expect(page.getByRole('heading',{name:'แบบทดสอบนี้ใช้งานไม่ได้'})).toBeVisible();await scan(page);
 await page.unroute('**/api/**');await fixture(page);
 await page.route('**/api/public/tests/qa-version/session',route=>route.abort());
 await page.goto('/t/qa-version');await page.getByRole('button',{name:'ยินยอมและเริ่ม',exact:true}).click();
 await expect(page.getByRole('heading',{name:'แบบทดสอบยังดำเนินการต่อไม่ได้'})).toBeVisible();await expect(page.getByText('เริ่มแบบทดสอบไม่สำเร็จ โปรดโหลดหน้าใหม่แล้วลองอีกครั้ง')).toBeVisible();await scan(page);
});
