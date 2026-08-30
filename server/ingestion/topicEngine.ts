import { db } from '../database/db.js';

export interface TopicDetails {
  id: number;
  name: string;
  slug: string;
  category: string;
  description: string;
  icon: string;
  color: string;
  followed?: boolean;
  notification_level?: string;
  momentum_score?: number;
  stories_today?: number;
  high_signal_count?: number;
  breaking_count?: number;
  early_signals_count?: number;
  sources_count?: number;
}

let topicMomentumCache = new Map<number, number>();
let lastTopicMomentumCalcTime = 0;
const TOPIC_MOMENTUM_TTL_MS = 2 * 60 * 1000; // 2 minutes

export function classifyClusterTopics(clusterId: number, title: string, summary: string, articlesText: string) {
  const text = `${title} ${summary} ${articlesText}`.toLowerCase();
  
  const topics = db.prepare('SELECT id, name FROM topics WHERE active = 1').all() as any[];
  const allKeywords = db.prepare('SELECT topic_id, keyword, weight FROM topic_keywords').all() as any[];
  
  const keywordsByTopic = new Map<number, Array<{ keyword: string; weight: number }>>();
  for (const kw of allKeywords) {
    const list = keywordsByTopic.get(kw.topic_id) || [];
    list.push(kw);
    keywordsByTopic.set(kw.topic_id, list);
  }

  const insertArticleTopic = db.prepare(`
    INSERT INTO article_topics (cluster_id, topic_id, relevance_score, classification_method)
    VALUES (?, ?, ?, 'KEYWORD_WEIGHTED')
    ON CONFLICT(cluster_id, topic_id) DO UPDATE SET
      relevance_score = excluded.relevance_score
  `);

  for (const topic of topics) {
    const keywords = keywordsByTopic.get(topic.id) || [];
    let hits = 0;
    let totalScore = 0;

    for (const kw of keywords) {
      if (text.includes(kw.keyword)) {
        hits++;
        totalScore += (kw.weight || 1.0) * 25;
      }
    }

    // Exact topic name match boost
    if (text.includes(topic.name.toLowerCase()) || topic.name.toLowerCase().includes(title.toLowerCase())) {
      totalScore += 40;
    }

    const relevanceScore = Math.min(100, Math.round(totalScore));
    if (relevanceScore >= 20 || hits >= 1) {
      insertArticleTopic.run(clusterId, topic.id, Math.max(50, relevanceScore));
    }
  }
}

/**
 * Calculates topic momentum using batch aggregation and in-memory TTL caching
 */
export function calculateTopicMomentum(topicId: number): number {
  const now = Date.now();
  if (now - lastTopicMomentumCalcTime > TOPIC_MOMENTUM_TTL_MS || topicMomentumCache.size === 0) {
    recalculateAllTopicMomentum();
  }

  return topicMomentumCache.get(topicId) || 50;
}

export function recalculateAllTopicMomentum() {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  try {
    // Single aggregated query across all topics for past 48 hours
    const rows = db.prepare(`
      SELECT 
        at.topic_id,
        SUM(CASE WHEN c.last_updated_at >= ? THEN 1 ELSE 0 END) as recent_count,
        SUM(CASE WHEN c.last_updated_at >= ? AND c.last_updated_at < ? THEN 1 ELSE 0 END) as previous_count,
        SUM(CASE WHEN c.last_updated_at >= ? AND c.importance_score >= 65 THEN 1 ELSE 0 END) as high_signal_count
      FROM article_topics at
      JOIN story_clusters c ON at.cluster_id = c.id
      WHERE c.last_updated_at >= ?
      GROUP BY at.topic_id
    `).all(twentyFourHoursAgo, fortyEightHoursAgo, twentyFourHoursAgo, twentyFourHoursAgo, fortyEightHoursAgo) as any[];

    const newMap = new Map<number, number>();
    for (const r of rows) {
      const recent = r.recent_count || 0;
      const previous = r.previous_count || 0;
      const highSignal = r.high_signal_count || 0;

      let score = Math.min(100, Math.round((recent * 8) + (highSignal * 12)));
      if (recent > previous) score = Math.min(100, score + 15);
      newMap.set(r.topic_id, Math.max(15, score));
    }

    topicMomentumCache = newMap;
    lastTopicMomentumCalcTime = Date.now();
  } catch (e) {
    // Fallback gracefully
  }
}

export function extractEntitiesForTopic(topicId: number) {
  const clusters = db.prepare(`
    SELECT c.cluster_title, c.summary, c.primary_source_name
    FROM article_topics at
    JOIN story_clusters c ON at.cluster_id = c.id
    WHERE at.topic_id = ?
    ORDER BY c.last_updated_at DESC
    LIMIT 30
  `).all(topicId) as any[];

  const companyKeywords = ['Anthropic', 'OpenAI', 'Google DeepMind', 'Microsoft', 'Meta', 'Hugging Face', 'Mistral', 'NVIDIA', 'AMD', 'Amazon', 'Apple', 'Cohere', 'Runway'];
  const modelKeywords = ['Claude', 'GPT', 'Gemini', 'Llama', 'Mistral', 'DeepSeek', 'Stable Diffusion', 'Sora', 'Whisper', 'Flux'];

  const text = clusters.map(c => `${c.cluster_title} ${c.summary} ${c.primary_source_name}`).join(' ');

  const companies = companyKeywords.filter(comp => new RegExp(`\\b${comp}\\b`, 'i').test(text)).slice(0, 5);
  const models = modelKeywords.filter(m => new RegExp(`\\b${m}\\b`, 'i').test(text)).slice(0, 5);

  return { companies, models };
}

export function getTopicWhatChanged(topicId: number) {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const breakingCluster = db.prepare(`
    SELECT c.cluster_title, c.summary
    FROM article_topics at
    JOIN story_clusters c ON at.cluster_id = c.id
    WHERE at.topic_id = ? AND c.breaking = 1
    ORDER BY c.last_updated_at DESC
    LIMIT 1
  `).get(topicId) as any;

  const topRecent = db.prepare(`
    SELECT c.cluster_title, c.summary, c.importance_score
    FROM article_topics at
    JOIN story_clusters c ON at.cluster_id = c.id
    WHERE at.topic_id = ? AND c.last_updated_at >= ?
    ORDER BY c.importance_score DESC
    LIMIT 3
  `).all(topicId, twentyFourHoursAgo) as any[];

  if (breakingCluster) {
    return {
      status: 'BREAKING_UPDATE',
      headline: `Breaking: ${breakingCluster.cluster_title}`,
      summary: breakingCluster.summary
    };
  }

  if (topRecent.length > 0) {
    return {
      status: 'ACTIVE_DEVELOPMENTS',
      headline: `${topRecent[0].cluster_title}`,
      summary: topRecent.map(r => r.summary).slice(0, 2).join(' ')
    };
  }

  return {
    status: 'STEADY_MONITORING',
    headline: 'Routine research & community activity',
    summary: 'No critical inflection points or unexpected disruptions detected in the last 24 hours.'
  };
}
