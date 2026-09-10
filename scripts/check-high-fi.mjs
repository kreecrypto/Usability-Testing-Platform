import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));

const paths = {
  map: 'docs/design-system/screen-component-map.json',
  page: 'src/app/high-fi/page.tsx',
  css: 'src/app/high-fi/high-fi.css',
  predeployCss: 'src/app/high-fi/predeploy-fixes.css',
  home: 'src/app/page.tsx',
  tokens: 'src/styles/tokens.css',
};

for (const [name, file] of Object.entries(paths)) {
  if (!exists(file)) throw new Error(`Missing ${name} artifact: ${file}`);
}

const map = JSON.parse(read(paths.map));
const page = read(paths.page);
const css = read(paths.css);
const predeployCss = read(paths.predeployCss);
const home = read(paths.home);
const tokens = read(paths.tokens);
const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
};

const screenCount = map.screens.length;
const stateCount = map.screens.reduce((sum, screen) => sum + screen.states.length, 0);
const ids = new Set(map.screens.map((screen) => screen.id));

if (screenCount !== 48) fail(`expected 48 screens, got ${screenCount}`);
if (ids.size !== 48) fail(`expected 48 unique screen IDs, got ${ids.size}`);
if (stateCount !== 170) fail(`expected 170 states, got ${stateCount}`);

const expectedIds = [
  ...Array.from({ length: 36 }, (_, i) => `S${String(i + 1).padStart(2, '0')}`),
  ...Array.from({ length: 12 }, (_, i) => `P${String(i + 1).padStart(2, '0')}`),
];
for (const id of expectedIds) {
  if (!ids.has(id)) fail(`missing screen ID ${id}`);
}

const entryScreen = map.screens.find((screen) => screen.id === 'S01');
if (!entryScreen) fail('missing canonical S01 App Entry screen');
else {
  if (entryScreen.name !== 'App Entry') fail(`S01 expected deferred App Entry, got ${entryScreen.name}`);
  if (entryScreen.componentFamilies?.includes('AuthShell')) fail('S01 must not expose AuthShell while login UI is deferred');
  if (entryScreen.componentFamilies?.includes('TextInput')) fail('S01 must not expose login text inputs while login UI is deferred');
}

const pageSignals = [
  'screenMap.screens',
  'selectedState',
  'Desktop',
  'Mobile',
  'ScreenContent',
  'ParticipantContent',
  'StateNotice',
  'Heatmap',
  'Retest comparison',
  'ComponentDrivenSpecimen',
  'navKeyForScreen',
  'mobileNavToggle',
  'BuildLifecycle',
  'Share · Locked',
  'aria-current="step"',
  'predeploy-fixes.css',
];
for (const signal of pageSignals) {
  if (!page.includes(signal)) fail(`high-fi page missing signal: ${signal}`);
}

const requiredMappedParticipantScreens = [
  ['P05', 'Give Up Confirmation'],
  ['P10', 'Technical Blocked'],
];
for (const [id, name] of requiredMappedParticipantScreens) {
  const screen = map.screens.find((candidate) => candidate.id === id);
  if (!screen) fail(`missing canonical participant screen ${id}`);
  else if (screen.name !== name) fail(`${id} expected name ${name}, got ${screen.name}`);
}

const cssSignals = [
  '.reviewStage--mobile',
  ':focus-visible',
  'prefers-reduced-motion',
  '--ut-color-focus-ring',
  '--ut-color-outcome-technical',
  '.stateNotice--error',
  '.stateNotice--restricted',
  '.skeletonStack',
  '.emptyState',
  '.hfButton:disabled',
  '@media (max-width: 1015px)',
];
for (const signal of cssSignals) {
  if (!css.includes(signal)) fail(`high-fi CSS missing signal: ${signal}`);
}

const predeploySignals = [
  '.appSidebar.appSidebar--open nav',
  '.mobileNavToggle',
  '.builderStep.isCurrent',
  '.lifecycleStep.isLocked',
  'var(--ut-touch-target-min)',
];
for (const signal of predeploySignals) {
  if (!predeployCss.includes(signal)) fail(`predeploy UX CSS missing signal: ${signal}`);
}

const homeSignals = [
  'href: "/high-fi"',
  'Open product UI',
  'Canonical screens',
  'QA states',
];
for (const signal of homeSignals) {
  if (!home.includes(signal)) fail(`home page missing predeploy UX signal: ${signal}`);
}
if (home.includes('href="/projects"') || home.includes('href: "/projects"')) {
  fail('home page exposes Projects while researcher login UI is deferred');
}
if (home.includes('href="/login"') || home.includes('href: "/login"')) {
  fail('home page exposes Login while researcher login UI is deferred');
}
if (home.includes('<strong>27</strong><span>Planned screens</span>')) {
  fail('home page still reports stale 27-screen inventory');
}
if ((home.match(/href="#modules"/g) ?? []).length > 1) {
  fail('home page still contains duplicate module-only navigation targets');
}

const requiredTokenSignals = [
  '--ut-color-brand',
  '--ut-color-text-primary',
  '--ut-color-bg-surface',
  '--ut-color-focus-ring',
  '--ut-color-outcome-technical',
  '--ut-font-family-sans',
  '--ut-space-4',
];
for (const signal of requiredTokenSignals) {
  if (!tokens.includes(signal)) fail(`tokens missing ${signal}`);
}

for (const screen of map.screens) {
  if (!screen.componentFamilies?.length) fail(`${screen.id} has no component-family mapping`);
  if (!screen.states?.length) fail(`${screen.id} has no state coverage`);
}

if (!page.includes('no production-data claim')) {
  fail('high-fi route must retain explicit non-production-data boundary');
}

if (!process.exitCode) {
  console.log(`PASS high-fi inventory: ${screenCount} screens / ${stateCount} states`);
  console.log('PASS deferred S01 App Entry without researcher login controls');
  console.log('PASS researcher + participant renderer signals');
  console.log('PASS canonical participant screens: P05 Give Up Confirmation / P10 Technical Blocked');
  console.log('PASS desktop/mobile responsive signals');
  console.log('PASS mobile researcher navigation and S09 lifecycle/selection signals');
  console.log('PASS actionable root navigation and canonical coverage summary');
  console.log('PASS focus, disabled, loading, empty, error, restricted and reduced-motion signals');
  console.log('PASS Task 14 review-artifact boundary');
}
