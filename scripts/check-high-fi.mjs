import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));
const paths = {
  map: 'docs/design-system/screen-component-map.json',
  page: 'src/app/high-fi/page.tsx',
  css: 'src/app/high-fi/high-fi.css',
  fixes: 'src/app/high-fi/predeploy-fixes.css',
  home: 'src/app/page.tsx',
  tokens: 'src/styles/tokens.css',
};
for (const [name, file] of Object.entries(paths)) if (!exists(file)) throw new Error(`Missing ${name}: ${file}`);

const map = JSON.parse(read(paths.map));
const page = read(paths.page);
const css = read(paths.css);
const fixes = read(paths.fixes);
const home = read(paths.home);
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
if (!entry || entry.name !== 'App Entry') fail('S01 must remain App Entry');
if (entry?.componentFamilies?.includes('AuthShell') || entry?.componentFamilies?.includes('TextInput')) fail('S01 must not reintroduce deferred login UI');

const pageSignals = [
  'screenMap.screens','selectedState','Desktop','Mobile','ScreenContent','ParticipantContent','ParticipantSpecimen','ResearcherSpecimen','StateNotice','toneOverrides','navKeyForScreen','mobileNavToggle','navBackdrop','Lifecycle','DeleteData','RuleSpec','QuestionSpec','HeatmapSpec','Retest','ParticipantProgress','role="progressbar"','reviewStepper','<optgroup','predeploy-fixes.css'
];
for (const signal of pageSignals) if (!page.includes(signal)) fail(`high-fi page missing ${signal}`);
for (const id of Array.from({length:12},(_,i)=>`P${String(i+1).padStart(2,'0')}`)) if (!page.includes(`case "${id}"`)) fail(`${id} needs dedicated participant anatomy`);
if (page.includes('ComponentDrivenSpecimen')) fail('generic ComponentDrivenSpecimen must not return');
if (page.includes('width: "66%"') || page.includes("width: '66%'")) fail('participant progress must not be hard-coded');
for (const fakeMetric of ['77%','88%','42s','33s']) if (page.includes(fakeMetric)) fail(`design-only retest must not contain fabricated metric ${fakeMetric}`);

const cssSignals = ['.reviewStage--mobile',':focus-visible','prefers-reduced-motion','--ut-color-focus-ring','--ut-color-outcome-technical','.stateNotice--error','.stateNotice--restricted','.skeletonStack','.emptyState','.hfButton:disabled','@media (max-width: 1015px)'];
for (const signal of cssSignals) if (!css.includes(signal)) fail(`base high-fi CSS missing ${signal}`);
const fixSignals = ['.reviewStage--mobile .appSidebar','width:280px','.navBackdrop','.componentChips','.reviewStepper','.inlineError','.choiceGrid','.hfButton{','border-radius:var(--ut-radius-pill)','.appTopbar h1','.participantPrototype','var(--ut-touch-target-min)'];
for (const signal of fixSignals) if (!fixes.includes(signal)) fail(`post-review CSS missing ${signal}`);

for (const signal of ['href: "/high-fi"','Open product UI','Canonical screens','QA states']) if (!home.includes(signal)) fail(`home missing ${signal}`);
if (home.includes('href="/projects"') || home.includes('href: "/projects"')) fail('home exposes deferred Projects entry');
if (home.includes('href="/login"') || home.includes('href: "/login"')) fail('home exposes deferred Login entry');
for (const signal of ['--ut-color-brand','--ut-color-text-primary','--ut-color-bg-surface','--ut-color-focus-ring','--ut-color-outcome-technical','--ut-font-family-sans','--ut-space-4']) if (!tokens.includes(signal)) fail(`tokens missing ${signal}`);
for (const screen of map.screens) {
  if (!screen.componentFamilies?.length) fail(`${screen.id} has no component families`);
  if (!screen.states?.length) fail(`${screen.id} has no states`);
}
if (!page.includes('no production-data claim')) fail('review route must retain non-production-data boundary');

if (!process.exitCode) {
  console.log(`PASS high-fi inventory: ${screenCount} screens / ${stateCount} states`);
  console.log('PASS explicit researcher anatomy and all 12 participant flows');
  console.log('PASS semantic state mapping and accessible dynamic progress');
  console.log('PASS AH_DESIGN_v2.6 pill controls and single topbar title pattern');
  console.log('PASS 280px mobile overlay drawer and review-tool grouped navigation');
  console.log('PASS retest data remains skeletonized in design-only review');
}
