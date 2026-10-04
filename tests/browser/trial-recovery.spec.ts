import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { blankStore, publish, startSession, STORAGE_KEY, type Store } from '../../src/lib/trial/model.ts';
import { SIMULATION_LAYOUT, type BehaviorEvent } from '../../src/lib/trial/behavior.ts';

function fixture() {
  const published = publish({ ...blankStore(), projects: [{ id: 'p', name: 'Browser QA', goal: 'Synthetic fixture only' }], tests: [{ id: 't', projectId: 'p', title: 'Recovery QA', draft: { testId: 't', title: 'Recovery QA', url: 'https://example.com', target: { kind: 'simulation', layoutVersion: SIMULATION_LAYOUT }, tasks: [{ id: 'task', instruction: 'ค้นหาบ้านหนึ่งหลัง' }] } }] }, 't');
  return startSession(published, published.versions[0].id);
}
async function seed(context: BrowserContext) {
  const data = fixture();
  await context.addInitScript(({ key, raw }) => {
    if (location.origin === 'http://127.0.0.1:3033' && !localStorage.getItem(key)) localStorage.setItem(key, raw);
    // Fault injection exists only inside the browser test context, never app code.
    const original = Storage.prototype.setItem;
    Object.assign(window, { qaFailWrites: false, qaFailedEvent: null });
    Storage.prototype.setItem = function (k, value) {
      const state = window as unknown as { qaFailWrites: boolean; qaFailedEvent: unknown };
      if (k === key && state.qaFailWrites) {
        state.qaFailedEvent = JSON.parse(value).behaviorEvents?.at(-1);
        throw new DOMException('QA quota exhausted', 'QuotaExceededError');
      }
      return original.call(this, k, value);
    };
  }, { key: STORAGE_KEY, raw: JSON.stringify(data.store) });
  return `/trial?step=participant&p=p&t=t&v=${data.session.versionId}&s=${data.session.id}`;
}
async function read(page: Page): Promise<Store> {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
}
async function start(page: Page, url: string) {
  await page.goto(url);
  if (await page.getByRole('checkbox', { name: 'ยินยอมให้เก็บพฤติกรรมบนเว็บจำลอง' }).count()) {
    await page.getByRole('checkbox', { name: 'ยินยอมให้เก็บพฤติกรรมบนเว็บจำลอง' }).check();
    await page.getByRole('button', { name: 'เริ่มเว็บจำลอง', exact: true }).click();
  }
  await expect(page.locator('iframe')).toHaveCount(1);
  await expect.poll(async () => (await read(page)).behaviorEvents?.length || 0).toBeGreaterThan(0);
}
async function failClick(page: Page) {
  await page.evaluate(() => { (window as unknown as { qaFailWrites: boolean }).qaFailWrites = true; });
  await page.frameLocator('iframe').getByRole('link', { name: 'บ้านทั้งหมด', exact: true }).click();
  await expect(page.getByText('หยุดเก็บพฤติกรรมชั่วคราว', { exact: true })).toBeVisible();
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'บันทึกและไปข้อถัดไป' })).toBeDisabled();
  return page.evaluate(() => (window as unknown as { qaFailedEvent: BehaviorEvent }).qaFailedEvent);
}

test('quota pauses real runner/navigation; exact pending event retries once and survives refresh', async ({ page, context }) => {
  const url = await seed(context);
  await start(page, url);
  const before = await read(page);
  const pending = await failClick(page);
  expect((await read(page)).behaviorEvents).toEqual(before.behaviorEvents);
  await page.getByRole('button', { name: 'พักไว้และกลับไปแบบทดสอบ' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'มีเหตุการณ์ค้างบันทึก ให้บันทึกเหตุการณ์ค้างก่อนออกจากโจทย์' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'โจทย์ 1', exact: true })).toBeVisible();
  await page.evaluate(() => { (window as unknown as { qaFailWrites: boolean }).qaFailWrites = false; });
  await page.getByRole('button', { name: 'บันทึกเหตุการณ์ค้างและทำต่อ' }).click();
  await expect(page.locator('iframe')).toHaveCount(1);
  await expect.poll(async () => (await read(page)).behaviorEvents?.filter(e => e.id === pending.id).length).toBe(1);
  expect((await read(page)).behaviorEvents?.find(e => e.id === pending.id)).toEqual(pending);
  await page.reload();
  await expect(page.locator('iframe')).toHaveCount(1);
  expect((await read(page)).behaviorEvents?.filter(e => e.id === pending.id)).toHaveLength(1);
});

test('another tab changes the store: load latest before retry, preserving pending identity and unique sequence', async ({ page, context }) => {
  const url = await seed(context);
  await start(page, url);
  const pending = await failClick(page);
  const other = await context.newPage();
  await start(other, url);
  await other.frameLocator('iframe').getByRole('link', { name: 'บ้านทั้งหมด', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'ข้อมูลเปลี่ยนในแท็บอื่น โหลดข้อมูลล่าสุดก่อนทำต่อ' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'บันทึกเหตุการณ์ค้างและทำต่อ' })).toBeDisabled();
  await page.evaluate(() => { (window as unknown as { qaFailWrites: boolean }).qaFailWrites = false; });
  await other.close();
  await page.getByRole('button', { name: 'โหลดข้อมูลล่าสุด' }).click();
  await page.getByRole('button', { name: 'บันทึกเหตุการณ์ค้างและทำต่อ' }).click();
  await expect(page.locator('iframe')).toHaveCount(1);
  const events = (await read(page)).behaviorEvents!;
  expect(events.filter(e => e.id === pending.id)).toHaveLength(1);
  const accepted = events.find(e => e.id === pending.id)!;
  expect({ ...accepted, sequence: pending.sequence }).toEqual(pending);
  expect(new Set(events.map(e => e.sequence)).size).toBe(events.length);
});

test('another tab finishes task: pending events cannot enter results; export and acknowledgement recover', async ({ page, context }) => {
  const url = await seed(context);
  await start(page, url);
  const pending = await failClick(page);
  const other = await context.newPage();
  await start(other, url);
  await other.getByLabel('คุณทำโจทย์นี้ได้หรือไม่').selectOption('done');
  await other.getByRole('button', { name: 'บันทึกและไปข้อถัดไป' }).click();
  await expect(other.getByRole('heading', { name: 'ตรวจคำตอบก่อนส่ง' })).toBeVisible();
  await page.getByRole('button', { name: 'โหลดข้อมูลล่าสุด' }).click();
  await expect(page.getByRole('heading', { name: 'เก็บเหตุการณ์ค้างก่อนใช้ข้อมูลล่าสุด' })).toBeVisible();
  expect((await read(page)).behaviorEvents?.some(e => e.id === pending.id)).toBe(false);
  const recovery = page.getByRole('button', { name: 'ใช้ข้อมูลล่าสุดและออกจากสถานะค้าง' });
  await expect(recovery).toBeDisabled();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'ดาวน์โหลดเหตุการณ์ที่ยังไม่ได้บันทึก' }).click();
  const download = await downloadPromise;
  const { readFile } = await import('node:fs/promises');
  const exported = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(exported.accepted).toBe(false);
  expect(exported.events.some((e: BehaviorEvent) => e.id === pending.id)).toBe(true);
  await page.getByRole('checkbox', { name: 'เข้าใจว่าเหตุการณ์ค้างจะไม่ถูกนับ และพร้อมใช้ข้อมูลที่อีกแท็บบันทึกแล้ว' }).check();
  await recovery.click();
  await expect(page.getByRole('heading', { name: 'ตรวจคำตอบก่อนส่ง' })).toBeVisible();
  expect((await read(page)).behaviorEvents?.some(e => e.id === pending.id)).toBe(false);
});
