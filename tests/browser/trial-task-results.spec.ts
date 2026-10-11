import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {seed,start,read,fixture} from './trial-fixtures';
import {STORAGE_KEY,type Session} from '../../src/lib/trial/model';
for(const width of [1280,320,390])test(`Task Results ${width}: explicit start, refresh, technical outcome and keyboard evidence`,async({page,context},info)=>{
 const url=await seed(context);await page.setViewportSize({width,height:844});await page.goto(url);
 const button=page.getByRole('button',{name:'เริ่มโจทย์',exact:true});await expect(button).toBeVisible();await expect(page.locator('iframe')).toHaveCount(0);
 await button.press('Enter');const first=(await read(page)).sessions[0].taskStarts![0];await page.reload();
 await expect(page.getByText('เริ่มโจทย์แล้ว เวลาเริ่มเดิมจะคงอยู่เมื่อกลับมาทำต่อ')).toBeVisible();expect((await read(page)).sessions[0].taskStarts![0]).toEqual(first);
 await page.getByRole('combobox',{name:'คุณทำโจทย์นี้ได้หรือไม่',exact:true}).selectOption('technical_blocked');
 await page.getByRole('button',{name:'บันทึกและไปข้อถัดไป'}).click();expect((await read(page)).sessions[0].answers).toHaveLength(0);
 await page.getByRole('textbox',{name:'ปัญหาทางเทคนิคที่ทำให้ทำต่อไม่ได้',exact:true}).fill('เปิดเว็บจำลองไม่ได้ — QA');
 await page.getByRole('button',{name:'บันทึกและไปข้อถัดไป'}).click();await page.getByRole('button',{name:'ส่งคำตอบทั้งหมด'}).click();
 const saved=await read(page);expect(saved.sessions[0].answers[0].answeredAt).toBeTruthy();expect(saved.sessions[0].taskStarts![0]).toEqual(first);
 await page.goto(url.replace('step=participant','step=results'));const results=page.getByRole('region',{name:'ผลรายโจทย์',exact:true});
 await expect(results.getByText(/ปัญหาทางเทคนิค 1/)).toBeVisible();await expect(results.getByText('ผู้ทดลองตอบว่าทำได้: ยังไม่มีข้อมูลที่เข้าเกณฑ์',{exact:true})).toBeVisible();
 await results.locator('summary').press('Enter');await expect(results.getByText('ปัญหาทางเทคนิค: เปิดเว็บจำลองไม่ได้ — QA',{exact:true})).toBeVisible();
 await results.getByRole('link',{name:'ดูคำตอบต้นทาง',exact:true}).click();await expect(page.locator(`#answer-${saved.sessions[0].id}-task`)).toBeFocused();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect((await new AxeBuilder({page}).include('[aria-label="ผลรายโจทย์"]').analyze()).violations).toEqual([]);
 expect(await read(page)).toEqual(saved);await page.screenshot({path:info.outputPath(`task-results-${width}.png`),fullPage:true});
});
test('failed starts/answer saves cannot advance or fabricate an endpoint; reload keeps original start',async({page,context})=>{
 const url=await seed(context);await page.goto(url);await page.evaluate(()=>Object.assign(window,{qaFailWrites:true}));await page.getByRole('button',{name:'เริ่มโจทย์',exact:true}).click();
 await expect(page.getByText(/บันทึกไม่ได้ พื้นที่จัดเก็บ/)).toBeVisible();expect((await read(page)).sessions[0].taskStarts).toBeUndefined();await expect(page.locator('iframe')).toHaveCount(0);
 await page.evaluate(()=>Object.assign(window,{qaFailWrites:false}));await start(page,url);const started=(await read(page)).sessions[0].taskStarts![0];
 await page.getByLabel('คุณทำโจทย์นี้ได้หรือไม่').selectOption('done');await page.evaluate(()=>Object.assign(window,{qaFailWrites:true}));await page.getByRole('button',{name:'บันทึกและไปข้อถัดไป'}).click();
 expect((await read(page)).sessions[0].answers).toHaveLength(0);await expect(page.getByRole('heading',{name:'ตรวจคำตอบก่อนส่ง'})).toHaveCount(0);
 await page.reload();expect((await read(page)).sessions[0].taskStarts![0]).toEqual(started);await page.getByLabel('คุณทำโจทย์นี้ได้หรือไม่').selectOption('done');await page.getByRole('button',{name:'บันทึกและไปข้อถัดไป'}).click();
 const result=(await read(page)).sessions[0];expect(result.answers[0].answeredAt).toBeTruthy();expect(result.taskStarts![0]).toEqual(started);
});
test('Results formulas use submitted eligible answers; legacy and partial samples remain distinct',async({page,context})=>{
 const data=fixture(),base='2026-10-11T00:00:00.000Z';const time=(n:number)=>new Date(Date.parse(base)+n).toISOString();
 const row=(id:string,outcome:'done'|'not_done'|'skipped'|'technical_blocked',ms?:number,submitted=true):Session=>({id,versionId:data.session.versionId,startedAt:base,...(ms!==undefined?{taskStarts:[{taskId:'task',at:base}]}:{}),answers:[{taskId:'task',outcome,ease:null,feedback:'fixture only',...(ms!==undefined?{answeredAt:time(ms)}:{}),...(outcome==='technical_blocked'?{technicalReason:'QA blocked'}:{})}],...(submitted?{submittedAt:time(100000)}:{})});
 data.store.sessions=[row('a','done',1000),row('b','not_done',3000),row('c','skipped',4000),row('d','technical_blocked',5000),row('e','done',undefined),row('f','done',7000,false)];
 await context.addInitScript(({key,raw})=>localStorage.setItem(key,raw),{key:STORAGE_KEY,raw:JSON.stringify(data.store)});
 await page.goto(`/trial?step=results&p=p&t=t&v=${data.session.versionId}`);const results=page.getByRole('region',{name:'ผลรายโจทย์',exact:true});
 await expect(results.getByText('ผู้ทดลองตอบว่าทำได้: 50% (2/4 คำตอบ)',{exact:true})).toBeVisible();await expect(results.getByText(/Median: 2 วินาที · 2 ตัวอย่าง/)).toBeVisible();await expect(results.getByText(/ยังไม่ส่งครบ 1 รอบ/)).toBeVisible();
 await results.locator('summary').click();await expect(results.getByText('เวลาไม่พร้อม · ความง่าย ไม่ได้ให้คะแนน',{exact:true})).toHaveCount(1);expect(await read(page)).toEqual(data.store);
});
test('other-tab changes block start until latest data loaded, then keep the claimed start',async({page,context})=>{
 const url=await seed(context);await page.goto(url);const other=await context.newPage();await other.goto(url);await other.getByRole('button',{name:'เริ่มโจทย์',exact:true}).click();
 await expect(page.getByRole('button',{name:'เริ่มโจทย์',exact:true})).toBeDisabled();await page.getByRole('button',{name:'โหลดข้อมูลล่าสุด',exact:true}).click();await expect(page.getByText('เริ่มโจทย์แล้ว เวลาเริ่มเดิมจะคงอยู่เมื่อกลับมาทำต่อ')).toBeVisible();expect((await read(page)).sessions[0].taskStarts).toHaveLength(1);
});
