import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seed, resultsFixture, read } from './trial-fixtures';
async function scan(page:Page) {
  const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
  expect(result.violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)}))).toEqual([]);
}
for(const width of [1280,320,390]) {
  test(`public UI accessibility and native styles ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:844});
    for(const path of ['/','/demo/projects','/demo/test','/demo/results','/demo/findings','/demo/report','/demo/retest','/trial']) {
      await page.goto(path);
      await expect(page.getByRole('heading',{level:1})).toBeVisible();
      await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await scan(page);
    }
  });
  test(`Trial form submit and keyboard ${width}px`,async({page,context})=>{
    const url=await seed(context);await page.setViewportSize({width,height:844});
    await page.goto(url.replace('step=participant','step=test'));
    await scan(page);
    await page.goto(url);
    await expect(page.getByRole('heading',{name:'Recovery QA',exact:true})).toBeVisible();
    await scan(page);
  });
}

test('Heatmap expanded dialog is accessible, traps focus, closes and preserves evidence',async({page,context})=>{
  const {linked,store}=await resultsFixture(page,context);await page.goto(linked);
  await expect(page.getByRole('button',{name:'เลือกคลิก 1',exact:true})).toBeVisible();await scan(page);
  await page.getByRole('button',{name:'ขยายแผนที่',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'แผนที่ตำแหน่งคลิกขนาดใหญ่'});await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button',{name:'เลือกคลิก 1',exact:true})).toBeVisible();
  await scan(page);
  for(let i=0;i<8;i++){await page.keyboard.press('Tab');expect(await dialog.evaluate(el=>el.contains(document.activeElement))).toBe(true);}
  await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button',{name:'ขยายแผนที่',exact:true})).toBeFocused();expect(await read(page)).toEqual(store);
});
