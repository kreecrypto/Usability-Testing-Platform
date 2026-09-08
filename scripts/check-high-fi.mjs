import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));

const paths = {
  map: 'docs/design-system/screen-component-map.json',
  page: 'src/app/high-fi/page.tsx',
  css: 'src/app/high-fi/high-fi.css',
  tokens: 'src/styles/tokens.css',
};

for (const [name, file] of Object.entries(paths)) {
  if (!exists(file)) throw new Error(`Missing ${name} artifact: ${file}`);
}

const map = JSON.parse(read(paths.map));
const page = read(paths.page);
const css = read(paths.css);
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

const pageSignals = [
  'screenMap.screens',
  'selectedState',
  'Desktop',
  'Mobile',
  'ScreenContent',
  'ParticipantContent',
  'StateNotice',
  'Technical Blocked',
  'Heatmap',
  'Retest comparison',
  'Give Up Confirmation',
];
for (const signal of pageSignals) {
  if (!page.includes(signal)) fail(`high-fi page missing signal: ${signal}`);
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

// Prevent Task 14 from silently regressing to a few showcase screens.
for (const screen of map.screens) {
  if (!screen.componentFamilies?.length) fail(`${screen.id} has no component-family mapping`);
  if (!screen.states?.length) fail(`${screen.id} has no state coverage`);
}

// The artifact is explicitly a review implementation. Runtime integrations remain
// separate engineering tasks and must not be falsely claimed here.
if (!page.includes('no production-data claim')) {
  fail('high-fi route must retain explicit non-production-data boundary');
}

if (!process.exitCode) {
  console.log(`PASS high-fi inventory: ${screenCount} screens / ${stateCount} states`);
  console.log('PASS researcher + participant renderer signals');
  console.log('PASS desktop/mobile responsive signals');
  console.log('PASS focus, disabled, loading, empty, error, restricted and reduced-motion signals');
  console.log('PASS Task 14 review-artifact boundary');
}
