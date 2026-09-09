import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const requestedGroup = process.argv[2] ?? 'all';
const validGroups = new Set(['all', 'authority', 'inventory', 'tokens', 'baseline', 'accessibility', 'runtime']);

if (!validGroups.has(requestedGroup)) {
  console.error(`FAIL: unknown QA group ${requestedGroup}`);
  process.exit(2);
}

const paths = {
  master: 'docs/design-system/AH_DESIGN_v2.6/00-master-and-core.md',
  tokensDoc: 'docs/design-system/AH_DESIGN_v2.6/01-tokens-and-shell.md',
  componentDoc: 'docs/design-system/AH_DESIGN_v2.6/03-components-and-layout.md',
  stateDoc: 'docs/design-system/AH_DESIGN_v2.6/04-page-contracts-responsive-states-a11y.md',
  runtimeDoc: 'docs/design-system/AH_DESIGN_v2.6/05-implementation-runtime-ai-rules.md',
  map: 'docs/design-system/screen-component-map.json',
  tokens: 'src/styles/tokens.css',
  globals: 'src/app/globals.css',
};

for (const file of Object.values(paths)) {
  if (!fs.existsSync(path.join(root, file))) {
    throw new Error(`Missing design-system artifact: ${file}`);
  }
}

const master = read(paths.master);
const tokensDoc = read(paths.tokensDoc);
const componentDoc = read(paths.componentDoc);
const stateDoc = read(paths.stateDoc);
const runtimeDoc = read(paths.runtimeDoc);
const map = JSON.parse(read(paths.map));
const tokens = read(paths.tokens);
const globals = read(paths.globals);

const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
};

const run = (group, check) => {
  if (requestedGroup === 'all' || requestedGroup === group) check();
};

function requireText(source, signal, label) {
  if (!source.includes(signal)) fail(`${label} missing required AH 2.6 signal: ${signal}`);
}

/* Authority is checked on every invocation so group-specific CI cannot bypass it. */
for (const signal of [
  'version: 2.6',
  'single source of truth',
  'complete visual authority',
  'Prefer this Design System over generic dashboard styling',
]) {
  requireText(master, signal, 'AH master');
}

for (const signal of [
  'cssVariablePrefix: "--ah"',
  'allowRawValues: false',
  '--ah-primary: #00008f',
  '--ah-sidebar-width: 200px',
  '--ah-font-primary',
]) {
  requireText(tokensDoc, signal, 'AH token contract');
}

run('authority', () => {
  console.log('PASS authority: AH_DESIGN_v2.6 is the canonical visual source');
});

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
  const exactRuntimeTokens = new Map([
    ['--ah-primary', '#00008f'],
    ['--ah-primary-deep', '#00006f'],
    ['--ah-primary-dark', '#000056'],
    ['--ah-primary-soft', '#e2efff'],
    ['--ah-app-bg', '#f0f6ff'],
    ['--ah-canvas', '#ffffff'],
    ['--ah-ink-deep', '#1a1d21'],
    ['--ah-ink', '#434956'],
    ['--ah-slate', '#606776'],
    ['--ah-sidebar-width', '200px'],
    ['--ah-main-pane-reference-width', '1080px'],
    ['--ah-content-gutter', '16px'],
    ['--ah-topbar-height', '64px'],
    ['--ah-radius-xs', '4px'],
    ['--ah-radius-sm', '8px'],
    ['--ah-radius-md', '12px'],
    ['--ah-radius-lg', '16px'],
    ['--ah-space-4', '4px'],
    ['--ah-space-8', '8px'],
    ['--ah-space-12', '12px'],
    ['--ah-space-16', '16px'],
    ['--ah-space-24', '24px'],
    ['--ah-space-32', '32px'],
  ]);

  for (const [name, value] of exactRuntimeTokens) {
    const pattern = new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*;`);
    if (!pattern.test(tokens)) fail(`runtime token ${name} must equal AH 2.6 value ${value}`);
  }

  for (const signal of [
    '--ah-font-primary: "DB Helvethaica X"',
    '--ah-type-display-xl-size: 32px',
    '--ah-type-display-xl-line-height: 42px',
    '--ah-type-heading-lg-size: 24px',
    '--ah-type-body-md-size: 16px',
    '--ah-type-button-md-size: 16px',
  ]) {
    requireText(tokens, signal, 'runtime tokens');
  }

  const legacyLines = tokens
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('--ut-'));
  const literalLegacy = legacyLines.filter((line) => {
    if (line.startsWith('--ut-space-0: 0;')) return false;
    if (line.startsWith('--ut-radius-none: 0;')) return false;
    if (line.startsWith('--ut-font-family-mono:')) return false;
    return !line.includes('var(--ah-');
  });
  if (literalLegacy.length > 0) {
    fail(`legacy --ut-* tokens must be aliases to --ah-* only: ${literalLegacy.join(' | ')}`);
  }

  if (!process.exitCode) console.log('PASS tokens: AH 2.6 values canonical; --ut-* compatibility aliases only');
});

run('baseline', () => {
  for (const [source, label, signals] of [
    [componentDoc, 'AH components', ['Shared Components', 'Layout', 'button']],
    [stateDoc, 'AH states/a11y', ['Responsive', 'Accessibility', 'focus']],
    [runtimeDoc, 'AH runtime rules', ['Implementation', 'Runtime', 'AI']],
  ]) {
    for (const signal of signals) requireText(source, signal, label);
  }
  if (!process.exitCode) console.log('PASS baseline: AH 2.6 component/layout/state/runtime contracts present');
});

run('accessibility', () => {
  for (const signal of ['focus', 'keyboard', 'color', 'loading', 'error']) {
    if (!stateDoc.toLowerCase().includes(signal)) fail(`AH accessibility/state contract missing signal: ${signal}`);
  }
  if (!process.exitCode) console.log('PASS accessibility: AH 2.6 state/accessibility contract present');
});

run('runtime', () => {
  const required = [
    'background: var(--ah-app-bg)',
    'color: var(--ah-ink-deep)',
    'font-family: var(--ah-font-primary)',
    'grid-template-columns: var(--ah-sidebar-width)',
  ];
  for (const signal of required) requireText(globals, signal, 'globals.css');

  for (const forbidden of ['font-family: Inter', 'grid-template-columns: 248px', '--accent:', '--bg:', '--radius:', '--shadow:']) {
    if (globals.includes(forbidden)) fail(`globals.css contains pre-AH styling authority: ${forbidden}`);
  }

  if (!process.exitCode) console.log('PASS runtime: global shell consumes AH 2.6 directly');
});

if (requestedGroup === 'all') {
  // all must include the runtime rule even though run() keeps groups individually addressable.
  const required = [
    'background: var(--ah-app-bg)',
    'font-family: var(--ah-font-primary)',
    'grid-template-columns: var(--ah-sidebar-width)',
  ];
  for (const signal of required) requireText(globals, signal, 'globals.css');
}

if (!process.exitCode) {
  console.log(`PASS AH Design System v2.6 QA (${requestedGroup})`);
}
