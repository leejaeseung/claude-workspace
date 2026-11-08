import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { NotUsStockError, TickerNotFoundError } from './sources/yahoo.ts';
import type { Analysis, Report, ReportSummary } from './types.ts';

type Analyzer = (ticker: string) => Promise<Analysis>;

export function errorMessage(e: unknown): string {
  if (e instanceof TickerNotFoundError) return '해당 티커를 찾을 수 없습니다.';
  if (e instanceof NotUsStockError) return '미국 거래소(NYSE·NASDAQ 등)에 상장된 종목만 지원합니다.';
  return '데이터를 가져오지 못했습니다. 잠시 후 다시 요청해 주세요.';
}

export function summarize(r: Report): ReportSummary {
  const { analysis: _a, ...rest } = r;
  return rest;
}

/**
 * Background analysis jobs, one per ticker. Requests return immediately; a small worker pool
 * crawls in the background and the latest result is persisted to a JSON file, so the app can
 * come back later (and the data survives a server restart).
 */
export class ReportStore {
  private reports = new Map<string, Report>();
  private queue: string[] = [];
  private active = 0;
  private saving: Promise<void> = Promise.resolve();
  private idleWaiters: (() => void)[] = [];

  constructor(
    private readonly file: string,
    private readonly analyzer: Analyzer,
    private readonly concurrency = 2,
  ) {}

  async load() {
    let list: Report[] = [];
    try {
      list = JSON.parse(await readFile(this.file, 'utf8')) as Report[];
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') console.error('reports: could not read', this.file, e);
    }
    for (const r of list) {
      // Jobs cut off by a restart are queued again.
      if (r.status === 'queued' || r.status === 'running') r.status = 'queued';
      this.reports.set(r.ticker, r);
      if (r.status === 'queued') this.queue.push(r.ticker);
    }
    this.pump();
  }

  list(): ReportSummary[] {
    return [...this.reports.values()].sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt)).map(summarize);
  }

  get(ticker: string): Report | undefined {
    return this.reports.get(ticker);
  }

  /** Queues a (re)collection unless one is already pending for this ticker. */
  request(ticker: string): Report {
    const existing = this.reports.get(ticker);
    if (existing && (existing.status === 'queued' || existing.status === 'running')) return existing;
    const r: Report = existing
      ? { ...existing, status: 'queued', requestedAt: new Date().toISOString() }
      : {
          ticker,
          name: null,
          status: 'queued',
          requestedAt: new Date().toISOString(),
          finishedAt: null,
          error: null,
          price: null,
          changePercent: null,
          direction: null,
          generatedAt: null,
          analysis: null,
        };
    this.reports.set(ticker, r);
    this.queue.push(ticker);
    this.persist();
    this.pump();
    return r;
  }

  remove(ticker: string): boolean {
    const r = this.reports.get(ticker);
    if (!r) return false;
    this.reports.delete(ticker);
    this.queue = this.queue.filter((t) => t !== ticker);
    this.persist();
    return true;
  }

  /** Resolves once no job is queued or running (for tests). */
  idle(): Promise<void> {
    if (this.active === 0 && this.queue.length === 0) return this.saving;
    return new Promise<void>((resolve) => this.idleWaiters.push(resolve)).then(() => this.saving);
  }

  private pump() {
    while (this.active < this.concurrency && this.queue.length) {
      const ticker = this.queue.shift()!;
      if (!this.reports.has(ticker)) continue;
      this.active++;
      this.run(ticker).finally(() => {
        this.active--;
        this.pump();
        if (this.active === 0 && this.queue.length === 0) this.idleWaiters.splice(0).forEach((w) => w());
      });
    }
  }

  private async run(ticker: string) {
    this.update(ticker, { status: 'running' });
    const started = Date.now();
    try {
      const a = await this.analyzer(ticker);
      this.update(ticker, {
        status: 'done',
        name: a.quote.name,
        finishedAt: new Date().toISOString(),
        error: null,
        price: a.quote.price,
        changePercent: a.quote.changePercent,
        direction: a.outlook.direction,
        generatedAt: a.generatedAt,
        analysis: a,
      });
      console.log(`report ${ticker} done ${Date.now() - started}ms`);
    } catch (e) {
      if (!(e instanceof TickerNotFoundError || e instanceof NotUsStockError)) console.error(`report ${ticker} failed`, e);
      this.update(ticker, { status: 'error', finishedAt: new Date().toISOString(), error: errorMessage(e) });
    }
  }

  private update(ticker: string, patch: Partial<Report>) {
    const r = this.reports.get(ticker);
    if (!r) return; // deleted while running
    this.reports.set(ticker, { ...r, ...patch });
    this.persist();
  }

  private persist() {
    const snapshot = JSON.stringify([...this.reports.values()]);
    // Writes are chained so they land in order; write-then-rename keeps the file whole if we crash mid-write.
    this.saving = this.saving.then(async () => {
      try {
        await mkdir(dirname(this.file), { recursive: true });
        await writeFile(`${this.file}.tmp`, snapshot);
        await rename(`${this.file}.tmp`, this.file);
      } catch (e) {
        console.error('reports: could not save', e);
      }
    });
  }
}
