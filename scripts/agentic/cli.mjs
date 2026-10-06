import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { parseSheetSnapshot, selectQueue } from './queue.mjs';
import { validateConfig } from './orchestration.mjs';

const config = validateConfig(JSON.parse(await readFile(new URL('../../agentic/config.json', import.meta.url), 'utf8')));
const [command, snapshotPath, majorId] = process.argv.slice(2);
if (command === 'dry-run' && snapshotPath) {
  const snapshot = JSON.parse(await readFile(resolve(snapshotPath), 'utf8'));
  const result = selectQueue(parseSheetSnapshot(snapshot), majorId ? { majorId } : {});
  console.log(JSON.stringify({ mode: 'read_only', config, ...result }, null, 2));
} else if (command === 'doctor') {
  console.log(JSON.stringify({ status: 'HOST_PREFLIGHT_REQUIRED', config, module: fileURLToPath(import.meta.url),
    checks: ['fresh Sheet snapshot', 'GitHub base/dependency', 'live lease functions and private grants',
      'no active conflicting lease', 'separate Developer/Reviewer', 'verified checkpoint store'],
    note: 'Local config is not proof of live integration readiness; this command never claims a MAJOR.' }, null, 2));
} else {
  console.error('Usage: node scripts/agentic/cli.mjs doctor | dry-run <connector-snapshot.json> [MAJOR-ID]');
  process.exitCode = 2;
}
