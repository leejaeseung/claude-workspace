import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import { clearTranslationCache, translateToKorean } from './sources/translate.ts';

beforeEach(clearTranslationCache);

const dict: Record<string, string> = { 'Stock jumps': '주가 급등', 'Shares fall': '주가 하락', 'CEO resigns': 'CEO 사임' };
const lineByLine = async (q: string) => q.split('\n').map((l) => dict[l] ?? `?${l}`).join('\n');

test('translates a batch in one request and caches results', async () => {
  let calls = 0;
  const f = async (q: string) => (calls++, lineByLine(q));
  assert.deepEqual(await translateToKorean(['Stock jumps', 'Shares  fall\n'], f), ['주가 급등', '주가 하락']);
  assert.equal(calls, 1);
  assert.deepEqual(await translateToKorean(['Shares fall', 'Stock jumps'], f), ['주가 하락', '주가 급등']);
  assert.equal(calls, 1, 'second call served from cache');
});

test('falls back to one request per title when batch lines do not line up', async () => {
  const f = async (q: string) => (q.includes('\n') ? '합쳐진 한 줄' : lineByLine(q));
  assert.deepEqual(await translateToKorean(['Stock jumps', 'CEO resigns'], f), ['주가 급등', 'CEO 사임']);
});

test('partial failures give null; total failure throws', async () => {
  const partial = async (q: string) => {
    if (q.includes('\n')) throw new Error('batch down');
    if (q === 'CEO resigns') throw new Error('one down');
    return lineByLine(q);
  };
  assert.deepEqual(await translateToKorean(['Stock jumps', 'CEO resigns'], partial), ['주가 급등', null]);
  clearTranslationCache();
  await assert.rejects(translateToKorean(['Stock jumps'], async () => Promise.reject(new Error('offline'))), /offline/);
  assert.deepEqual(await translateToKorean([], async () => ''), []);
});
