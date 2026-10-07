import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { addFinding, makeReport, STORAGE_KEY } from '../../src/lib/trial/model.ts';
import { seed, read, start, resultsFixture } from './trial-fixtures';

test('No Data differs from an empty evidence filter; keyboard reset preserves frozen evidence', async ({ page, context }) => {
  const url = await seed(context);
  await page.goto(url.replace('step=participant', 'step=results'));
  await expect(page.getByText('ยังไม่มีการเก็บพฤติกรรม เริ่มเว็บจำลองและยินยอมเก็บพฤติกรรมก่อน', { exact: true })).toBeVisible();
  const { linked, store } = await resultsFixture(page, context, url);
  await page.goto(linked);
  await page.getByRole('combobox', { name: 'หน้า', exact: true }).selectOption('dashboard');
  await expect(page.getByText('ไม่พบข้อมูลตามตัวกรองนี้ ล้างตัวกรองเพื่อกลับไปดูข้อมูลที่เก็บไว้', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'ล้างตัวกรอง' }).press('Enter');
  await expect(page.getByText(/กำลังแสดงชุดหลักฐาน.*\(1 เหตุการณ์\)/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'เส้นทางแยกตามรอบและโจทย์' })).toHaveCount(0);
  await expect(page.getByText(/ชุดข้อมูลที่แสดงไม่มีเหตุการณ์เส้นทาง/)).toBeVisible();
  expect(await read(page)).toEqual(store);
});

for (const width of [1280, 320, 390]) {
  test(`click map at ${width}px preserves scrolled coordinates, centers narrow geometry and reads Report/Finding`, async ({ page, context }, testInfo) => {
    const { point, linked, store } = await resultsFixture(page, context);
    await page.setViewportSize({ width, height: 844 });
    await page.goto(linked);
    const marker = page.getByRole('button', {name:'เลือกคลิก 1',exact:true});
    await expect(marker).toBeVisible();
    const geometry = await marker.evaluate(el => {
      const pointRect = el.getBoundingClientRect();
      const canvas = el.parentElement!;
      const map = canvas.parentElement!;
      const container = map.parentElement!;
      const bounds = canvas.getBoundingClientRect();
      const frame = canvas.querySelector('iframe')!;
      return { left: (el as HTMLElement).style.left, top: (el as HTMLElement).style.top, x: pointRect.x + pointRect.width / 2, y: pointRect.y + pointRect.height / 2, bounds: { x: bounds.x, y: bounds.y, width: bounds.width }, scale: bounds.width / Number(frame.width), center: map.getBoundingClientRect().x + map.getBoundingClientRect().width / 2, containerCenter: container.getBoundingClientRect().x + container.getBoundingClientRect().width / 2, docWidth: frame.contentDocument!.documentElement.scrollWidth, docHeight: frame.contentDocument!.documentElement.scrollHeight };
    });
    expect(geometry.left).toBe(`${point.documentX}px`);
    expect(geometry.top).toBe(`${point.documentY}px`);
    expect(geometry.x).toBeCloseTo(geometry.bounds.x + point.documentX! * geometry.scale, 1);
    expect(geometry.y).toBeCloseTo(geometry.bounds.y + point.documentY! * geometry.scale, 1);
    expect(geometry.center).toBeCloseTo(geometry.containerCenter, 0);
    expect(geometry.docWidth).toBe(point.documentWidth);
    expect(geometry.docHeight).toBe(point.documentHeight);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await read(page)).toEqual(store);
    await page.screenshot({ path: testInfo.outputPath(`click-map-${width}.png`), fullPage: true });
    await page.goto(linked.replace(/report=[^&]+&fi=0/, 'finding=f'));
    await expect(marker).toBeVisible();
    expect(await read(page)).toEqual(store);
  });
}

test('click map has loading, failed request and keyboard retry states without losing evidence', async ({ page, context }) => {
  const { linked, store } = await resultsFixture(page, context);
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let fail = true;
  await page.route('**/trial/target?mode=preview**', async route => {
    if (fail) { await held; await route.abort(); }
    else await route.continue();
  });
  await page.goto(linked, { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('กำลังโหลดแผนที่ตำแหน่งคลิก…', { exact: true })).toBeVisible();
  await expect(page.locator('button[aria-label^="เลือกคลิก "]')).toHaveCount(0);
  release();
  await expect(page.getByText(/โหลดแผนที่ตำแหน่งคลิกไม่สำเร็จ/)).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: 'ลองโหลดแผนที่อีกครั้ง' }).press('Enter');
  await expect(page.locator('button[aria-label^="เลือกคลิก "]')).toHaveCount(1);
  expect(await read(page)).toEqual(store);
});

test('click map timeout and geometry mismatch never plot unverifiable points', async ({ page, context }) => {
  const { linked, store } = await resultsFixture(page, context);
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  let mismatch = false;
  await page.route('**/trial/target?mode=preview**', async route => {
    if (!mismatch) { await held; await route.abort(); }
    else {
      const response = await route.fetch();
      await route.fulfill({ response, body: (await response.text()).replace('min-height:960px', 'min-height:9999px') });
    }
  });
  await page.goto(linked, { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/โหลดแผนที่ตำแหน่งคลิกไม่สำเร็จ/)).toBeVisible({ timeout: 15_000 });
  release();
  mismatch = true;
  await page.getByRole('button', { name: 'ลองโหลดแผนที่อีกครั้ง' }).click();
  await expect(page.getByText(/ขนาดหน้าไม่ตรงกับหลักฐาน/)).toBeVisible();
  await expect(page.locator('button[aria-label^="เลือกคลิก "]')).toHaveCount(0);
  await expect(page.locator('article[id^="event-"]')).toHaveCount(1);
  expect(await read(page)).toEqual(store);
});

for(const width of [1280,320,390]) {
  test(`interactive map ${width}: zoom, keyboard inspector, dialog and exact Finding/Report`,async({page,context},testInfo)=>{
    const {point,linked,store}=await resultsFixture(page,context);
    await page.setViewportSize({width,height:844});await page.goto(linked);
    const marker=page.getByRole('button',{name:'เลือกคลิก 1',exact:true});await expect(marker).toBeVisible();
    for(const zoom of ['1','1.5','2','fit']) {
      await page.getByRole('combobox',{name:'ขนาดแผนที่',exact:true}).selectOption(zoom);
      const geometry=await marker.evaluate(el=>{
        const canvas=el.parentElement!;const frame=canvas.querySelector('iframe')!;
        const r=el.getBoundingClientRect(),c=canvas.getBoundingClientRect();
        return {x:r.x+r.width/2,y:r.y+r.height/2,bx:c.x,by:c.y,scale:c.width/Number(frame.width),left:(el as HTMLElement).style.left,top:(el as HTMLElement).style.top};
      });
      expect(geometry.left).toBe(`${point.documentX}px`);expect(geometry.top).toBe(`${point.documentY}px`);
      expect(geometry.x).toBeCloseTo(geometry.bx+point.documentX!*geometry.scale,1);expect(geometry.y).toBeCloseTo(geometry.by+point.documentY!*geometry.scale,1);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    }
    await page.getByRole('button',{name:/คลิก 1 · houses-house12/}).press('Enter');
    await expect(page.getByRole('region',{name:'รายละเอียดคลิก'})).toContainText(point.id);
    await page.getByRole('button',{name:'ขยายแผนที่',exact:true}).press('Enter');
    const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await expect(marker).toBeVisible();
    await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(page.getByRole('button',{name:'ขยายแผนที่',exact:true})).toBeFocused();
    await expect(marker).toBeVisible();await page.getByRole('button',{name:'ดูเหตุการณ์ต้นทาง'}).press('Enter');
    await expect(page.locator(`#event-${point.id}`)).toBeFocused();expect(await read(page)).toEqual(store);
    await page.screenshot({path:testInfo.outputPath(`interactive-map-${width}.png`),fullPage:true});
    await page.getByRole('link',{name:'สร้างข้อค้นพบจากคลิกนี้'}).click();
    const checked=page.locator('input[name="evidence"]:checked');await expect(checked).toHaveCount(1);
    expect(JSON.parse(await checked.inputValue()).eventIds).toEqual([point.id]);
    await page.getByLabel('ปัญหาที่พบ',{exact:true}).fill('QA click inspector');
    await page.getByLabel('ผลกระทบต่อการใช้งาน',{exact:true}).fill('Synthetic QA only');
    await page.getByLabel('ข้อเสนอแนะ',{exact:true}).fill('Inspect exact event');
    await page.getByRole('button',{name:'บันทึกข้อค้นพบ',exact:true}).click();
    const saved=await read(page);expect(saved.findings.at(-1)!.evidence[0].eventIds).toEqual([point.id]);
    const report=makeReport(saved,point.versionId);expect(report.reports.at(-1)!.findings.at(-1)!.evidence[0].eventIds).toEqual([point.id]);
  });
}

test('overlapping clicks remain individually selectable; incomplete sessions cannot become Findings',async({page,context})=>{
  const {point,results,store}=await resultsFixture(page,context);
  const copy={...point,id:crypto.randomUUID(),sequence:Math.max(...store.behaviorEvents!.map(e=>e.sequence))+1};
  const data={...store,behaviorEvents:[...store.behaviorEvents!,copy]};
  await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key:STORAGE_KEY,raw:JSON.stringify(data)});
  expect(await read(page)).toEqual(data);
  await page.goto(`${results}&qa=overlap#event-${point.id}`);expect(await read(page)).toEqual(data);
  await page.getByRole('button',{name:'เลือกคลิก 2',exact:true}).click();
  await expect(page.getByRole('group',{name:'คลิกที่ซ้อนกัน'})).toBeVisible();
  await page.getByRole('group',{name:'คลิกที่ซ้อนกัน'}).getByRole('button',{name:'คลิก 1',exact:true}).press('Enter');
  await expect(page.getByRole('region',{name:'รายละเอียดคลิก'})).toContainText(point.id);
  expect(await read(page)).toEqual(data);
  const incomplete={...data,findings:[],reports:[],sessions:data.sessions.map(s=>({...s,submittedAt:undefined}))};
  await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key:STORAGE_KEY,raw:JSON.stringify(incomplete)});
  await page.reload();await expect(page.getByRole('button',{name:'สร้างข้อค้นพบจากคลิกนี้'})).toBeDisabled();
  await page.goto(results.replace('step=results','step=findings')+`&click=${point.id}`);
  await expect(page.getByText(/ใช้คลิกนี้เป็นหลักฐานไม่ได้:/)).toBeVisible();
  await expect(page.locator('input[name="evidence"]:checked')).toHaveCount(0);
});

test('screen and exact geometry choices stay separate; hash and frozen evidence select their own group',async({page,context})=>{
  const {point,results,linked,store}=await resultsFixture(page,context);
  const copy={...point,id:crypto.randomUUID(),viewportHeight:point.viewportHeight+1,sequence:Math.max(...store.behaviorEvents!.map(e=>e.sequence))+1};
  const data={...store,behaviorEvents:[...store.behaviorEvents!,copy]};
  await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key:STORAGE_KEY,raw:JSON.stringify(data)});
  await page.goto(`${results}&qa=geometry#event-${copy.id}`);
  await expect(page.getByRole('combobox',{name:'หน้าบนแผนที่'})).toHaveValue('houses');
  const size=page.getByRole('combobox',{name:'ขนาดหน้าจอที่เก็บข้อมูล'});await expect(size.locator('option')).toHaveCount(2);
  await expect(size).toContainText(`${copy.viewportHeight}`);
  await expect(page.getByRole('region',{name:'รายละเอียดคลิก'})).toContainText(copy.id);
  await page.getByRole('combobox',{name:'หน้าบนแผนที่'}).selectOption('dashboard');
  await expect(size.locator('option')).toHaveCount(1);await expect(page.getByRole('region',{name:'รายละเอียดคลิก'})).toHaveCount(0);
  await page.goto(linked);await expect(size.locator('option')).toHaveCount(1);await expect(page.locator('button[aria-label^="เลือกคลิก "]')).toHaveCount(1);
  await expect(page.getByRole('region',{name:'รายละเอียดคลิก'})).toContainText(point.id);expect(await read(page)).toEqual(data);
});

test('keyboard-only activity has no click map or fabricated positions',async({page,context})=>{
  const {point,results,store}=await resultsFixture(page,context);
  const {documentX,documentY,...rest}=point;
  const data={...store,findings:[],reports:[],behaviorEvents:[{...rest,type:'action' as const}]};
  await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key:STORAGE_KEY,raw:JSON.stringify(data)});
  await page.goto(`${results}&qa=keyboard`);
  await expect(page.getByText('ยังไม่มีพิกัดคลิก การกดด้วยคีย์บอร์ดดูได้จากรายการเหตุการณ์',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'ขยายแผนที่'})).toHaveCount(0);expect(await read(page)).toEqual(data);
});
