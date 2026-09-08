import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const requestedGroup = process.argv[2] ?? 'all';
const validGroups = new Set(['all', 'inventory', 'tokens', 'baseline', 'accessibility']);

if (!validGroups.has(requestedGroup)) {
  console.error(`FAIL: unknown QA group ${requestedGroup}`);
  process.exit(2);
}

const mapPath = 'docs/design-system/screen-component-map.json';
const baselinePath = 'docs/design-system/baseline.md';
const a11yPath = 'docs/design-system/accessibility-state-matrix.md';
const tokenPath = 'src/styles/tokens.css';

for (const p of [mapPath, baselinePath, a11yPath, tokenPath]) {
  if (!fs.existsSync(path.join(root, p))) {
    throw new Error(`Missing design-system artifact: ${p}`);
  }
}

const map = JSON.parse(read(mapPath));
const baseline = read(baselinePath);
const a11y = read(a11yPath);
const tokens = read(tokenPath);

const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
};

const run = (group, check) => {
  if (requestedGroup === 'all' || requestedGroup === group) check();
};

run('inventory', () => {
  const ids = map.screens.map((screen) => screen.id);
  const uniqueIds = new Set(ids);
  const stateCount = map.screens.reduce((sum, screen) => sum + screen.states.length, 0);

  if (map.screens.length !== 48) fail(`expected 48 screens, got ${map.screens.length}`);
  if (uniqueIds.size !== 48) fail(`expected 48 unique screen ids, got ${uniqueIds.size}`);
  if (stateCount !== 170) fail(`expected 170 states, got ${stateCount}`);

  const expectedIds = [
    ...Array.from({ length: 36 }, (_, i) => `S${String(i + 1).padStart(2, '0')}`),
    ...Array.from({ length: 12 }, (_, i) => `P${String(i + 1).padStart(2, '0')}`),
  ];

  for (const id of expectedIds) {
    if (!uniqueIds.has(id)) fail(`missing screen ${id}`);
  }

  for (const screen of map.screens) {
    if (!Array.isArray(screen.states) || screen.states.length === 0) fail(`${screen.id} has no states`);
    if (!Array.isArray(screen.componentFamilies) || screen.componentFamilies.length === 0) fail(`${screen.id} has no component family mapping`);
  }

  if (!process.exitCode) console.log(`PASS inventory: ${map.screens.length} screens / ${stateCount} states`);
});

run('tokens', () => {
  const requiredTokens = [
    '--ut-color-brand',
    '--ut-color-text-primary',
    '--ut-color-bg-surface',
    '--ut-color-border-default',
    '--ut-color-focus-ring',
    '--ut-color-success',
    '--ut-color-warning',
    '--ut-color-error',
    '--ut-color-info',
    '--ut-color-outcome-technical',
    '--ut-data-1',
    '--ut-heatmap-1',
    '--ut-font-family-sans',
    '--ut-type-body-size',
    '--ut-space-4',
    '--ut-radius-sm',
    '--ut-shadow-card',
    '--ut-breakpoint-desktop-small',
  ];

  for (const token of requiredTokens) {
    if (!tokens.includes(token)) fail(`missing semantic token ${token}`);
  }

  if (!process.exitCode) console.log(`PASS tokens: ${requiredTokens.length} required semantic tokens`);
});

run('baseline', () => {
  const baselineSections = [
    'DS-02 — Foundation Color & Semantic Tokens',
    'DS-03 — Typography Scale & Content Hierarchy',
    'DS-04 — Spacing, Grid, Radius & Elevation',
    'DS-05 — Form, Action & Feedback Components',
    'DS-06 — Navigation & Responsive App Shell',
    'DS-07 — Data Display Components',
    'DS-08 — Analytics Visualization Extensions',
  ];

  for (const section of baselineSections) {
    if (!baseline.includes(section)) fail(`missing baseline section ${section}`);
  }

  if (!process.exitCode) console.log('PASS baseline: DS-02 through DS-08');
});

run('accessibility', () => {
  const accessibilitySignals = [
    'Focus Visible',
    'keyboard',
    'color alone',
    'Loading',
    'Restricted',
    'Heatmap',
    'Participant runner',
  ];

  for (const signal of accessibilitySignals) {
    if (!a11y.toLowerCase().includes(signal.toLowerCase())) fail(`accessibility matrix missing signal: ${signal}`);
  }

  if (!process.exitCode) console.log(`PASS accessibility: ${accessibilitySignals.length} required signals`);
});

if (requestedGroup === 'all' && !process.exitCode) {
  console.log('PASS design-system QA: inventory + tokens + baseline + accessibility');
}
