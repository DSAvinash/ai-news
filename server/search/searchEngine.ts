import { db } from '../database/db.js';

export interface SearchOptions {
  query?: string;
  type?: string; // 'all' | 'news' | 'events' | 'models' | 'research' | 'topics' | 'sources' | 'briefings'
  category?: string; // 'All' | 'MODEL RELEASE' | 'RESEARCH' | 'AI AGENTS' | etc.
  source?: string;
  range?: string; // 'all' | '1h' | 'today' | '24h' | '7d' | '30d' | '1y'
  importance?: string; // 'all' | 'high' | 'critical'
  sort?: string; // 'relevance' | 'newest' | 'oldest' | 'importance' | 'updated'
  page?: number;
  limit?: number;
}

export interface SearchResultItem {
  id: number | string;
  type: 'NEWS' | 'EVENT' | 'MODEL' | 'COMPANY' | 'RESEARCH' | 'TOPIC' | 'SOURCE' | 'BRIEFING';
  title: string;
  summary: string;
  why_it_matters?: string;
  category: string;
  primary_source_name?: string;
  primary_source_url?: string;
  published_at: string;
  importance_score: number;
  credibility_score: number;
  radar_score: number;
  relevance_score: number;
  supporting_count?: number;
  slug?: string;
  url?: string;
  key_points?: string[];
}

export interface SearchResponse {
  success: boolean;
  query: string;
  normalizedQuery: string;
  correctedTerm?: string;
  total: number;
  page: number;
  pageSize: number;
  results: SearchResultItem[];
  facets: {
    types: Record<string, number>;
    categories: Record<string, number>;
    sources: Record<string, number>;
  };
}

const ALIASES: Record<string, string> = {
  anthorpic: 'Anthropic',
  anthropic: 'Anthropic',
  claude: 'Anthropic Claude',
  'open ai': 'OpenAI',
  openai: 'OpenAI',
  chatgpt: 'OpenAI ChatGPT',
  'chat gpt': 'OpenAI ChatGPT',
  gemni: 'Gemini',
  gemini: 'Google Gemini',
  deepmind: 'Google DeepMind',
  nvida: 'NVIDIA',
  nvidia: 'NVIDIA',
  llama: 'Meta Llama',
  meta: 'Meta AI',
  mistral: 'Mistral AI',
  deepseek: 'DeepSeek'
};

export function normalizeSearchQuery(rawQuery: string): { normalized: string; corrected?: string } {
  const clean = rawQuery.trim().toLowerCase();
  if (!clean) return { normalized: '' };

  for (const [typo, fix] of Object.entries(ALIASES)) {
    if (clean === typo || clean.includes(typo)) {
      return { normalized: clean, corrected: fix };
    }
  }

  return { normalized: clean };
}

function calculateRelevanceScore(
  itemTitle: string,
  itemSummary: string,
  query: string,
  importanceScore: number,
  credibilityScore: number,
  publishedAt: string
): number {
  if (!query) return importanceScore;

  const titleLower = itemTitle.toLowerCase();
  const summaryLower = itemSummary.toLowerCase();
  const queryLower = query.toLowerCase();

  let score = 0;

  // Exact Title Match
  if (titleLower === queryLower) score += 100;
  else if (titleLower.includes(queryLower)) score += 60;

  // Exact Word Matches
  const terms = queryLower.split(/\s+/).filter(t => t.length > 2);
  terms.forEach(t => {
    if (titleLower.includes(t)) score += 20;
    if (summaryLower.includes(t)) score += 10;
  });

  // Base Quality Weighting
  score += importanceScore * 0.3;
  score += credibilityScore * 100 * 0.2;

  // Recency Decay Bonus (0-20 points)
  try {
    const ageHours = (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60);
    if (ageHours < 24) score += 20;
    else if (ageHours < 72) score += 10;
    else if (ageHours < 168) score += 5;
  } catch (e) {}

  return Math.round(score);
}

function inferResultType(category: string, title: string, summary: string): 'NEWS' | 'EVENT' | 'MODEL' | 'COMPANY' | 'RESEARCH' {
  const text = `${title} ${summary}`.toLowerCase();

  if (category === 'MODEL RELEASE' || /\b(gpt-4|gpt-5|claude|gemini|llama|deepseek|mistral|o3|o1|qwen|model release)\b/.test(text)) {
    return 'MODEL';
  }
  if (category === 'RESEARCH' || /\b(paper|arxiv|breakthrough|architecture|benchmark)\b/.test(text)) {
    return 'RESEARCH';
  }
  if (/\b(openai|google|anthropic|meta|nvidia|microsoft|hugging face|startup|corp)\b/.test(text)) {
    return 'COMPANY';
  }
  if (/\b(launches|unveils|announces|acquires|funding|partnership|event|conference)\b/.test(text)) {
    return 'EVENT';
  }

  return 'NEWS';
}

export function executeGlobalSearch(options: SearchOptions): SearchResponse {
  const {
    query = '',
    type = 'all',
    category = 'All',
    source = 'All',
    range = 'all',
    importance = 'all',
    sort = 'relevance',
    page = 1,
    limit = 20
  } = options;

  const { normalized, corrected } = normalizeSearchQuery(query);

  let dateCutoffIso: string | null = null;
  if (range !== 'all') {
    let ms = 24 * 60 * 60 * 1000;
    if (range === '1h') ms = 1 * 60 * 60 * 1000;
    if (range === 'today' || range === '24h') ms = 24 * 60 * 60 * 1000;
    if (range === '7d') ms = 7 * 24 * 60 * 60 * 1000;
    if (range === '30d') ms = 30 * 24 * 60 * 60 * 1000;
    if (range === '1y') ms = 365 * 24 * 60 * 60 * 1000;
    dateCutoffIso = new Date(Date.now() - ms).toISOString();
  }

  const rawResults: SearchResultItem[] = [];

  // 1. Search Story Clusters (News, Events, Models, Research, Companies)
  if (['all', 'news', 'events', 'models', 'research', 'companies'].includes(type)) {
    let clusterQuery = `
      SELECT c.*, 
        (SELECT COUNT(*) FROM cluster_articles ca WHERE ca.cluster_id = c.id) as supporting_count
      FROM story_clusters c
      WHERE 1=1
    `;
    const params: any[] = [];

    if (dateCutoffIso) {
      clusterQuery += ` AND c.last_updated_at >= ?`;
      params.push(dateCutoffIso);
    }

    if (category !== 'All') {
      clusterQuery += ` AND c.category = ?`;
      params.push(category);
    }

    if (source !== 'All') {
      clusterQuery += ` AND c.primary_source_name = ?`;
      params.push(source);
    }

    if (importance === 'high') {
      clusterQuery += ` AND c.importance_score >= 70`;
    } else if (importance === 'critical') {
      clusterQuery += ` AND c.importance_score >= 85`;
    }

    if (normalized) {
      clusterQuery += ` AND (c.cluster_title LIKE ? OR c.summary LIKE ? OR c.primary_source_name LIKE ?)`;
      const term = `%${normalized}%`;
      params.push(term, term, term);
    }

    clusterQuery += ` ORDER BY c.importance_score DESC, c.last_updated_at DESC LIMIT 150`;

    const clusters = db.prepare(clusterQuery).all(...params) as any[];

    clusters.forEach(c => {
      const itemType = inferResultType(c.category, c.cluster_title, c.summary);
      const relScore = calculateRelevanceScore(c.cluster_title, c.summary, normalized, c.importance_score, c.credibility_score, c.last_updated_at);

      rawResults.push({
        id: c.id,
        type: itemType,
        title: c.cluster_title,
        summary: c.summary,
        why_it_matters: c.why_it_matters,
        category: c.category,
        primary_source_name: c.primary_source_name,
        primary_source_url: c.primary_source_url,
        published_at: c.last_updated_at || c.first_seen_at,
        importance_score: c.importance_score,
        credibility_score: c.credibility_score,
        radar_score: c.radar_score,
        relevance_score: relScore,
        supporting_count: c.supporting_count || 1,
        key_points: c.key_points_json ? JSON.parse(c.key_points_json) : []
      });
    });
  }

  // 2. Search Topics Directory
  if (['all', 'topics'].includes(type)) {
    let topicQuery = `SELECT * FROM topics WHERE active = 1`;
    const topicParams: any[] = [];
    if (normalized) {
      topicQuery += ` AND (name LIKE ? OR category LIKE ? OR description LIKE ?)`;
      const term = `%${normalized}%`;
      topicParams.push(term, term, term);
    }
    const topics = db.prepare(topicQuery).all(...topicParams) as any[];

    topics.forEach(t => {
      const relScore = calculateRelevanceScore(t.name, t.description || '', normalized, 80, 0.9, t.created_at);
      rawResults.push({
        id: `topic-${t.id}`,
        type: 'TOPIC',
        title: t.name,
        summary: t.description || `Explore ${t.name} intelligence channel.`,
        category: t.category,
        published_at: t.created_at,
        importance_score: 80,
        credibility_score: 0.9,
        radar_score: 85,
        relevance_score: relScore,
        slug: t.slug
      });
    });
  }

  // 3. Search Publisher Sources
  if (['all', 'sources'].includes(type)) {
    let srcQuery = `SELECT * FROM sources WHERE active = 1`;
    const srcParams: any[] = [];
    if (normalized) {
      srcQuery += ` AND (name LIKE ? OR source_type LIKE ?)`;
      const term = `%${normalized}%`;
      srcParams.push(term, term);
    }
    const sources = db.prepare(srcQuery).all(...srcParams) as any[];

    sources.forEach(s => {
      const relScore = calculateRelevanceScore(s.name, s.url, normalized, 75, s.reliability_score, s.last_checked || new Date().toISOString());
      rawResults.push({
        id: `source-${s.id}`,
        type: 'SOURCE',
        title: s.name,
        summary: `Verified ${s.source_type} source outlet tracking AI developments.`,
        category: s.source_type,
        primary_source_name: s.name,
        primary_source_url: s.url,
        published_at: s.last_checked || new Date().toISOString(),
        importance_score: 75,
        credibility_score: s.reliability_score,
        radar_score: Math.round(s.reliability_score * 100),
        relevance_score: relScore,
        url: s.url
      });
    });
  }

  // 4. Search Historical Daily Briefings
  if (['all', 'briefings'].includes(type)) {
    let briefQuery = `SELECT * FROM email_briefings WHERE 1=1`;
    const briefParams: any[] = [];
    if (normalized) {
      briefQuery += ` AND (briefing_date LIKE ? OR summary LIKE ?)`;
      const term = `%${normalized}%`;
      briefParams.push(term, term);
    }
    briefQuery += ` ORDER BY generated_at DESC LIMIT 30`;
    const briefings = db.prepare(briefQuery).all(...briefParams) as any[];

    briefings.forEach(b => {
      const relScore = calculateRelevanceScore(`Daily AI Briefing — ${b.briefing_date}`, b.summary || '', normalized, 85, 1.0, b.generated_at);
      rawResults.push({
        id: `briefing-${b.id}`,
        type: 'BRIEFING',
        title: `Daily AI Briefing — ${b.briefing_date}`,
        summary: b.summary || 'Delivered 07:00 AM daily intelligence digest.',
        category: 'DAILY BRIEFING',
        published_at: b.generated_at,
        importance_score: 85,
        credibility_score: 1.0,
        radar_score: 90,
        relevance_score: relScore
      });
    });
  }

  // Filter by Type tab if specific
  let filteredResults = rawResults;
  if (type !== 'all') {
    const targetType = type.toUpperCase();
    filteredResults = rawResults.filter(r => r.type === targetType || (type === 'news' && r.type === 'NEWS') || (type === 'events' && r.type === 'EVENT') || (type === 'models' && r.type === 'MODEL') || (type === 'research' && r.type === 'RESEARCH'));
  }

  // Sort Engine
  if (sort === 'relevance') {
    filteredResults.sort((a, b) => b.relevance_score - a.relevance_score || new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
  } else if (sort === 'newest') {
    filteredResults.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
  } else if (sort === 'oldest') {
    filteredResults.sort((a, b) => new Date(a.published_at).getTime() - new Date(b.published_at).getTime());
  } else if (sort === 'importance') {
    filteredResults.sort((a, b) => b.importance_score - a.importance_score);
  }

  // Generate Facet Counts
  const typeFacets: Record<string, number> = { all: rawResults.length, news: 0, events: 0, models: 0, research: 0, topics: 0, sources: 0, briefings: 0 };
  const catFacets: Record<string, number> = {};
  const srcFacets: Record<string, number> = {};

  rawResults.forEach(r => {
    const tKey = r.type.toLowerCase();
    typeFacets[tKey] = (typeFacets[tKey] || 0) + 1;
    if (r.category) catFacets[r.category] = (catFacets[r.category] || 0) + 1;
    if (r.primary_source_name) srcFacets[r.primary_source_name] = (srcFacets[r.primary_source_name] || 0) + 1;
  });

  // Pagination Slice
  const total = filteredResults.length;
  const startIndex = (page - 1) * limit;
  const paginatedResults = filteredResults.slice(startIndex, startIndex + limit);

  return {
    success: true,
    query,
    normalizedQuery: normalized,
    correctedTerm: corrected,
    total,
    page,
    pageSize: limit,
    results: paginatedResults,
    facets: {
      types: typeFacets,
      categories: catFacets,
      sources: srcFacets
    }
  };
}
