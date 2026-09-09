import assert from 'node:assert/strict';
import test from 'node:test';
import { createEventOutbox } from '../src/lib/tracking/event-outbox.ts';
import { belongsToTest, remainingTaskTime } from '../src/lib/runner/recovery.ts';
import type { TrackingEvent } from '../src/lib/tracking/events.ts';

const event = (id: string) => ({ sessionId: 'session', eventId: id, idempotencyKey: id }) as TrackingEvent;

test('concurrent enqueue preserves every event', async () => {
  let rows: readonly TrackingEvent[] = [];
  const box = createEventOutbox({ storage: {
    load: async () => [...rows], save: async value => { rows = [...value]; },
  }, refreshCredential: async () => ({token:'test', expiresAt:''}), sendBatch: async () => {} });
  await Promise.all(Array.from({length:100}, (_, i) => box.enqueue(event(String(i)))));
  assert.equal(rows.length, 100);
  assert.equal(new Set(rows.map(e => e.eventId)).size, 100);
});

test('enqueue during upload survives acknowledgement and is sent next', async () => {
  let rows: readonly TrackingEvent[] = [];
  const delivered: string[] = [];
  let release!: () => void;
  let uploading!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const started = new Promise<void>(resolve => { uploading = resolve; });
  const box = createEventOutbox({ storage: {
    load: async () => [...rows], save: async value => { rows = [...value]; },
  }, refreshCredential: async () => ({token:'test', expiresAt:''}), sendBatch: async batch => {
    if (batch[0].eventId === 'a') { uploading(); await gate; }
    delivered.push(...batch.map(e => e.eventId));
  }});
  await box.enqueue(event('a'));
  const flushing = box.flush();
  await started;
  await box.enqueue(event('b'));
  release();
  assert.equal(await flushing, 2);
  assert.deepEqual(delivered, ['a','b']);
  assert.equal(rows.length,0);
});

test('failed storage mutation does not poison subsequent retries', async () => {
  let rows: readonly TrackingEvent[] = [];
  let fail = true;
  const box = createEventOutbox({ storage: {
    load: async () => [...rows], save: async value => { if (fail) throw new Error('quota'); rows = [...value]; },
  }, refreshCredential: async () => ({token:'test', expiresAt:''}), sendBatch: async () => {} });
  await assert.rejects(box.enqueue(event('a')), /quota/);
  fail = false;
  await box.enqueue(event('a'));
  assert.equal(rows.length,1);
});

test('recovery requires both the same test and immutable test version', () => {
  const current = {testId:'test-a',testVersionId:'v1'};
  assert.equal(belongsToTest(current,current),true);
  assert.equal(belongsToTest(current,{testId:'test-b',testVersionId:'v1'}),false);
  assert.equal(belongsToTest(current,{testId:'test-a',testVersionId:'v2'}),false);
});

test('timeout keeps original deadline across confirmation and recovery', () => {
  const start = '2026-09-09T10:00:00Z';
  assert.equal(remainingTaskTime(start,60,Date.parse('2026-09-09T10:00:45Z')),15000);
  assert.equal(remainingTaskTime(start,60,Date.parse('2026-09-09T10:00:55Z')),5000);
  assert.equal(remainingTaskTime(start,60,Date.parse('2026-09-09T10:01:10Z')),0);
  assert.equal(remainingTaskTime(null,60,Date.now()),null);
});
