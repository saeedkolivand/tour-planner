/// <reference types="node" />
// Run: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLogQueue, type Entry } from './logQueue.ts';

const fixed = () => new Date('2026-09-27T08:00:00Z');

test('a failed send keeps the batch; the next flush delivers it', async () => {
  const sent: Entry[][] = [];
  let online = false;
  const q = createLogQueue({
    send: async b => { if (!online) throw new Error('offline'); sent.push(b); },
    persist: async () => {},
    now: fixed,
  });
  q.add('info', 'scan', 'photos read', { count: 3 });
  await q.flush();
  assert.equal(q.size(), 1);
  online = true;
  await q.flush();
  assert.equal(q.size(), 0);
  assert.deepEqual(sent[0][0], { count: 3, t: '2026-09-27T08:00:00.000Z', level: 'info', scope: 'scan', msg: 'photos read' });
});

test('errors are stored as message + stack', () => {
  let saved: Entry[] = [];
  const q = createLogQueue({ send: async () => {}, persist: async e => { saved = e; } });
  q.add('error', 'plan', 'failed', new Error('vroom down'));
  q.add('warn', 'plan', 'nested', { error: new Error('photon down'), stops: 3 });
  assert.equal(saved[0].error, 'vroom down');
  assert.match(String(saved[0].stack), /vroom down/);
  assert.equal(saved[1].error, 'photon down');
  assert.equal(saved[1].stops, 3);
});

test('unsent logs from the last run are restored', () => {
  const q = createLogQueue({ send: async () => {}, persist: async () => {} }, [{ t: 'x', level: 'info', scope: 's', msg: 'm' }]);
  assert.equal(q.size(), 1);
});
