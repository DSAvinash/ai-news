import { db } from '../database/db.js';
import { analyzeArticle } from './scoring.js';
import { evaluateEventForNotifications } from '../notifications/notificationEngine.js';
import { classifyClusterTopics } from './topicEngine.js';
import { broadcastStreamEvent } from '../notifications/eventStream.js';

export function tokenize(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !['the', 'and', 'for', 'that', 'this', 'with', 'from', 'have'].includes(w));
  return new Set(words);
}

export function diceCoefficient(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  return (2 * intersection) / (setA.size + setB.size);
}

export function extractEntities(text: string): Set<string> {
  const entities = new Set<string>();
  const matches = text.match(/\b(OpenAI|Anthropic|Google|DeepMind|Meta|Microsoft|NVIDIA|Hugging Face|Mistral|DeepSeek|Cursor|GPT-4o?|GPT-5|Claude|Gemini|Llama|Sora|o1|o3|Qwen)\b/gi);
  if (matches) {
    for (const m of matches) entities.add(m.toLowerCase());
  }
  return entities;
}

export function findMatchingCluster(title: string, description: string, publishedAt: string): any | null {
  const articleTokens = tokenize(`${title} ${description}`);
  const articleEntities = extractEntities(`${title} ${description}`);

  // Fetch recent clusters (last 3 days)
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const clusters = db.prepare(`
    SELECT * FROM story_clusters 
    WHERE last_updated_at >= ?
  `).all(threeDaysAgo) as any[];

  let bestMatch: any = null;
  let highestScore = 0;

  for (const cluster of clusters) {
    const clusterTokens = tokenize(`${cluster.cluster_title} ${cluster.summary}`);
    const clusterEntities = extractEntities(`${cluster.cluster_title} ${cluster.summary}`);

    const sim = diceCoefficient(articleTokens, clusterTokens);

    // Entity overlap requirement for false positive protection
    let entityOverlap = 0;
    for (const entity of articleEntities) {
      if (clusterEntities.has(entity)) entityOverlap++;
    }

    // Match threshold: >0.42 similarity or (>0.30 with shared major entity)
    if (sim > 0.42 || (sim > 0.30 && entityOverlap >= 1)) {
      if (sim > highestScore) {
        highestScore = sim;
        bestMatch = cluster;
      }
    }
  }

  return bestMatch;
}

export function processArticlesIntoClusters(newArticles: any[]) {
  if (!newArticles || newArticles.length === 0) return;

  const insertArticleStmt = db.prepare(`
    INSERT OR IGNORE INTO articles (
      source_id, title, description, url, canonical_url, author, 
      published_at, image_url, raw_content, content_hash, 
      importance_score, credibility_score, confidence_score, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertClusterStmt = db.prepare(`
    INSERT INTO story_clusters (
      cluster_title, summary, why_it_matters, key_points_json,
      importance_score, credibility_score, confidence_score, radar_score,
      status, category, breaking, primary_source_name, primary_source_url,
      first_seen_at, last_updated_at, last_update_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const linkClusterStmt = db.prepare(`
    INSERT OR IGNORE INTO cluster_articles (cluster_id, article_id) VALUES (?, ?)
  `);

  const updateClusterStmt = db.prepare(`
    UPDATE story_clusters SET
      importance_score = ?,
      credibility_score = ?,
      confidence_score = ?,
      radar_score = ?,
      status = ?,
      breaking = ?,
      primary_source_name = COALESCE(?, primary_source_name),
      primary_source_url = COALESCE(?, primary_source_url),
      last_updated_at = ?
    WHERE id = ?
  `);

  const insertEarlySignalStmt = db.prepare(`
    INSERT INTO early_signals (title, summary, source_name, source_url, signal_type, confidence, status)
    VALUES (?, ?, ?, ?, ?, ?, 'WATCHING')
  `);

  let clustersCreated = 0;
  let articlesClustered = 0;

  for (const art of newArticles) {
    try {
      // 1. Fetch source info
      const source = db.prepare('SELECT * FROM sources WHERE id = ?').get(art.source_id) as any;
      if (!source) continue;

      // 2. Perform article analysis
      const analysis = analyzeArticle(
        art.title,
        art.description,
        source.source_type,
        source.reliability_score,
        1
      );

      // 3. Save article
      const articleInfo = insertArticleStmt.run(
        art.source_id,
        art.title,
        art.description,
        art.url,
        art.canonical_url,
        art.author,
        art.published_at,
        art.image_url,
        art.raw_content,
        art.content_hash,
        analysis.importance_score,
        analysis.credibility_score,
        analysis.confidence_score,
        analysis.status
      );

      let articleId: number | null = null;
      if (articleInfo.lastInsertRowid && Number(articleInfo.lastInsertRowid) > 0) {
        articleId = Number(articleInfo.lastInsertRowid);
      } else {
        const existing = db.prepare('SELECT id FROM articles WHERE content_hash = ?').get(art.content_hash) as any;
        if (existing && existing.id) {
          articleId = Number(existing.id);
        }
      }

      if (!articleId) continue;

      // 4. Save to Early Signals if unconfirmed community/research report
      if (analysis.is_early_signal) {
        try {
          insertEarlySignalStmt.run(
            art.title,
            art.description.slice(0, 250),
            source.name,
            art.url,
            source.source_type === 'COMMUNITY' ? 'COMMUNITY' : 'PAPER',
            analysis.confidence_score < 40 ? 'Low' : 'Medium'
          );
        } catch (e) {
          // Ignore duplicate early signals
        }
      }

      // 5. Deduplicate and Cluster
      const matchingCluster = findMatchingCluster(art.title, art.description, art.published_at);

      if (matchingCluster && matchingCluster.id) {
        const clusterCheck = db.prepare('SELECT id FROM story_clusters WHERE id = ?').get(matchingCluster.id);
        if (clusterCheck) {
          try {
            linkClusterStmt.run(matchingCluster.id, articleId);
          } catch (e) {
            // Ignore link constraint warning
          }
        }

        // Count total supporting articles in cluster
        const countRes = db.prepare('SELECT COUNT(*) as count FROM cluster_articles WHERE cluster_id = ?').get(matchingCluster.id) as any;
        const totalArticles = countRes?.count || 1;

        // Re-evaluate cluster scoring with new supporting article
        const updatedAnalysis = analyzeArticle(
          matchingCluster.cluster_title,
          matchingCluster.summary,
          source.source_type === 'PRIMARY' ? 'PRIMARY' : 'CREDIBLE_NEWS',
          Math.max(matchingCluster.credibility_score, source.reliability_score),
          totalArticles
        );

        const primaryName = source.source_type === 'PRIMARY' ? source.name : null;
        const primaryUrl = source.source_type === 'PRIMARY' ? art.url : null;

        updateClusterStmt.run(
          updatedAnalysis.importance_score,
          updatedAnalysis.credibility_score,
          updatedAnalysis.confidence_score,
          updatedAnalysis.radar_score,
          updatedAnalysis.status,
          updatedAnalysis.breaking ? 1 : 0,
          primaryName,
          primaryUrl,
          new Date().toISOString(),
          matchingCluster.id
        );

        articlesClustered++;
      } else {
        // Create new story cluster
        const whyItMatters = `Significant development in ${analysis.category.toLowerCase().replace('_', ' ')} with high relevance to the AI ecosystem.`;
        const keyPoints = JSON.stringify([
          art.title,
          art.description ? art.description.slice(0, 150) + '...' : 'Reported by ' + source.name,
          `Original coverage published by ${source.name}.`
        ]);

        const primaryName = source.source_type === 'PRIMARY' ? source.name : source.name;
        const primaryUrl = art.url;

        const clusterRes = insertClusterStmt.run(
          art.title,
          art.description || art.title,
          whyItMatters,
          keyPoints,
          analysis.importance_score,
          analysis.credibility_score,
          analysis.confidence_score,
          analysis.radar_score,
          analysis.status,
          analysis.category,
          analysis.breaking ? 1 : 0,
          primaryName,
          primaryUrl,
          art.published_at,
          new Date().toISOString(),
          art.content_hash
        );

        const clusterId = clusterRes.lastInsertRowid ? Number(clusterRes.lastInsertRowid) : null;
        if (clusterId && articleId) {
          try {
            linkClusterStmt.run(clusterId, articleId);
          } catch (e) {
            // Ignore link constraint warning
          }
          // Associate topics with newly created cluster
          classifyClusterTopics(clusterId, art.title, art.description || '', art.title);

          // Evaluate event for immediate notification and alerts (PRD §3)
          evaluateEventForNotifications({
            id: clusterId,
            cluster_title: art.title,
            summary: art.description || art.title,
            category: analysis.category,
            importance_score: analysis.importance_score,
            breaking: analysis.breaking,
            primary_source_name: primaryName,
            primary_source_url: primaryUrl
          });

          // Broadcast real-time stream event to live connected clients
          broadcastStreamEvent(analysis.breaking ? 'BREAKING_NEWS' : 'NEW_CLUSTER', {
            id: clusterId,
            title: art.title,
            summary: art.description || art.title,
            category: analysis.category,
            importance_score: analysis.importance_score,
            breaking: analysis.breaking,
            source: primaryName,
            url: primaryUrl
          });
        }

        clustersCreated++;
        articlesClustered++;
      }
    } catch (err: any) {
      console.warn(`[Clustering] Warning processing article "${art.title}":`, err.message);
    }
  }

  console.log(`[Clustering] Successfully created ${clustersCreated} new story clusters from ${articlesClustered} articles.`);
}
