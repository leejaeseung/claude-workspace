// Headline sentiment from a small finance-specific lexicon (in the spirit of Loughran–McDonald).
// It is deliberately simple: it reads only the headline, handles basic negation, and returns -1..1.

const POSITIVE: Record<string, number> = {
  beat: 1, beats: 1, 'tops': 1, topped: 1, surge: 1, surges: 1, surged: 1, soar: 1, soars: 1, soared: 1,
  jump: 0.8, jumps: 0.8, jumped: 0.8, rally: 0.8, rallies: 0.8, rallied: 0.8, gain: 0.6, gains: 0.6, gained: 0.6,
  rise: 0.5, rises: 0.5, rose: 0.5, climb: 0.6, climbs: 0.6, climbed: 0.6, record: 0.6, 'all-time': 0.5,
  upgrade: 1, upgrades: 1, upgraded: 1, outperform: 0.8, overweight: 0.7, bullish: 1,
  raises: 0.7, raised: 0.7, boost: 0.6, boosts: 0.6, boosted: 0.6, strong: 0.6, stronger: 0.6, robust: 0.6,
  growth: 0.4, profit: 0.4, profitable: 0.6, expands: 0.4, expansion: 0.4, wins: 0.7, win: 0.5, won: 0.6,
  approval: 0.8, approved: 0.8, approves: 0.8, breakthrough: 0.9, partnership: 0.4, deal: 0.3, buyback: 0.7,
  dividend: 0.3, optimistic: 0.7, optimism: 0.7, upbeat: 0.8, rebound: 0.6, rebounds: 0.6, recovers: 0.6,
  accelerate: 0.5, accelerates: 0.5, exceeds: 0.9, exceeded: 0.9, momentum: 0.4, upside: 0.6, higher: 0.4,
  'outpaces': 0.6, 'tailwind': 0.6, 'tailwinds': 0.6,
};

const NEGATIVE: Record<string, number> = {
  miss: 1, misses: 1, missed: 1, plunge: 1, plunges: 1, plunged: 1, tumble: 1, tumbles: 1, tumbled: 1,
  sink: 0.8, sinks: 0.8, sank: 0.8, slump: 0.9, slumps: 0.9, slumped: 0.9, drop: 0.7, drops: 0.7, dropped: 0.7,
  fall: 0.6, falls: 0.6, fell: 0.6, decline: 0.6, declines: 0.6, declined: 0.6, slide: 0.6, slides: 0.6, slid: 0.6,
  downgrade: 1, downgrades: 1, downgraded: 1, underperform: 0.8, underweight: 0.7, bearish: 1,
  cuts: 0.6, cut: 0.5, lowers: 0.6, lowered: 0.6, weak: 0.7, weaker: 0.7, weakness: 0.7, loss: 0.6, losses: 0.6,
  lawsuit: 0.8, sues: 0.7, sued: 0.7, probe: 0.8, investigation: 0.8, fraud: 1, recall: 0.8, recalls: 0.8,
  layoffs: 0.6, layoff: 0.6, warns: 0.8, warning: 0.7, risk: 0.3, risks: 0.3, concern: 0.5, concerns: 0.5,
  fears: 0.6, fear: 0.5, volatile: 0.3, crash: 1, selloff: 0.9, 'sell-off': 0.9, bankruptcy: 1, default: 0.8,
  delay: 0.5, delays: 0.5, delayed: 0.5, halt: 0.7, halts: 0.7, fined: 0.7, penalty: 0.6,
  disappoint: 0.8, disappoints: 0.8, disappointing: 0.8, slowdown: 0.6, slows: 0.5, headwind: 0.6, headwinds: 0.6,
  lower: 0.4, downside: 0.6, overvalued: 0.6, bubble: 0.5, tariff: 0.4, tariffs: 0.4, antitrust: 0.6,
};

const NEGATORS = new Set(['not', 'no', "n't", 'never', 'without', 'fails', 'fail', 'failed']);

export function headlineSentiment(title: string): number {
  const words = title
    .toLowerCase()
    .replace(/[’']/g, "'")
    .split(/[^a-z0-9'\-]+/)
    .filter(Boolean);
  let score = 0;
  let hits = 0;
  words.forEach((w, i) => {
    const base = POSITIVE[w] ?? (NEGATIVE[w] != null ? -NEGATIVE[w] : 0);
    if (!base) return;
    const negated = [words[i - 1], words[i - 2]].some((p) => p && (NEGATORS.has(p) || p.endsWith("n't")));
    score += negated ? -base * 0.7 : base;
    hits++;
  });
  if (!hits) return 0;
  // Squash so one strong word ≈ ±0.6, several agreeing words approach ±1.
  return Math.tanh(score * 0.7);
}

export function label(s: number): 'positive' | 'neutral' | 'negative' {
  return s > 0.15 ? 'positive' : s < -0.15 ? 'negative' : 'neutral';
}
