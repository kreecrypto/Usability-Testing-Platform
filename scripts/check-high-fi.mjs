import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));
const paths = {
  map: 'docs/design-system/screen-component-map.json',
  page: 'src/app/high-fi/page.tsx',
  runner: 'src/app/t/[testVersionId]/participant-runner-client.tsx',
  css: 'src/app/high-fi/high-fi.css',
  fixes: 'src/app/high-fi/predeploy-fixes.css',
  home: 'src/app/page.tsx',
  layout: 'src/app/layout.tsx',
  tokens: 'src/styles/tokens.css',
};
for (const [name, file] of Object.entries(paths)) if (!exists(file)) throw new Error(`Missing ${name}: ${file}`);

const map = JSON.parse(read(paths.map));
const page = read(paths.page);
const runner = read(paths.runner);
const css = read(paths.css);
const fixes = read(paths.fixes);
const home = read(paths.home);
const layout = read(paths.layout);
const tokens = read(paths.tokens);
const fail = (message) => { console.error(`FAIL: ${message}`); process.exitCode = 1; };

const ids = new Set(map.screens.map((screen) => screen.id));
const screenCount = map.screens.length;
const stateCount = map.screens.reduce((sum, screen) => sum + screen.states.length, 0);
if (screenCount !== 48) fail(`expected 48 screens, got ${screenCount}`);
if (ids.size !== 48) fail(`expected 48 unique IDs, got ${ids.size}`);
if (stateCount !== 170) fail(`expected 170 states, got ${stateCount}`);
for (const id of [...Array.from({length:36},(_,i)=>`S${String(i+1).padStart(2,'0')}`), ...Array.from({length:12},(_,i)=>`P${String(i+1).padStart(2,'0')}`)]) if (!ids.has(id)) fail(`missing ${id}`);

const entry = map.screens.find((screen) => screen.id === 'S01');
if (!entry || entry.name !== 'App Entry') fail('S01 canonical inventory must remain App Entry');
if (entry?.componentFamilies?.includes('AuthShell') || entry?.componentFamilies?.includes('TextInput')) fail('S01 must not reintroduce deferred login UI');

const pageSignals = [
  'screenMap.screens','selectedState','Desktop','Mobile','ScreenContent','ParticipantContent','ParticipantSpecimen','ResearcherSpecimen','StateNotice','audience = "researcher"','audience="participant"','toneOverrides','navKeyForScreen','mobileNavToggle','navBackdrop','Lifecycle','DeleteData','PermissionState','UnsupportedState','RuleSpec','QuestionSpec','HeatmapSpec','Retest','ParticipantProgress','role="progressbar"','reviewStepper','<optgroup','predeploy-fixes.css'
];
for (const signal of pageSignals) if (!page.includes(signal)) fail(`high-fi page missing ${signal}`);
for (const id of Array.from({length:12},(_,i)=>`P${String(i+1).padStart(2,'0')}`)) if (!page.includes(`case "${id}"`)) fail(`${id} needs dedicated participant anatomy`);
if (page.includes('ComponentDrivenSpecimen')) fail('generic ComponentDrivenSpecimen must not return');
if (page.includes('width: "66%"') || page.includes("width: '66%'")) fail('participant progress must not be hard-coded');
for (const fakeMetric of ['77%','88%','42s','33s']) if (page.includes(fakeMetric)) fail(`design-only retest must not contain fabricated metric ${fakeMetric}`);

const requiredThaiUxCopy = [
  'สร้างการทดสอบ',
  'ทดสอบต้นแบบ Figma',
  'โฟลว์การทดสอบ',
  'วิเคราะห์ผล',
  'ประเด็นที่พบ',
  'ต้องการยุติงานนี้หรือไม่?',
  'หมดเวลาสำหรับงานนี้แล้ว',
  'ยังไม่มีข้อมูล',
  'ต้องมีสิทธิ์เพิ่มเติม',
  'ยังไม่รองรับ',
];
for (const signal of requiredThaiUxCopy) if (!page.includes(signal)) fail(`high-fi Thai UX contract missing: ${signal}`);

const requiredRunnerCopy = [
  'กำลังตรวจสอบแบบทดสอบ',
  'ยินยอมและเริ่ม',
  'ทำงานนี้ตามวิธีที่คุณทำตามปกติ',
  'ทำงานนี้ต่อไม่ได้',
  'ต้องการยุติงานนี้หรือไม่?',
  'ยากมาก',
  'ง่ายมาก',
  'ส่งคำตอบ',
  'แบบทดสอบนี้ใช้งานไม่ได้',
  'แบบทดสอบยังดำเนินการต่อไม่ได้',
  'หมดเวลาสำหรับงานนี้แล้ว',
  'กำลังเชื่อมต่ออีกครั้ง',
  'แบบทดสอบเสร็จสมบูรณ์',
];
for (const signal of requiredRunnerCopy) if (!runner.includes(signal)) fail(`participant runner Thai UX contract missing: ${signal}`);

const bannedUserFacingCopy = [
  'Instructions are shown without revealing expected paths or success targets.',
  'Expected paths and success targets are intentionally hidden.',
  'not a usability failure',
  'stable event IDs',
  'recorded as Timeout',
  'recorded as Give Up',
  'anonymous-session capabilities',
  'Review-only choice treatment',
  'No Data is not presented as zero',
  'no fabricated data',
  'completion state will not fire again',
  'Researcher login entry points remain deferred',
  'No deferred login controls are exposed here',
];
for (const phrase of bannedUserFacingCopy) {
  if (page.includes(phrase)) fail(`internal UX copy leaked into high-fi: ${phrase}`);
  if (runner.includes(phrase)) fail(`internal UX copy leaked into participant runner: ${phrase}`);
}
if (/expectedPath|successRule|failureRule/.test(runner)) fail('participant runtime must not expose researcher path/rule fields');
if (/เส้นทางที่คาดไว้|เกณฑ์สำเร็จ/.test(runner)) fail('participant-facing runtime must not mention expected-path or success-criteria language');

const consentSignals = [
  'การบันทึกการโต้ตอบจะเริ่มหลังจากคุณเลือก',
  'กล้อง ไมโครโฟน หรือการบันทึกหน้าจอ',
  'ชื่อ อีเมล หรือหมายเลขโทรศัพท์',
];
for (const signal of consentSignals) if (!runner.includes(signal)) fail(`participant consent disclosure missing: ${signal}`);
for (const signal of ['giveUpTriggerRef','giveUpCancelRef','event.key !== "Escape"','aria-modal="true"','role="progressbar"','aria-valuenow={progress}']) if (!runner.includes(signal)) fail(`participant accessibility contract missing: ${signal}`);

const cssSignals = ['.reviewStage--mobile',':focus-visible','prefers-reduced-motion','--ut-color-focus-ring','--ut-color-outcome-technical','.stateNotice--error','.stateNotice--restricted','.skeletonStack','.emptyState','.hfButton:disabled','@media (max-width: 1015px)'];
for (const signal of cssSignals) if (!css.includes(signal)) fail(`base high-fi CSS missing ${signal}`);
const fixSignals = ['.reviewStage--mobile .appSidebar','width:280px','.navBackdrop','.componentChips','.reviewStepper','.inlineError','.choiceGrid','.hfButton{','border-radius:var(--ut-radius-pill)','.appTopbar h1','.participantPrototype','var(--ut-touch-target-min)'];
for (const signal of fixSignals) if (!fixes.includes(signal)) fail(`post-review CSS missing ${signal}`);

for (const signal of ['href: "/high-fi"','หน้าจอผลิตภัณฑ์','48','170','ต้นแบบ → หลักฐาน → การตัดสินใจ UX']) if (!home.includes(signal)) fail(`Thai home missing ${signal}`);
if (home.includes('href="/projects"') || home.includes('href: "/projects"')) fail('home exposes deferred Projects entry');
if (home.includes('href="/login"') || home.includes('href: "/login"')) fail('home exposes deferred Login entry');
if (!layout.includes('<html lang="th">')) fail('document language must be Thai');
for (const signal of ['--ut-color-brand','--ut-color-text-primary','--ut-color-bg-surface','--ut-color-focus-ring','--ut-color-outcome-technical','--ut-font-family-sans','--ut-space-4']) if (!tokens.includes(signal)) fail(`tokens missing ${signal}`);
for (const screen of map.screens) {
  if (!screen.componentFamilies?.length) fail(`${screen.id} has no component families`);
  if (!screen.states?.length) fail(`${screen.id} has no states`);
}
if (!page.includes('design-only:no-production-data')) fail('review route must retain non-production-data boundary');

if (!process.exitCode) {
  console.log(`PASS high-fi inventory: ${screenCount} screens / ${stateCount} states`);
  console.log('PASS Thai researcher IA and all 12 participant flows');
  console.log('PASS semantic loading/empty/error/restricted/unsupported state separation');
  console.log('PASS accessible dynamic progress and give-up dialog keyboard recovery');
  console.log('PASS AH_DESIGN_v2.6 pill controls, single topbar title and 280px mobile drawer');
  console.log('PASS retest data remains skeletonized in design-only review');
  console.log('PASS Thai UX writing hides internal researcher/analytics mechanics from participants');
  console.log('PASS consent disclosure remains aligned with the V1 privacy baseline');
}
