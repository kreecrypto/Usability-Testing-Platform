/** Read-only, fail-closed planning queue. No connector, filesystem or mutation calls. */
const MAJOR_ID = /^MAJOR-(?:\d{2}|[A-Z])$/;
const TASK_ID = /^(?:\d{1,3}|[A-Z][A-Z0-9]*-\d+(?:\.[A-Z0-9]+)*)$/;
const STATUSES = new Set(['COMPLETE', 'IN_PROGRESS', 'QA', 'TODO_EXECUTABLE', 'PLANNED', 'BLOCKED_SELF_FIXABLE', 'BLOCKED_EXTERNAL', 'TODO_DEPENDENCY_BLOCKED']);
const PRIORITIES = new Set(['P0', 'P1', 'P2']);
const STATUS_RANK = { IN_PROGRESS: 0, QA: 1, TODO_EXECUTABLE: 2, PLANNED: 2, BLOCKED_SELF_FIXABLE: 3 };
const text = value => String(value ?? '').trim();
const status = value => text(value).toUpperCase().replace(/\s+/g, '_');
const id = value => /^\d+$/.test(value) ? value.padStart(2, '0') : value;
const sourceRef = (title, row) => `${title}!${row + 1}`;

function dependencyIds(value) {
  const raw = text(value);
  if (!raw || /^(?:NONE|N\/A|—|-)$/i.test(raw)) return { ids: [] };
  const ids = [];
  for (const part of raw.split(/[,;+\n]/)) {
    const token = part.trim();
    const range = /^(\d{1,3})\s*[-–]\s*(\d{1,3})$/.exec(token);
    if (range) {
      const start = Number(range[1]), end = Number(range[2]);
      if (end < start || end - start > 100) return { error: `Invalid dependency range: ${token}` };
      for (let i = start; i <= end; i++) ids.push(id(String(i)));
    } else if (TASK_ID.test(token) || MAJOR_ID.test(token)) ids.push(id(token));
    else return { error: `Unrecognized dependency: ${token}` };
  }
  return { ids: [...new Set(ids)] };
}

function rowsOf(sheet) {
  const rows = new Map();
  for (const grid of sheet.data ?? []) {
    const start = grid.startRow ?? 0, column = grid.startColumn ?? 0;
    for (const [offset, row] of (grid.rowData ?? []).entries()) {
      const index = start + offset, values = rows.get(index) ?? [];
      for (const [j, cell] of (row.values ?? []).entries()) values[column + j] = text(cell.formattedValue);
      rows.set(index, values);
    }
  }
  return [...rows].sort((a, b) => a[0] - b[0]);
}

/** Accept either native spreadsheet structuredContent or the complete connector result. */
export function parseSheetSnapshot(snapshot) {
  const spreadsheet = snapshot?.structuredContent ?? snapshot;
  const majors = [], tasks = [], gaps = [];
  const invalid = new Set();
  const addGap = (recordId, ref, reason) => {
    gaps.push({ code: 'SOURCE_GAP', id: recordId ?? null, sourceRef: ref, reason });
    if (recordId) invalid.add(recordId);
  };
  if (!Array.isArray(spreadsheet?.sheets)) {
    addGap(null, 'snapshot', 'Missing native spreadsheet sheets');
    return { majors, tasks, gaps };
  }
  const sheets = new Map();
  for (const sheet of spreadsheet.sheets) {
    const title = sheet.properties?.title;
    if (sheets.has(title)) addGap(null, title, 'Duplicate sheet title');
    else sheets.set(title, sheet);
  }
  const table = (title, required) => {
    const sheet = sheets.get(title);
    if (!sheet) { addGap(null, title, 'Missing planning sheet'); return []; }
    const rows = rowsOf(sheet);
    const header = rows.find(([index]) => index === 0)?.[1] ?? [];
    if (required.some(name => !header.includes(name))) {
      addGap(null, title, `Missing required headers: ${required.filter(name => !header.includes(name)).join(', ')}`);
      return [];
    }
    return rows.filter(([index, values]) => index > 0 && values.some(Boolean)).map(([index, values]) => ({
      ref: sourceRef(title, index), values: Object.fromEntries(header.map((name, i) => [name, values[i] ?? '']))
    }));
  };
  const validate = record => {
    if (!STATUSES.has(record.status)) addGap(record.id, record.sourceRef, `Unknown or ambiguous status: ${record.status || '(empty)'}`);
    if (!PRIORITIES.has(record.priority)) addGap(record.id, record.sourceRef, `Unknown priority: ${record.priority || '(empty)'}`);
    const dependency = dependencyIds(record.rawDependencies);
    if (dependency.error) addGap(record.id, record.sourceRef, dependency.error);
    record.dependencies = dependency.ids ?? [];
    delete record.rawDependencies;
  };
  const majorRows = table('Task Hierarchy', ['Major Task ID', 'Major Task', 'Status', 'Priority', 'Dependency', 'Auto Eligible']);
  for (const [order, { values: v, ref }] of majorRows.entries()) {
    const majorId = v['Major Task ID'];
    if (!MAJOR_ID.test(majorId)) { addGap(null, ref, `Invalid MAJOR ID: ${majorId}`); continue; }
    const major = { id: majorId, name: v['Major Task'], status: status(v.Status), priority: v.Priority, rawDependencies: v.Dependency, autoEligible: v['Auto Eligible'] === 'YES', order, sourceRef: ref };
    if (!['YES', 'NO'].includes(v['Auto Eligible'])) addGap(majorId, ref, 'Auto Eligible must be exactly YES or NO');
    validate(major);
    majors.push(major);
  }
  const details = new Map();
  const taskNameId = value => {
    const prefix = /^(\d{1,3}|[A-Z][A-Z0-9]*-\d+(?:\.[A-Z0-9]+)*)(?=\s|$)/.exec(text(value));
    return prefix ? id(prefix[1]) : null;
  };
  for (const { values: v, ref } of table('Task Detail', ['Task', 'Status', 'Priority', 'Dependency', 'Acceptance Criteria'])) {
    const taskId = taskNameId(v.Task);
    if (!taskId) { addGap(null, ref, `Invalid Task ID in name: ${v.Task}`); continue; }
    if (details.has(taskId)) addGap(taskId, ref, 'Duplicate Task Detail ID');
    else details.set(taskId, { values: v, ref });
  }
  const listRows = table('Task List', ['Task', 'Status', 'Priority', 'Dependency', 'Acceptance Criteria', 'Task Level', 'Parent Major Task', 'Auto Eligible']);
  for (const [order, { values: v, ref }] of listRows.entries()) {
    const taskId = taskNameId(v.Task);
    if (!taskId) { addGap(null, ref, `Invalid Task ID in name: ${v.Task}`); continue; }
    const task = { id: taskId, majorId: v['Parent Major Task'], name: v.Task, status: status(v.Status), priority: v.Priority, rawDependencies: v.Dependency, acceptance: v['Acceptance Criteria'], order, sourceRef: ref, aggregate: v['Task Level'] === 'MAJOR' };
    // Sub-task NO prohibits independent scheduling, not work inside a claimed MAJOR.
    if (!['YES', 'NO'].includes(v['Auto Eligible'])) addGap(taskId, ref, 'Auto Eligible must be exactly YES or NO');
    if (!['SUB_TASK', 'MAJOR'].includes(v['Task Level'])) addGap(taskId, ref, 'Invalid task level');
    if (task.majorId === 'FUTURE-V2') task.outOfScope = true;
    else if (!MAJOR_ID.test(task.majorId) || !majors.some(m => m.id === task.majorId)) addGap(taskId, ref, 'Missing or invalid Parent Major Task');
    validate(task);
    if (!task.acceptance) addGap(taskId, ref, 'Missing acceptance criteria');
    const detail = details.get(taskId);
    if (!detail) addGap(taskId, ref, 'Task Detail row missing');
    else if (status(detail.values.Status) !== task.status) addGap(taskId, ref, `Task Detail status conflict at ${detail.ref}`);
    tasks.push(task);
  }
  const featureRows = table('Feature Tasks', ['Feature Task ID', 'Level', 'Work Item', 'Acceptance Criteria', 'Dependency', 'Maps to Existing', 'Current Source State', 'Execution Rule', 'Planning Status']);
  for (const [order, { values: v, ref }] of featureRows.entries()) {
    const taskId = v['Feature Task ID'];
    if (!TASK_ID.test(taskId)) { addGap(null, ref, `Invalid feature Task ID: ${taskId}`); continue; }
    const mapped = [...new Set(v['Maps to Existing'].match(/\bMAJOR-(?:\d{2}|[A-Z])\b/g) ?? [])];
    const major = mapped.length === 1 ? majors.find(m => m.id === mapped[0]) : undefined;
    const explicitPriority = /^(P[012])\b/.exec(v['Execution Rule'])?.[1];
    const operational = /^(BLOCKED_SELF_FIXABLE|BLOCKED_EXTERNAL|TODO_DEPENDENCY_BLOCKED|IN[_ ]PROGRESS|TODO_EXECUTABLE|COMPLETE|QA)\b/.exec(v['Current Source State']);
    const planning = status(v['Planning Status']);
    // BLOCKED needs an explicit classification; it never becomes executable by guessing.
    const normalizedStatus = planning === 'BLOCKED' && operational && ['BLOCKED_EXTERNAL', 'BLOCKED_SELF_FIXABLE', 'TODO_DEPENDENCY_BLOCKED'].includes(operational[1]) ? operational[1] : planning;
    const task = { id: taskId, majorId: major?.id ?? null, name: v['Work Item'], status: normalizedStatus, priority: explicitPriority ?? major?.priority ?? '', prioritySource: explicitPriority ? 'Execution Rule' : 'MAJOR', rawDependencies: v.Dependency, acceptance: v['Acceptance Criteria'], order: listRows.length + order, sourceRef: ref, aggregate: v.Level === 'TASK' };
    if (!major) addGap(taskId, ref, 'Missing or ambiguous explicit MAJOR mapping');
    if (!['TASK', 'SUBTASK'].includes(v.Level)) addGap(taskId, ref, 'Invalid feature level');
    if (operational && planning !== 'BLOCKED' && status(operational[1]) !== planning) addGap(taskId, ref, 'Current Source State conflicts with Planning Status');
    validate(task);
    if (!task.acceptance) addGap(taskId, ref, 'Missing acceptance criteria');
    tasks.push(task);
  }
  const all = [...majors, ...tasks], seen = new Set();
  for (const record of all) {
    if (seen.has(record.id)) addGap(record.id, record.sourceRef, 'Duplicate planning ID');
    seen.add(record.id);
  }
  for (const record of all) for (const dependency of record.dependencies) {
    if (!seen.has(dependency)) addGap(record.id, record.sourceRef, `Unknown dependency ID: ${dependency}`);
    if (dependency === record.id) addGap(record.id, record.sourceRef, 'Self dependency');
  }
  const recordById = new Map(all.map(record => [record.id, record]));
  const visiting = new Set(), visited = new Set(), stack = [];
  const visit = record => {
    if (visiting.has(record.id)) {
      for (const cycleId of stack.slice(stack.indexOf(record.id))) addGap(cycleId, recordById.get(cycleId).sourceRef, 'Cyclic dependency');
      return;
    }
    if (visited.has(record.id)) return;
    visiting.add(record.id); stack.push(record.id);
    for (const dependency of record.dependencies) { const next = recordById.get(dependency); if (next) visit(next); }
    stack.pop(); visiting.delete(record.id); visited.add(record.id);
  };
  for (const record of all) visit(record);
  for (const task of tasks) {
    const major = majors.find(m => m.id === task.majorId);
    if (!task.outOfScope && major?.status === 'COMPLETE' && task.status !== 'COMPLETE') addGap(task.id, task.sourceRef, 'Unfinished task mapped to COMPLETE MAJOR');
  }
  // Invalid records are retained for diagnosis, but cannot authorize dependency completion.
  for (const record of all) record.sourceGap = invalid.has(record.id);
  return { majors, tasks, gaps };
}

/** Select at most three presently executable tasks in one eligible MAJOR. */
export function selectQueue(parsed, options = {}) {
  const { majors = [], tasks = [], gaps = [] } = parsed ?? {};
  const records = new Map([...majors, ...tasks].map(record => [record.id, record]));
  const invalid = new Set(gaps.map(gap => gap.id).filter(Boolean));
  const skipped = [];
  if (gaps.some(gap => /^(Missing native spreadsheet|Missing planning sheet|Missing required headers|Duplicate sheet title)/.test(gap.reason))) {
    return { status: 'SOURCE_GAP', major: null, tasks: [], gaps, skipped };
  }
  const reason = record => {
    if (record.sourceGap || invalid.has(record.id)) return 'SOURCE_GAP';
    if (record.status === 'COMPLETE') return 'COMPLETE';
    if (!(record.status in STATUS_RANK)) return record.status || 'UNKNOWN_STATUS';
    if (!PRIORITIES.has(record.priority)) return 'SOURCE_GAP';
    if (record.outOfScope) return 'OUT_OF_SCOPE';
    if (record.aggregate) return 'AGGREGATE';
    if (record.dependencies.some(dep => !records.has(dep) || records.get(dep).status !== 'COMPLETE' || records.get(dep).sourceGap || invalid.has(dep))) return 'TODO_DEPENDENCY_BLOCKED';
    return null;
  };
  const compare = (a, b) => (STATUS_RANK[a.status] - STATUS_RANK[b.status]) || (Number(a.priority.slice(1)) - Number(b.priority.slice(1))) || (a.order - b.order) || a.id.localeCompare(b.id);
  const candidates = [];
  for (const major of majors) {
    if (options.majorId && options.majorId !== major.id) continue;
    const majorReason = reason(major) ?? (!major.autoEligible ? 'AUTO_NOT_ELIGIBLE' : null);
    if (majorReason) { skipped.push({ id: major.id, reason: majorReason }); continue; }
    const ready = [];
    for (const task of tasks.filter(task => task.majorId === major.id)) {
      const taskReason = reason(task);
      if (taskReason) skipped.push({ id: task.id, reason: taskReason });
      else ready.push(task);
    }
    if (ready.length) candidates.push({ major, tasks: ready.sort(compare).slice(0, 3) });
    else skipped.push({ id: major.id, reason: 'NO_EXECUTABLE_TASK' });
  }
  candidates.sort((a, b) => compare(a.major, b.major));
  const chosen = candidates[0];
  return { status: chosen ? 'READY' : gaps.length ? 'SOURCE_GAP' : 'NO_EXECUTABLE_TASK', major: chosen?.major ?? null, tasks: chosen?.tasks ?? [], gaps, skipped };
}
