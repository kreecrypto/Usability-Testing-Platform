import {test,expect} from '@playwright/test';
import {seed,start,read} from './trial-fixtures';
test('public pages and real simulated click → Results survive browser engines',async({page,context})=>{
  await page.goto('/');await expect(page.getByRole('heading',{level:1})).toBeVisible();
  const url=await seed(context);await page.setViewportSize({width:390,height:844});await start(page,url);
  await page.frameLocator('iframe').getByRole('link',{name:'บ้านทั้งหมด',exact:true}).click();
  await page.frameLocator('iframe').locator('[data-element-id="houses-house12"]').click();
  await expect.poll(async()=> (await read(page)).behaviorEvents?.filter(e=>e.elementId==='houses-house12').length).toBe(1);
  await page.getByLabel('คุณทำโจทย์นี้ได้หรือไม่').selectOption('done');
  await page.getByRole('button',{name:'บันทึกและไปข้อถัดไป'}).click();await page.getByRole('button',{name:'ส่งคำตอบทั้งหมด'}).click();
  await page.goto(url.replace('step=participant','step=results'));
  await expect(page.locator('canvas[data-density-state="ready"]')).toHaveCount(1);
  await page.getByRole('combobox',{name:'มุมมองแผนที่',exact:true}).selectOption('points');
  await expect(page.getByRole('button',{name:'เลือกคลิก 1',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'ขยายแผนที่',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:'ขยายแผนที่',exact:true})).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
