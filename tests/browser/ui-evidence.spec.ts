import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {buildResultsModel} from '../../src/lib/analytics/results.ts';
import {buildUsabilityReport} from '../../src/lib/reports/model.ts';
const version='00000000-0000-4000-8000-000000000001';
const context={testId:'qa-study',testVersionId:version,versionNo:1,lifecycleStatus:'published',publishedAt:'2026-01-01T00:00:00Z',target:{provider:'first_party_web',sourceUrl:'https://example.com/qa',environment:'uat',launchMode:'embed',snapshotVersion:1,capabilities:{pointer:'Available' as const,path:'Available' as const,screen:'Available' as const}}};
const results=buildResultsModel({testVersionId:version,context,events:[],tasks:[]});
const report=buildUsabilityReport({results,context,findings:[],evidenceByFinding:{},retests:[],generatedAt:'2026-01-01T00:00:00Z'});
async function scan(page:Page){const x=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();expect(x.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))).toEqual([]);}
for(const width of [1280,320,390])test(`evidence UI No Data, tabs and version provenance ${width}px (synthetic)`,async({page})=>{
 await page.route('**/api/**',route=>{
  const p=new URL(route.request().url()).pathname;
  if(p.startsWith('/api/results/'))return route.fulfill({json:{results}});
  if(p==='/api/findings')return route.fulfill({json:{findings:[]}});
  if(p.startsWith('/api/reports/'))return route.fulfill({json:{report}});
  if(p.startsWith('/api/retests/'))return route.fulfill({json:{retest:{retestId:'qa-retest',status:'draft',comparison:{metricKey:'completionRate',baseline:{testVersionId:version,value:null,sampleSize:0,technicalBlockedCount:0},retest:{testVersionId:'qa-new-version',value:null,sampleSize:0,technicalBlockedCount:0},absoluteDelta:null,relativeDeltaPercent:null}}}});
  return route.fulfill({status:503,json:{error:'qa_network_failure'}});
 });
 await page.setViewportSize({width,height:844});await page.goto(`/results/${version}`);
 await expect(page.getByRole('tabpanel')).toBeVisible();await expect(page.getByText('กำลังโหลดผลการทดสอบ…')).toHaveCount(0);
 const overview=page.getByRole('tab',{name:'ภาพรวม',exact:true});await overview.focus();await page.keyboard.press('ArrowRight');
 await expect(page.getByRole('tab',{name:'งานทดสอบ',exact:true})).toHaveAttribute('aria-selected','true');
 for(const label of ['ภาพรวม','งานทดสอบ','เส้นทาง','ฮีตแมป','ลำดับขั้น','รอบการทดสอบ']){
  const tab=page.getByRole('tab',{name:label,exact:true});await expect(tab).toHaveCount(1);await tab.click();await scan(page);
 }
 expect(results.overview.completionRate).toBeNull();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 for(const route of ['findings','reports','retests']){
  await page.goto(`/${route}/${version}`);await expect(page.getByRole('heading',{level:1})).toBeVisible();
  await expect(page.getByText(/กำลังโหลด/)).toHaveCount(0);await scan(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
});
test('evidence permission/network errors stay distinct and do not invent metrics',async({page})=>{
 await page.route('**/api/**',route=>route.fulfill({status:403,json:{error:'forbidden'}}));
 await page.goto(`/reports/${version}`);await expect(page.getByRole('main').getByRole('alert')).toContainText('คุณไม่มีสิทธิ์เข้าถึงเวิร์กสเปซนี้');await scan(page);
 await page.unroute('**/api/**');await page.route('**/api/**',route=>route.abort());
 await page.goto(`/results/${version}`);await expect(page.getByRole('main').getByRole('alert')).toContainText('ยังเปิดผลการทดสอบไม่ได้');await scan(page);
});
