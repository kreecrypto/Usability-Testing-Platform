import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const { readCheckpoint, writeCheckpoint } = await import(pathToFileURL(resolve('scripts/agentic/checkpoint.mjs')).href);
test('checkpoint preserves exact branch/PR and malformed files are not overwritten on read', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'utp-agentic-'));
  try {
    const path = join(dir, 'run.json'); assert.equal(await readCheckpoint(path), null);
    const state = { version: 1, runId: 'run-1', owner: 'root', majorId: 'MAJOR-02', startedAt: 1000, revision: 1,
      tasks: [{ id: 'MT-07', majorId: 'MAJOR-02', stage: 'REVIEWED', commit: 'a'.repeat(40), branch: 'codex/task-MT-07',
        acceptance: 'Verified behavior', developer: 'developer', worktree: '/tmp/task', checks: ['PASS'],
        qa: { agentId: 'reviewer', commit: 'a'.repeat(40), result: 'PASS', criticalCount: 0, evidence: ['review PASS'] },
        prUrl: 'https://github.com/kreecrypto/Usability-Testing-Platform/pull/123' }] };
    await writeCheckpoint(path, state); assert.deepEqual(await readCheckpoint(path), state);
    await writeFile(path, '{broken'); await assert.rejects(readCheckpoint(path)); assert.equal(await readFile(path, 'utf8'), '{broken');
    await assert.rejects(writeCheckpoint(path, { ...state, tasks: [...state.tasks, ...state.tasks] }), { code: 'SOURCE_GAP' });
  } finally { await rm(dir, { recursive: true, force: true }); }
});
