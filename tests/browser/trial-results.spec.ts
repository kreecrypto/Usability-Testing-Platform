import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { addFinding, makeReport, STORAGE_KEY } from '../../src/lib/trial/model.ts';
import { seed, read, start } from './trial-fixtures';

async function resultsFixture(page: Page, context: BrowserContext, existingUrl?: string) {
  const url = existingUrl || await seed(context);
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page, url);
  await page.frameLocator('iframe').getByRole('link', { name: 'บ้านทั้งหมด', exact: true }).click();
  await page.frameLocator('iframe').locator('[data-element-id="houses-house12"]').click();
  await expect.poll(async () => (await read(page)).behaviorEvents?.filter(e => e.elementId === 'houses-house12').length).toBe(1);
  await page.getByLabel('คุณทำโจทย์นี้ได้หรือไม่').selectOption('done');
  await page.getByRole('button', { name: 'บันทึกและไปข้อถัดไป' }).click();
  await page.getByRole('button', { name: 'ส่งคำตอบทั้งหมด' }).click();
  const store = await read(page);
  const point = store.behaviorEvents!.find(e => e.elementId === 'houses-house12')!;
  const next = makeReport(addFinding(store, { id: 'f', versionId: point.versionId, problem: 'Synthetic QA', impact: 'QA only', recommendation: 'QA only', evidence: [{ sessionId: point.sessionId, taskId: point.taskId, kind: 'heatmap', eventIds: [point.id] }] }), point.versionId);
  await page.evaluate(({ key, raw }) => localStorage.setItem(key, raw), { key: STORAGE_KEY, raw: JSON.stringify(next) });
  const results = `/trial?step=results&p=p&t=t&v=${point.versionId}`;
  const linked = `${results}&report=${next.reports[0].id}&fi=0&ei=0#event-${point.id}`;
  return { point, results, linked, store: next };
}

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
    const marker = page.locator(`span[title="เหตุการณ์ ${point.id}"]`);
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
  await expect(page.locator('span[title^="เหตุการณ์ "]')).toHaveCount(0);
  release();
  await expect(page.getByText(/โหลดแผนที่ตำแหน่งคลิกไม่สำเร็จ/)).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: 'ลองโหลดแผนที่อีกครั้ง' }).press('Enter');
  await expect(page.locator('span[title^="เหตุการณ์ "]')).toHaveCount(1);
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
  await expect(page.locator('span[title^="เหตุการณ์ "]')).toHaveCount(0);
  await expect(page.locator('article[id^="event-"]')).toHaveCount(1);
  expect(await read(page)).toEqual(store);
});
