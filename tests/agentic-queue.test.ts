import assert from 'node:assert/strict';
import test from 'node:test';

// Variable URL intentionally keeps operational JS outside the application's TS module graph.
const moduleUrl = new URL('../scripts/agentic/queue.mjs', import.meta.url).href;
const { parseSheetSnapshot, selectQueue } = await import(moduleUrl);
const LIST = ['-', 'Task', 'Phase', 'Status', 'Priority', 'Area', 'Estimate Days', 'Dependency', 'Acceptance Criteria', 'Release Gate', 'Canonical Docs / Evidence', 'Task Level', 'Parent Major Task', 'Auto Eligible'];
const DETAIL = ['Order', 'Task', 'Phase', 'Status', 'Priority', 'Area', 'Estimate Days', 'Dependency', 'Acceptance Criteria', 'Release Gate'];
const HIERARCHY = ['Major Task ID', 'Major Task', 'Status', 'Priority', 'Dependency', 'Sub Task Scope', 'Auto Eligible', 'Auto Execution Rule', 'Completion Rule', 'Claim Owner', 'Lease Until', 'Last Run ID'];
const FEATURE = ['Feature Task ID', 'Parent Task', 'Level', 'Feature', 'Sequence', 'Work Item', 'Acceptance Criteria', 'Screen / Route', 'Dependency', 'Maps to Existing', 'Current Source State', 'Proof Gate', 'Execution Rule', 'Planning Status', 'Agent Owner', 'Agent Role'];
type TaskInput = { id: string; major?: string; status?: string; priority?: string; dep?: string; ac?: string };
function task(t: TaskInput) { return [String(Number(t.id) || 99), `${t.id} — Test ${t.id}`, '', t.status ?? 'TODO_EXECUTABLE', t.priority ?? 'P0', '', '', t.dep ?? '', t.ac ?? 'Observable acceptance', '', '', 'SUB_TASK', t.major ?? 'MAJOR-01', 'NO']; }
function major(id: string, state = 'IN_PROGRESS', priority = 'P0', dep = '', eligible = 'YES') { return [id, `Major ${id}`, state, priority, dep, 'Scope', eligible, 'Claim', 'Proof']; }
function sheet(title: string, headers: string[], rows: string[][]) { return { properties: { title }, data: [{ startRow: 0, rowData: [headers, ...rows].map(values => ({ values: values.map(formattedValue => ({ formattedValue })) })) }] }; }
function snapshot(inputs: TaskInput[] = [], majors = [major('MAJOR-01')], features: string[][] = []) {
  const list = inputs.map(task);
  return { sheets: [sheet('Task Hierarchy', HIERARCHY, majors), sheet('Task List', LIST, list), sheet('Task Detail', DETAIL, list.map(row => row.slice(0, 10))), sheet('Feature Tasks', FEATURE, features)] };
}
function selection(s: ReturnType<typeof snapshot>, options = {}) { return selectQueue(parseSheetSnapshot(s), options); }

test('parses connector result, zero-pads numeric IDs and reads prefixed IDs from names rather than order', () => {
  const raw = snapshot([{ id: '1', status: 'COMPLETE' }, { id: 'GWD-02', dep: '01' }]);
  const before = JSON.stringify(raw);
  const parsed = parseSheetSnapshot({ structuredContent: raw });
  assert.deepEqual(parsed.tasks.map((t: { id: string }) => t.id), ['01', 'GWD-02']);
  assert.equal(parsed.tasks[1].sourceRef, 'Task List!3');
  assert.equal(parsed.tasks[1].sourceGap, false);
  assert.deepEqual(selectQueue(parsed).tasks.map((t: { id: string }) => t.id), ['GWD-02']);
  assert.equal(JSON.stringify(raw), before);
});

test('completed tasks and unmet dependencies are skipped; batch does not pre-assume completion', () => {
  const selected = selection(snapshot([{ id: '01', status: 'COMPLETE' }, { id: '02', dep: '01' }, { id: '03', dep: '02' }]));
  assert.equal(selected.status, 'READY');
  assert.deepEqual(selected.tasks.map((t: { id: string }) => t.id), ['02']);
  assert.ok(selected.skipped.some((s: { id: string; reason: string }) => s.id === '03' && s.reason === 'TODO_DEPENDENCY_BLOCKED'));
});

test('continuation and QA precede priority, self-fixable blockers are last, and max three tasks', () => {
  const selected = selection(snapshot([{ id: '01', status: 'BLOCKED_SELF_FIXABLE' }, { id: '02', priority: 'P0' }, { id: '03', status: 'QA', priority: 'P2' }, { id: '04', status: 'IN PROGRESS', priority: 'P2' }, { id: '05', priority: 'P1' }]));
  assert.deepEqual(selected.tasks.map((t: { id: string }) => t.id), ['04', '03', '02']);
});

test('selects exactly one MAJOR and supports an explicit claimed MAJOR restriction', () => {
  const raw = snapshot([{ id: '01', major: 'MAJOR-01' }, { id: '02', major: 'MAJOR-02' }], [major('MAJOR-01', 'PLANNED'), major('MAJOR-02', 'QA')]);
  assert.equal(selection(raw).major.id, 'MAJOR-02');
  assert.deepEqual(selection(raw, { majorId: 'MAJOR-01' }).tasks.map((t: { id: string }) => t.id), ['01']);
});

test('skips external and dependency blockers while allowing independent work in same major', () => {
  const selected = selection(snapshot([{ id: '01', status: 'BLOCKED_EXTERNAL' }, { id: '02', status: 'TODO_DEPENDENCY_BLOCKED' }, { id: '03' }]));
  assert.deepEqual(selected.tasks.map((t: { id: string }) => t.id), ['03']);
});

test('Task List/Detail status conflict fails closed and cannot authorize downstream dependency', () => {
  const raw = snapshot([{ id: '01', status: 'COMPLETE' }, { id: '02', dep: '01' }]);
  raw.sheets[2]!.data[0]!.rowData[1]!.values[3]!.formattedValue = 'QA';
  const selected = selection(raw);
  assert.equal(selected.status, 'SOURCE_GAP');
  assert.equal(selected.tasks.length, 0);
  assert.ok(selected.gaps.some((g: { reason: string }) => g.reason.includes('status conflict')));
});

test('missing acceptance criteria, unknown IDs, prose dependencies and invalid status do not execute', () => {
  for (const input of [{ id: '01', ac: '' }, { id: '01', dep: '99' }, { id: '01', dep: '01 PR #123 verified' }, { id: '01', status: 'BLOCKED' }, { id: '01', priority: 'P3' }]) {
    const selected = selection(snapshot([input]));
    assert.equal(selected.status, 'SOURCE_GAP');
    assert.equal(selected.tasks.length, 0);
  }
});

test('expands compact numeric ranges but rejects reversed or unbounded ranges', () => {
  const parsed = parseSheetSnapshot(snapshot([{ id: '01', status: 'COMPLETE' }, { id: '02', status: 'COMPLETE' }, { id: '03', status: 'COMPLETE' }, { id: '04', dep: '1–3' }]));
  assert.deepEqual(parsed.tasks[3].dependencies, ['01', '02', '03']);
  assert.equal(selectQueue(parsed).status, 'READY');
  assert.equal(selection(snapshot([{ id: '04', dep: '3-1' }])).status, 'SOURCE_GAP');
  assert.equal(selection(snapshot([{ id: '04', dep: '1-999' }])).status, 'SOURCE_GAP');
});

test('malformed live-shaped MAJOR row cannot execute or overwrite planning values', () => {
  const raw = snapshot([{ id: '01', major: 'MAJOR-03' }], [major('MAJOR-03', 'QA', 'P0', 'COMPLETE', 'MT-03, MT-04 COMPLETE')]);
  const selected = selection(raw);
  assert.equal(selected.status, 'SOURCE_GAP');
  assert.equal(selected.major, null);
  assert.ok(selected.gaps.some((g: { reason: string }) => g.reason.includes('Auto Eligible')));
});

test('duplicate IDs never overwrite conflicts; unknown parent and complete parent contradictions excluded', () => {
  assert.equal(selection(snapshot([{ id: '01' }, { id: '01', status: 'COMPLETE' }])).status, 'SOURCE_GAP');
  assert.equal(selection(snapshot([{ id: '01', major: 'MAJOR-99' }])).status, 'SOURCE_GAP');
  assert.equal(selection(snapshot([{ id: '01' }], [major('MAJOR-01', 'COMPLETE')])).status, 'SOURCE_GAP');
});

test('features require explicit unambiguous mapping and consistent operational status', () => {
  const feature = ['FEAT-01.01', 'FEAT-01', 'SUBTASK', 'Feature', '1.1', 'Feature work', 'Feature acceptance', '', '', 'MAJOR-01; S01', 'VERIFY AGAINST SOURCE', '', 'Follow rules', 'PLANNED'];
  const parsed = parseSheetSnapshot(snapshot([], undefined, [feature]));
  assert.equal(parsed.tasks[0].prioritySource, 'MAJOR');
  assert.equal(selectQueue(parsed).tasks[0].id, 'FEAT-01.01');
  for (const [index, value] of [[9, 'User-approved plan'], [9, 'MAJOR-01 + MAJOR-02'], [10, 'QA — implementation verified']] as const) {
    const changed = [...feature]; changed[index] = value;
    assert.equal(selection(snapshot([], undefined, [changed])).status, 'SOURCE_GAP');
  }
});

test('feature aggregates are dependencies only; explicit external classification is skipped', () => {
  const aggregate = ['FEAT-01', '', 'TASK', 'Feature', '1', 'Feature work', 'All acceptance', '', '', 'MAJOR-01', 'COMPLETE — proof', '', '', 'COMPLETE'];
  const subtask = ['FEAT-01.01', 'FEAT-01', 'SUBTASK', 'Feature', '1.1', 'Feature work', 'Acceptance', '', 'FEAT-01', 'MAJOR-01', 'BLOCKED_EXTERNAL — account required', '', 'P1 — account', 'BLOCKED'];
  const parsed = parseSheetSnapshot(snapshot([], undefined, [aggregate, subtask]));
  assert.equal(parsed.tasks[1].status, 'BLOCKED_EXTERNAL');
  assert.equal(selectQueue(parsed).status, 'NO_EXECUTABLE_TASK');
});

test('cyclic dependencies, missing headers and missing detail rows fail closed', () => {
  assert.equal(selection(snapshot([{ id: '01', dep: '02' }, { id: '02', dep: '01' }])).status, 'SOURCE_GAP');
  const missing = snapshot([{ id: '01' }]);
  missing.sheets[2]!.data[0]!.rowData.splice(1);
  assert.equal(selection(missing).status, 'SOURCE_GAP');
  missing.sheets[0]!.data[0]!.rowData[0]!.values[0]!.formattedValue = 'Wrong';
  assert.equal(selection(missing).status, 'SOURCE_GAP');
});

test('empty, complete-only and non-eligible queues report no work without fabricating tasks', () => {
  assert.equal(selection(snapshot()).status, 'NO_EXECUTABLE_TASK');
  assert.equal(selection(snapshot([{ id: '01', status: 'COMPLETE' }])).status, 'NO_EXECUTABLE_TASK');
  assert.equal(selection(snapshot([{ id: '01' }], [major('MAJOR-01', 'QA', 'P0', '', 'NO')])).status, 'NO_EXECUTABLE_TASK');
  assert.equal(selectQueue(parseSheetSnapshot(null)).status, 'SOURCE_GAP');
});

test('reads non-contiguous native grid blocks using row and column offsets', () => {
  const raw = snapshot([{ id: '01' }]);
  const list = raw.sheets[1]!;
  const header = list.data[0]!.rowData[0]!;
  const values = list.data[0]!.rowData[1]!.values;
  const first = { startRow: 5, rowData: [{ values: values.slice(0, 7) }] };
  const last = { startRow: 5, startColumn: 7, rowData: [{ values: values.slice(7) }] };
  const native = { ...raw, sheets: raw.sheets.map(s => s === list ? { ...s, data: [{ startRow: 0, rowData: [header] }, first, last] } : s) };
  const parsed = parseSheetSnapshot(native);
  assert.equal(parsed.tasks[0].sourceRef, 'Task List!6');
  assert.equal(selectQueue(parsed).status, 'READY');
});

test('incomplete snapshot or missing required table cannot authorize writes despite another valid task', () => {
  const raw = snapshot([{ id: '01' }]);
  const feature = raw.sheets[3]!;
  feature.data[0]!.rowData[0]!.values[0]!.formattedValue = 'Wrong header';
  assert.equal(selection(raw).status, 'SOURCE_GAP');
  raw.sheets.pop();
  assert.equal(selection(raw).status, 'SOURCE_GAP');
});

test('every member of a dependency cycle is invalid even if status claims COMPLETE', () => {
  const raw = snapshot([{ id: '01', dep: '02', status: 'COMPLETE' }, { id: '02', dep: '01', status: 'COMPLETE' }, { id: '03', dep: '02' }]);
  const parsed = parseSheetSnapshot(raw);
  assert.equal(parsed.tasks[0].sourceGap, true);
  assert.equal(parsed.tasks[1].sourceGap, true);
  assert.equal(selectQueue(parsed).status, 'SOURCE_GAP');
});
