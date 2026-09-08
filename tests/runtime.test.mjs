import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const nvmrc = fs.readFileSync(new URL('../.nvmrc', import.meta.url), 'utf8').trim();

const allVersions = {
  ...pkg.dependencies,
  ...pkg.devDependencies,
};

test('runtime dependencies are exact and do not float', () => {
  for (const [name, version] of Object.entries(allVersions)) {
    assert.equal(typeof version, 'string', `${name} must have a string version`);
    assert.doesNotMatch(version, /latest|next|\*|\^|~|>=|<=|>|</, `${name} must be pinned exactly`);
  }
});

test('supported framework versions are pinned', () => {
  assert.equal(pkg.dependencies.next, '16.3.4');
  assert.equal(pkg.dependencies.react, '19.2.7');
  assert.equal(pkg.dependencies['react-dom'], '19.2.7');
  assert.equal(pkg.devDependencies.typescript, '5.9.3');
});

test('Node runtime is explicit and uses current LTS line', () => {
  assert.equal(pkg.engines.node, '>=24.0.0 <25');
  assert.equal(nvmrc, '24.20.0');
});

test('required CI commands exist', () => {
  for (const command of ['build', 'typecheck', 'test']) {
    assert.ok(pkg.scripts[command], `missing npm script: ${command}`);
  }
});
