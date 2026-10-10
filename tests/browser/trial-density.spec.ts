import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {STORAGE_KEY} from '../../src/lib/trial/model.ts';
import {resultsFixture,read} from './trial-fixtures';
for(const width of [1280,320,390])test(`density ${width}: actual scrolled click, three views/all zooms, frozen evidence and dialog`,async({page,context},info)=>{
 const {point,results,linked,store}=await resultsFixture(page,context);await page.setViewportSize({width,height:844});
 await page.goto(results);await page.getByRole('combobox',{name:'หน้าบนแผนที่',exact:true}).selectOption('houses');
 const view=page.getByRole('combobox',{name:'มุมมองแผนที่',exact:true});await expect(view).toHaveValue('density');
 const canvas=page.locator('canvas[data-density-state="ready"]');await expect(canvas).toHaveCount(1);
 await expect(page.getByText('สีแสดงความกระจุกตัวของคลิกในชุดข้อมูลนี้ ไม่ใช่คะแนนความสำเร็จ',{exact:true})).toBeVisible();
 for(const mode of ['density','both','points']){
  await view.selectOption(mode);
  for(const zoom of ['fit','1','1.5','2']){
   await page.getByRole('combobox',{name:'ขนาดแผนที่',exact:true}).selectOption(zoom);
   if(mode!=='points'){
    await expect(canvas).toHaveCount(1);
    const image=await canvas.evaluate((el,e)=>{const c=el as HTMLCanvasElement;const r=c.getBoundingClientRect(),f=c.parentElement!.querySelector('iframe')!.getBoundingClientRect();const ctx=c.getContext('2d')!;const x=Math.min(c.width-1,Math.floor(e.x*c.width/e.w)),y=Math.min(c.height-1,Math.floor(e.y*c.height/e.h));return{pixels:c.width*c.height,alpha:ctx.getImageData(x,y,1,1).data[3],x:r.x-f.x,y:r.y-f.y};},{x:point.documentX!,y:point.documentY!,w:point.documentWidth,h:point.documentHeight});
    expect(image.pixels).toBeLessThanOrEqual(1000000);expect(image.alpha).toBeGreaterThan(0);expect(image.x).toBeCloseTo(0,1);expect(image.y).toBeCloseTo(0,1);
   }else await expect(page.locator('canvas')).toHaveCount(0);
   await expect(page.locator('button[aria-label^="เลือกคลิก "]')).toHaveCount(mode==='density'?0:1);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
 }
 await view.selectOption('both');await expect(canvas).toHaveCount(1);
 await page.getByRole('button',{name:'ขยายแผนที่',exact:true}).press('Enter');await expect(canvas).toHaveCount(1);
 expect((await new AxeBuilder({page}).include('[role="dialog"]').analyze()).violations).toEqual([]);
 await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'ขยายแผนที่',exact:true})).toBeFocused();await expect(canvas).toHaveCount(1);
 expect(await read(page)).toEqual(store);await page.screenshot({path:info.outputPath(`density-${width}.png`),fullPage:true});
 await page.goto(linked);await expect(view).toHaveValue('points');await view.selectOption('both');await expect(canvas).toHaveCount(1);
 await expect(page.locator('article[id^="event-"]')).toHaveCount(1);expect(await read(page)).toEqual(store);
 await page.getByRole('link',{name:'สร้างข้อค้นพบจากคลิกนี้'}).click();const checked=page.locator('input[name="evidence"]:checked');await expect(checked).toHaveCount(1);expect(JSON.parse(await checked.inputValue()).eventIds).toEqual([point.id]);
 await page.getByLabel('ปัญหาที่พบ',{exact:true}).fill('Density QA — ตรวจคลิกต้นทาง');await page.getByLabel('ผลกระทบต่อการใช้งาน',{exact:true}).fill('ข้อมูลสังเคราะห์สำหรับ QA');await page.getByLabel('ข้อเสนอแนะ',{exact:true}).fill('ตรวจหลักฐานก่อนสรุป');
 await page.getByRole('button',{name:'บันทึกข้อค้นพบ',exact:true}).click();await expect.poll(async()=>(await read(page)).findings.at(-1)?.problem).toContain('Density QA');
 await page.getByRole('button',{name:'ไปที่รายงาน',exact:true}).click();await page.getByRole('button',{name:'สร้างรายงานจากข้อค้นพบ',exact:true}).click();
 await expect.poll(async()=>(await read(page)).reports.length).toBe(store.reports.length+1);
 const saved=await read(page);expect(saved.reports.at(-1)!.findings.at(-1)!.evidence[0].eventIds).toEqual([point.id]);
 await page.getByRole('link',{name:/หลักฐาน เหตุการณ์.*1 เหตุการณ์/}).last().click();await expect(page.getByRole('combobox',{name:'มุมมองแผนที่',exact:true})).toHaveValue('points');await page.getByRole('combobox',{name:'มุมมองแผนที่',exact:true}).selectOption('both');await expect(canvas).toHaveCount(1);await expect(page.locator('article[id^="event-"]')).toHaveCount(1);expect(await read(page)).toEqual(saved);
 await page.screenshot({path:info.outputPath(`density-evidence-${width}.png`),fullPage:true});
 await page.getByRole('combobox',{name:'มุมมองแผนที่',exact:true}).selectOption('density');await expect(canvas).toHaveCount(1);await page.getByRole('region',{name:'แผนที่เลื่อนได้',exact:true}).screenshot({path:info.outputPath(`density-map-${width}.png`)});expect(await read(page)).toEqual(saved);
});
test('invalid frozen evidence fails closed; incomplete round warning and no Finding eligibility',async({page,context})=>{
 const {results,point,store}=await resultsFixture(page,context);await page.goto(`${results}&report=missing&fi=0&ei=0`);
 await expect(page.getByText('เลือกหลักฐานที่ถูกต้องก่อนดูแผนที่',{exact:true})).toBeVisible();await expect(page.locator('canvas')).toHaveCount(0);await expect(page.locator('article[id^="event-"]')).toHaveCount(0);
 const incomplete={...store,findings:[],reports:[],sessions:store.sessions.map(s=>({...s,submittedAt:undefined}))};
 await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key:STORAGE_KEY,raw:JSON.stringify(incomplete)});await page.goto(`${results}#event-${point.id}`);
 await expect(page.getByText(/ชุดนี้มีคลิกจากรอบทดลองที่ยังส่งคำตอบไม่ครบ/)).toBeVisible();await expect(page.getByRole('button',{name:'สร้างข้อค้นพบจากคลิกนี้'})).toBeDisabled();
});
test('Canvas failure falls back to exact points; retry and filtering cannot keep stale color',async({page,context})=>{
 const {results,point,store}=await resultsFixture(page,context);
 await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,...args:Parameters<typeof original>){if((window as unknown as {canvasFail?:boolean}).canvasFail!==false)return null;return original.apply(this,args);} as typeof original;});
 await page.goto(results);await page.getByRole('combobox',{name:'หน้าบนแผนที่',exact:true}).selectOption('houses');
 await expect(page.getByText(/วาดสีความหนาแน่นไม่สำเร็จ/)).toBeVisible();await expect(page.getByRole('button',{name:'เลือกคลิก 1',exact:true})).toBeVisible();
 await page.evaluate(()=>Object.assign(window,{canvasFail:false}));await page.getByRole('combobox',{name:'มุมมองแผนที่',exact:true}).selectOption('density');await expect(page.locator('canvas[data-density-state="ready"]')).toHaveCount(1);
 await page.getByRole('combobox',{name:'หน้า',exact:true}).selectOption('house12');await expect(page.locator('canvas')).toHaveCount(0);
 await page.getByRole('button',{name:'ล้างตัวกรอง'}).click();await page.getByRole('combobox',{name:'หน้าบนแผนที่',exact:true}).selectOption('houses');await expect(page.locator('canvas[data-density-state="ready"]')).toHaveCount(1);expect(await read(page)).toEqual(store);
});
