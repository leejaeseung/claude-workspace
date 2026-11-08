// English → Korean via the public Google Translate web endpoint (no API key). Titles are sent in
// batches joined by newlines, so one request translates many headlines.

const ENDPOINT = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ko&dt=t';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const MAX_CHUNK_CHARS = 3500;
const CACHE_MAX = 5000;

type Fetcher = (text: string) => Promise<string>;

// Headlines repeat across re-collections, so remember recent translations.
const cache = new Map<string, string>();

function remember(src: string, ko: string) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(src, ko);
}

/** Calls the endpoint and joins the translated segments it returns. */
export async function googleTranslate(text: string): Promise<string> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams({ q: text }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`translate.googleapis.com responded ${res.status}`);
  const body = (await res.json()) as [[string, string, ...unknown[]][] | null, ...unknown[]];
  if (!Array.isArray(body?.[0])) throw new Error('unexpected translation response');
  return body[0].map((seg) => seg[0] ?? '').join('');
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

function chunk(texts: string[]): string[][] {
  const out: string[][] = [];
  let cur: string[] = [];
  let len = 0;
  for (const t of texts) {
    if (cur.length && len + t.length + 1 > MAX_CHUNK_CHARS) {
      out.push(cur);
      cur = [];
      len = 0;
    }
    cur.push(t);
    len += t.length + 1;
  }
  if (cur.length) out.push(cur);
  return out;
}

/**
 * Translates each text to Korean. Returns null for any text that could not be translated;
 * throws only if nothing at all could be translated (so the caller can report the source as failed).
 */
export async function translateToKorean(texts: string[], fetcher: Fetcher = googleTranslate): Promise<(string | null)[]> {
  const src = texts.map(clean);
  const todo = [...new Set(src.filter((t) => t && !cache.has(t)))];
  let firstError: unknown = null;

  for (const part of chunk(todo)) {
    try {
      const lines = (await fetcher(part.join('\n'))).split('\n').map(clean);
      if (lines.length === part.length) {
        part.forEach((t, i) => lines[i] && remember(t, lines[i]));
        continue;
      }
    } catch (e) {
      firstError ??= e;
    }
    // Batch failed or lines did not line up: fall back to one request per title.
    const single = await Promise.all(part.map((t) => fetcher(t).then(clean, (e) => ((firstError ??= e), ''))));
    part.forEach((t, i) => single[i] && remember(t, single[i]));
  }

  const out = src.map((t) => (t ? (cache.get(t) ?? null) : null));
  if (firstError && todo.length && !todo.some((t) => cache.has(t))) throw firstError;
  return out;
}

export function clearTranslationCache() {
  cache.clear();
}
