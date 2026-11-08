import { fetchText } from '../http.ts';
import { parseRss, type RawNews } from './yahoo.ts';

export async function getGoogleNews(ticker: string, companyName: string): Promise<RawNews[]> {
  // Ticker alone matches too much noise for short symbols (e.g. "F", "T"); pair it with the name.
  const name = companyName.replace(/,?\s+(Inc\.?|Corp(oration)?\.?|Ltd\.?|plc|Co\.?|Holdings?|Class [A-C])\b.*$/i, '').trim();
  // Require a market-related word so "Apple" doesn't pull in orchards and festivals.
  const q = `("${ticker}" OR "${name}") (stock OR shares OR earnings OR analyst OR analysts OR investors) when:7d`;
  const text = await fetchText(
    `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`,
  );
  return parseRss(text, 'Google News').slice(0, 20).map((n) => ({
    ...n,
    // Google appends " - Publisher" to titles.
    title: n.source && n.title.endsWith(` - ${n.source}`) ? n.title.slice(0, -(n.source.length + 3)) : n.title,
  }));
}
