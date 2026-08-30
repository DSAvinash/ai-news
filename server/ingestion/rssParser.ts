import Parser from 'rss-parser';
import crypto from 'crypto';
import { db } from '../database/db.js';
import { logger } from '../logger.js';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 (compatible; AI-Intelligence-Radar/1.0; +https://radar.ai)';

const parser = new Parser({
  timeout: 12000,
  headers: {
    'User-Agent': USER_AGENT,
    'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*'
  },
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['enclosure', 'enclosure'],
      ['content:encoded', 'contentEncoded']
    ]
  }
});

export interface IngestedArticle {
  source_id: number;
  title: string;
  description: string;
  url: string;
  canonical_url: string;
  author: string | null;
  published_at: string;
  image_url: string | null;
  raw_content: string;
  content_hash: string;
  credibility_score: number;
}

export function generateContentHash(title: string, url: string): string {
  const cleanTitle = title.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanUrl = url.trim().toLowerCase().split('?')[0]; // Strip tracking params
  return crypto.createHash('sha256').update(`${cleanTitle}::${cleanUrl}`).digest('hex');
}

export function extractImageUrl(item: any): string | null {
  if (item.mediaContent && item.mediaContent.$ && item.mediaContent.$.url) {
    return item.mediaContent.$.url;
  }
  if (item.enclosure && item.enclosure.url && item.enclosure.type?.startsWith('image')) {
    return item.enclosure.url;
  }
  if (item.contentEncoded) {
    const imgMatch = item.contentEncoded.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch) return imgMatch[1];
  }
  if (item.content) {
    const imgMatch = item.content.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (imgMatch) return imgMatch[1];
  }
  return null;
}

export function sanitizeText(str?: string): string {
  if (!str) return '';
  return str
    .replace(/<[^>]*>?/gm, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Resiliently fetches and parses RSS/Atom XML, with fallback string parsing for malformed feeds
 */
async function fetchAndParseXml(url: string): Promise<any> {
  try {
    return await parser.parseURL(url);
  } catch (primaryErr: any) {
    // If parseURL fails (e.g. 403, malformed tags, or non-standard encoding), try direct fetch + sanitize + parseString
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*'
      },
      signal: AbortSignal.timeout(12000)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const xmlText = await response.text();
    // Sanitize unescaped ampersands or malformed XML entities
    const sanitizedXml = xmlText
      .replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[a-f\d]+);)/gi, '&amp;');

    return await parser.parseString(sanitizedXml);
  }
}

export async function fetchFeed(source: any): Promise<IngestedArticle[]> {
  const newArticles: IngestedArticle[] = [];

  // Circuit Breaker: If source failed >= 10 consecutive times, pause polling for 20 minutes
  if (source.error_count >= 10 && source.last_checked) {
    const lastCheckedTime = new Date(source.last_checked).getTime();
    const cooldownMs = 20 * 60 * 1000;
    if (Date.now() - lastCheckedTime < cooldownMs) {
      return newArticles;
    }
  }

  try {
    const feed = await fetchAndParseXml(source.rss_url);
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE sources 
      SET last_checked = ?, last_success = ?, error_count = 0 
      WHERE id = ?
    `).run(now, now, source.id);

    const checkHashStmt = db.prepare('SELECT id FROM articles WHERE content_hash = ?');

    for (const item of feed.items || []) {
      const title = sanitizeText(item.title || '');
      const url = item.link || item.guid || '';
      if (!title || !url) continue;

      const hash = generateContentHash(title, url);
      const existing = checkHashStmt.get(hash);
      if (existing) continue;

      const rawDescription = item.contentSnippet || item.content || item.summary || item.description || '';
      const description = sanitizeText(rawDescription).slice(0, 1000);
      const pubDate = item.isoDate || (item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString());
      const author = item.creator || item.author || null;
      const imageUrl = extractImageUrl(item);

      newArticles.push({
        source_id: source.id,
        title,
        description,
        url,
        canonical_url: url.split('?')[0],
        author,
        published_at: pubDate,
        image_url: imageUrl,
        raw_content: rawDescription.slice(0, 4000),
        content_hash: hash,
        credibility_score: source.reliability_score || 0.85
      });
    }
  } catch (err: any) {
    db.prepare(`
      UPDATE sources 
      SET last_checked = CURRENT_TIMESTAMP, error_count = error_count + 1 
      WHERE id = ?
    `).run(source.id);

    logger.warn('RSS_PARSER', 'FETCH_WARNING', `Warning for source "${source.name}" (${source.rss_url}): ${err.message}`);
  }

  return newArticles;
}

export async function fetchAllActiveSources(): Promise<IngestedArticle[]> {
  const sources = db.prepare('SELECT * FROM sources WHERE active = 1').all() as any[];
  console.log(`[Ingestion] Polling ${sources.length} active feeds...`);

  const results = await Promise.allSettled(sources.map((s) => fetchFeed(s)));
  const allArticles: IngestedArticle[] = [];

  for (const res of results) {
    if (res.status === 'fulfilled') {
      allArticles.push(...res.value);
    }
  }

  console.log(`[Ingestion] Discovered ${allArticles.length} new raw articles.`);
  return allArticles;
}
