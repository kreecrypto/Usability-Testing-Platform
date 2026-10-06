import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateCheckpoint } from './orchestration.mjs';

export async function readCheckpoint(path) {
  try { return validateCheckpoint(JSON.parse(await readFile(path, 'utf8'))); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
export async function writeCheckpoint(path, state) {
  validateCheckpoint(state);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
    await rename(temporary, path);
  } finally { await rm(temporary, { force: true }); }
}
