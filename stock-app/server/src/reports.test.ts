import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { ReportStore } from './reports.ts';
import { TickerNotFoundError } from './sources/yahoo.ts';
import type { Analysis } from './types.ts';

const fake = (ticker: string) =>
  ({
    quote: { ticker, name: `${ticker} Inc.`, price: 10, changePercent: 1.5 },
    outlook: { direction: 'up' },
    generatedAt: '2026-11-08T00:00:00.000Z',
  }) as unknown as Analysis;

const tmpFile = async () => join(await mkdtemp(join(tmpdir(), 'reports-')), 'reports.json');

test('request returns immediately and the job completes in the background', async () => {
  const file = await tmpFile();
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const store = new ReportStore(file, async (t) => (await gate, fake(t)));

  const r = store.request('AAPL');
  assert.equal(r.status, 'queued');
  await new Promise((r) => setImmediate(r));
  assert.equal(store.get('AAPL')?.status, 'running');
  assert.equal(store.request('AAPL').status, 'running', 'duplicate requests reuse the pending job');

  release();
  await store.idle();
  const done = store.get('AAPL')!;
  assert.equal(done.status, 'done');
  assert.equal(done.name, 'AAPL Inc.');
  assert.equal(done.direction, 'up');
  assert.equal(store.list()[0].ticker, 'AAPL');
  assert.equal('analysis' in store.list()[0], false, 'list omits the heavy payload');

  const saved = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(saved[0].status, 'done');
});

test('failures keep the previous result and report a readable error', async () => {
  let fail = false;
  const store = new ReportStore(await tmpFile(), async (t) => {
    if (fail) throw new TickerNotFoundError('nope');
    return fake(t);
  });
  store.request('MSFT');
  await store.idle();
  fail = true;
  store.request('MSFT');
  await store.idle();
  const r = store.get('MSFT')!;
  assert.equal(r.status, 'error');
  assert.equal(r.error, '해당 티커를 찾을 수 없습니다.');
  assert.ok(r.analysis, 'last good analysis is kept');
});

test('concurrency is limited and interrupted jobs resume after restart', async () => {
  const file = await tmpFile();
  await writeFile(
    file,
    JSON.stringify([{ ticker: 'TSLA', name: null, status: 'running', requestedAt: '2026-11-08T00:00:00.000Z', analysis: null }]),
  );
  let running = 0;
  let peak = 0;
  const store = new ReportStore(
    file,
    async (t) => {
      peak = Math.max(peak, ++running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      return fake(t);
    },
    2,
  );
  await store.load();
  for (const t of ['A', 'B', 'C', 'D']) store.request(t);
  await store.idle();
  assert.equal(peak, 2);
  assert.equal(store.get('TSLA')?.status, 'done');
  assert.deepEqual(store.list().map((r) => r.status), ['done', 'done', 'done', 'done', 'done']);
});

test('remove deletes a report', async () => {
  const store = new ReportStore(await tmpFile(), async (t) => fake(t));
  store.request('NVDA');
  await store.idle();
  assert.equal(store.remove('NVDA'), true);
  assert.equal(store.get('NVDA'), undefined);
  assert.equal(store.remove('NVDA'), false);
});
