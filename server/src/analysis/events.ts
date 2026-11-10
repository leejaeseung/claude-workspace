// Recognises concrete, market-moving events in English headlines. Word-level sentiment cannot tell
// "raises price target" from "raises prices", so these patterns look at the phrase.

import type { NewsEvent, NewsItem } from '../types.ts';

const UP = '\\b(?:raises?|raised|lifts?|lifted|boosts?|boosted|hikes?|hiked|ups|increases?|increased|bumps?)';
const DOWN = '\\b(?:cuts?|lowers?|lowered|slash(?:es|ed)?|trims?|trimmed|reduces?|reduced)';
const GUIDE = '(?:guidance|outlook|forecasts?|full[- ]year|annual (?:sales|revenue|profit)|fy\\d{0,4} (?:view|target))';
const PT = '(?:price target|target price|\\bpt\\b|target)';
const EST = '(?:estimates?|expectations?|forecasts?|consensus|views?|street)';
const RESULTS = '(?:earnings|profit|revenue|results|eps|sales|quarter)';

/** Checked in order; the first match labels the headline. Stronger, more specific events come first. */
const RULES: { key: string; label: string; effect: number; re: RegExp }[] = [
  { key: 'guidanceUp', label: '가이던스 상향', effect: 0.9, re: new RegExp(`${UP}\\b.{0,30}${GUIDE}|${GUIDE}\\b.{0,25}(?:raised|above|tops|beats)`) },
  { key: 'guidanceDown', label: '가이던스 하향', effect: -0.9, re: new RegExp(`${DOWN}\\b.{0,30}${GUIDE}|${GUIDE}\\b.{0,25}(?:below|miss|disappoint|cut|lowered|weak)|\\bprofit warning\\b`) },
  { key: 'beat', label: '실적 예상 상회', effect: 0.8, re: new RegExp(`(?:beats?|tops?|topped|exceeds?|exceeded|surpass\\w*|crush\\w*)\\b.{0,40}${EST}|${RESULTS}\\b.{0,30}\\b(?:beat|top|exceed|surpass)`) },
  { key: 'miss', label: '실적 예상 하회', effect: -0.8, re: new RegExp(`\\bmiss(?:es|ed)?\\b.{0,40}${EST}|${RESULTS}\\b.{0,30}\\bmiss|falls? short of`) },
  { key: 'downgrade', label: '투자의견 하향', effect: -0.8, re: /\bdowngrade[sd]?\b|\bcut to (?:sell|underperform|underweight|neutral|hold)\b/ },
  { key: 'upgrade', label: '투자의견 상향', effect: 0.8, re: /\bupgrade[sd]?\b|\braised to (?:buy|outperform|overweight)\b/ },
  { key: 'targetDown', label: '목표가 하향', effect: -0.5, re: new RegExp(`${DOWN}\\b.{0,40}${PT}|${PT}\\b.{0,25}(?:cut|lowered|reduced|trimmed|slashed)`) },
  { key: 'targetUp', label: '목표가 상향', effect: 0.5, re: new RegExp(`${UP}\\b.{0,40}${PT}|${PT}\\b.{0,25}(?:raised|lifted|boosted|hiked|increased)`) },
  { key: 'approvalNo', label: '승인 거절', effect: -0.9, re: /\b(?:fda|regulators?|ema)\b.{0,40}(?:reject|declin|refus|complete response letter)/ },
  { key: 'approval', label: '규제 승인', effect: 0.8, re: /\bfda\b.{0,40}(?:approv|clear|grants?)|\b(?:approv\w*|clearance)\b.{0,30}\bfda\b/ },
  { key: 'offering', label: '증자·지분 매각', effect: -0.5, re: /\b(?:stock|share|equity|secondary|public) offering\b|\bdilut\w*/ },
  { key: 'legal', label: '소송·조사', effect: -0.6, re: /\b(?:lawsuit|sues|sued|probe|investigation|subpoena|antitrust|class action|indicted|charged by)\b/ },
  { key: 'recall', label: '리콜', effect: -0.6, re: /\brecalls?\b/ },
  { key: 'exec', label: '경영진 사임', effect: -0.5, re: /\b(?:ceo|cfo|chief executive|founder)\b.{0,30}(?:resign|steps? down|stepping down|depart|ousted|exits?|to leave)/ },
  { key: 'warning', label: '경고성 전망', effect: -0.4, re: /\bwarns?\b|\bwarning\b/ },
  { key: 'layoffs', label: '감원', effect: -0.2, re: /\blayoffs?\b|\bjob cuts\b|\bcuts? (?:\d[\d,]* )?jobs\b/ },
  { key: 'dividendUp', label: '배당 증액', effect: 0.4, re: /\b(?:raises?|hikes?|increases?|boosts?)\b.{0,20}dividend|\bdividend (?:hike|increase)/ },
  { key: 'buyback', label: '자사주 매입', effect: 0.5, re: /\b(?:buyback|repurchase)/ },
  { key: 'index', label: '지수 편입', effect: 0.6, re: /\b(?:added to|join(?:s|ing)?|to join) (?:the )?s&p 500\b/ },
  { key: 'contract', label: '수주·계약', effect: 0.5, re: /\b(?:wins?|won|awarded|secures?|secured|lands?|landed)\b.{0,40}\b(?:contract|deal|order)s?\b/ },
];

const GENERIC = new Set(
  `the inc corp corporation co company companies holdings holding group plc ltd limited technologies technology
  international incorporated class common stock shares trust fund etf and of`.split(/\s+/),
);
// Names that headlines use instead of the listed company name.
const ALIASES: Record<string, string[]> = {
  GOOGL: ['google'], GOOG: ['google'], META: ['facebook', 'instagram'], 'BRK-B': ['berkshire', 'buffett'],
  'BRK-A': ['berkshire', 'buffett'], LLY: ['lilly'], JPM: ['jpmorgan'], KO: ['coca-cola'], PG: ['p&g'], JNJ: ['j&j'],
};

/** Words that identify the company in a headline: the ticker, distinctive words of its name, known aliases. */
export function companyTerms(ticker: string, name: string): string[] {
  const words = name
    .toLowerCase()
    .replace(/[.,()]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !GENERIC.has(w));
  return [...new Set([ticker.toLowerCase(), ...words, ...(ALIASES[ticker] ?? [])])];
}

/** Aggregated feeds mix in market-wide stories; only headlines that name the company carry its events. */
export function mentionsCompany(title: string, terms: string[]): boolean {
  const t = ` ${title.toLowerCase().replace(/[^a-z0-9&\-]+/g, ' ')} `;
  return terms.some((w) => t.includes(` ${w} `) || t.includes(` ${w}s `));
}

export function detectEvent(title: string): NewsEvent | null {
  const t = title.toLowerCase().replace(/[’']/g, "'");
  const r = RULES.find((x) => x.re.test(t));
  return r ? { key: r.key, label: r.label, effect: r.effect } : null;
}

export interface EventSummary {
  score: number; // -1..1, recency-weighted
  count: number;
  byLabel: { label: string; count: number; effect: number }[]; // most frequent first
}

/** Events from the last `days` days; newer ones count more (half-life 4 days). */
export function recentEvents(news: NewsItem[], now = Date.now(), days = 14): EventSummary {
  const recent = news.filter((n) => n.event && n.publishedAt && now - Date.parse(n.publishedAt) < days * 86_400_000);
  const by = new Map<string, { label: string; count: number; effect: number }>();
  let sum = 0;
  for (const n of recent) {
    const age = (now - Date.parse(n.publishedAt!)) / 86_400_000;
    sum += n.event!.effect * Math.pow(0.5, age / 4);
    const b = by.get(n.event!.key) ?? { label: n.event!.label, count: 0, effect: n.event!.effect };
    b.count++;
    by.set(n.event!.key, b);
  }
  return {
    // Several agreeing events push toward ±1; one fresh strong event ≈ ±0.5.
    score: Math.tanh(sum * 0.6),
    count: recent.length,
    byLabel: [...by.values()].sort((a, b) => b.count - a.count || Math.abs(b.effect) - Math.abs(a.effect)),
  };
}
