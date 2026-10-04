import { expect, type Page, type BrowserContext } from '@playwright/test';
import { blankStore, publish, startSession, STORAGE_KEY, type Store } from '../../src/lib/trial/model.ts';
import { SIMULATION_LAYOUT, type BehaviorEvent } from '../../src/lib/trial/behavior.ts';
export function fixture() {
  const published = publish({ ...blankStore(), projects: [{ id: 'p', name: 'Browser QA', goal: 'Synthetic fixture only' }], tests: [{ id: 't', projectId: 'p', title: 'Recovery QA', draft: { testId: 't', title: 'Recovery QA', url: 'https://example.com', target: { kind: 'simulation', layoutVersion: SIMULATION_LAYOUT }, tasks: [{ id: 'task', instruction: 'ค้นหาบ้านหนึ่งหลัง' }] } }] }, 't');
  return startSession(published, published.versions[0].id);
}
export async function seed(context: BrowserContext) {
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
export async function read(page: Page): Promise<Store> {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), STORAGE_KEY);
}
export async function start(page: Page, url: string) {
  await page.goto(url);
  await expect(page.getByRole('heading', { name: 'Recovery QA', exact: true })).toBeVisible();
  if (await page.getByRole('checkbox', { name: 'ยินยอมให้เก็บพฤติกรรมบนเว็บจำลอง' }).count()) {
    await page.getByRole('checkbox', { name: 'ยินยอมให้เก็บพฤติกรรมบนเว็บจำลอง' }).check();
    await page.getByRole('button', { name: 'เริ่มเว็บจำลอง', exact: true }).click();
  }
  await expect(page.locator('iframe')).toHaveCount(1);
  await expect.poll(async () => (await read(page)).behaviorEvents?.length || 0).toBeGreaterThan(0);
}
