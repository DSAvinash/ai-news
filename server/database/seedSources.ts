import { db } from './db.js';

export interface SourceSeed {
  name: string;
  url: string;
  rss_url: string;
  source_type: 'PRIMARY' | 'CREDIBLE_NEWS' | 'DISCOVERY' | 'COMMUNITY';
  reliability_score: number;
}

export const INITIAL_SOURCES: SourceSeed[] = [
  // TIER 1 — PRIMARY SOURCES (Reliability 0.95 - 1.00)
  {
    name: 'OpenAI Newsroom',
    url: 'https://openai.com/news/',
    rss_url: 'https://openrss.org/openai.com/news/rss.xml',
    source_type: 'PRIMARY',
    reliability_score: 1.00,
  },
  {
    name: 'Google DeepMind',
    url: 'https://deepmind.google/blog/',
    rss_url: 'https://deepmind.google/blog/feed/',
    source_type: 'PRIMARY',
    reliability_score: 1.00,
  },
  {
    name: 'Anthropic Announcements',
    url: 'https://www.anthropic.com/news',
    rss_url: 'https://openrss.org/www.anthropic.com/news',
    source_type: 'PRIMARY',
    reliability_score: 1.00,
  },
  {
    name: 'Meta AI (FAIR)',
    url: 'https://engineering.fb.com/category/ai-research/',
    rss_url: 'https://engineering.fb.com/category/ai-research/feed/',
    source_type: 'PRIMARY',
    reliability_score: 1.00,
  },
  {
    name: 'NVIDIA AI Blog',
    url: 'https://blogs.nvidia.com/',
    rss_url: 'https://blogs.nvidia.com/feed/',
    source_type: 'PRIMARY',
    reliability_score: 0.95,
  },
  {
    name: 'arXiv Artificial Intelligence (cs.AI)',
    url: 'https://arxiv.org/list/cs.AI/recent',
    rss_url: 'http://export.arxiv.org/rss/cs.AI',
    source_type: 'PRIMARY',
    reliability_score: 0.95,
  },
  {
    name: 'Hugging Face Blog',
    url: 'https://huggingface.co/blog',
    rss_url: 'https://huggingface.co/blog/feed.xml',
    source_type: 'PRIMARY',
    reliability_score: 0.95,
  },
  {
    name: 'Google AI & Tech Blog',
    url: 'https://blog.google/',
    rss_url: 'https://blog.google/feed/',
    source_type: 'PRIMARY',
    reliability_score: 0.95,
  },
  {
    name: 'Microsoft AI & Research',
    url: 'https://www.microsoft.com/en-us/research/',
    rss_url: 'https://www.microsoft.com/en-us/research/feed/',
    source_type: 'PRIMARY',
    reliability_score: 0.95,
  },
  {
    name: 'MIT Technology Review AI',
    url: 'https://www.technologyreview.com/topic/artificial-intelligence/',
    rss_url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed/',
    source_type: 'PRIMARY',
    reliability_score: 0.90,
  },

  // TIER 2 — CREDIBLE TECHNOLOGY NEWS (Reliability 0.85)
  {
    name: 'TechCrunch AI',
    url: 'https://techcrunch.com/category/artificial-intelligence/',
    rss_url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
    source_type: 'CREDIBLE_NEWS',
    reliability_score: 0.85,
  },
  {
    name: 'Ars Technica AI',
    url: 'https://arstechnica.com/',
    rss_url: 'https://feeds.arstechnica.com/arstechnica/technology-lab',
    source_type: 'CREDIBLE_NEWS',
    reliability_score: 0.85,
  },
  {
    name: 'VentureBeat AI',
    url: 'https://venturebeat.com/category/ai/',
    rss_url: 'https://venturebeat.com/category/ai/feed/',
    source_type: 'CREDIBLE_NEWS',
    reliability_score: 0.85,
  },
  {
    name: 'The Verge AI',
    url: 'https://www.theverge.com/ai-artificial-intelligence',
    rss_url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
    source_type: 'CREDIBLE_NEWS',
    reliability_score: 0.85,
  },

  // TIER 3 — SECONDARY DISCOVERY (Reliability 0.60 - 0.75)
  {
    name: 'Google News — Artificial Intelligence',
    url: 'https://news.google.com/',
    rss_url: 'https://news.google.com/rss/search?q=artificial%20intelligence&hl=en-US',
    source_type: 'DISCOVERY',
    reliability_score: 0.70,
  },
  {
    name: 'Google News — AI Model Release',
    url: 'https://news.google.com/',
    rss_url: 'https://news.google.com/rss/search?q=AI%20model%20release&hl=en-US',
    source_type: 'DISCOVERY',
    reliability_score: 0.70,
  },
  {
    name: 'Google News — AI Agents & Coding',
    url: 'https://news.google.com/',
    rss_url: 'https://news.google.com/rss/search?q=AI%20agents%20or%20AI%20coding&hl=en-US',
    source_type: 'DISCOVERY',
    reliability_score: 0.70,
  },
  {
    name: 'Google News — Open Source AI',
    url: 'https://news.google.com/',
    rss_url: 'https://news.google.com/rss/search?q=open%20source%20AI&hl=en-US',
    source_type: 'DISCOVERY',
    reliability_score: 0.70,
  },

  // TIER 4 — COMMUNITY SIGNALS (Reliability 0.50 - 0.60)
  {
    name: 'Hacker News RSS',
    url: 'https://news.ycombinator.com/',
    rss_url: 'https://news.ycombinator.com/rss',
    source_type: 'COMMUNITY',
    reliability_score: 0.60,
  },
  {
    name: 'Reddit r/MachineLearning',
    url: 'https://www.reddit.com/r/MachineLearning/',
    rss_url: 'https://www.reddit.com/r/MachineLearning/.rss',
    source_type: 'COMMUNITY',
    reliability_score: 0.55,
  },
  {
    name: 'Reddit r/LocalLLaMA',
    url: 'https://www.reddit.com/r/LocalLLaMA/',
    rss_url: 'https://www.reddit.com/r/LocalLLaMA/.rss',
    source_type: 'COMMUNITY',
    reliability_score: 0.55,
  },
];

export function seedSourcesIfNeeded() {
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO sources (name, url, rss_url, source_type, reliability_score)
    VALUES (?, ?, ?, ?, ?)
  `);

  try {
    for (const s of INITIAL_SOURCES) {
      insertStmt.run(s.name, s.url, s.rss_url, s.source_type, s.reliability_score);
    }
  } catch (err: any) {
    console.warn('[Seed Warning]:', err.message);
  }
}

seedSourcesIfNeeded();
