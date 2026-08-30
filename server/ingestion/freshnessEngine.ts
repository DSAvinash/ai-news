import { db } from '../database/db.js';

export interface BriefingCandidate {
  id: number;
  cluster_title: string;
  summary: string;
  category: string;
  primary_source_name: string;
  primary_source_url: string;
  importance_score: number;
  credibility_score: number;
  confidence_score: number;
  radar_score: number;
  status: string;
  breaking: boolean;
  first_seen_at: string;
  last_updated_at: string;
  repetition_penalty: number;
  novelty_score: number;
  daily_priority_score: number;
  previous_delivery_count: number;
  is_updated_since_last_sent: boolean;
}

export function getLastSuccessfulBriefingTime(): string {
  const lastBriefing = db.prepare(`
    SELECT sent_at FROM email_briefings 
    WHERE status IN ('SENT', 'QUIET_MORNING')
    ORDER BY sent_at DESC 
    LIMIT 1
  `).get() as any;

  if (lastBriefing && lastBriefing.sent_at) {
    return lastBriefing.sent_at;
  }

  // Fallback: 24 hours ago
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

export function calculateRepetitionPenalty(clusterId: number, lastSentTime: string): { penalty: number; deliveryCount: number; isUpdated: boolean } {
  // Count how many times this cluster was previously included in a successful briefing
  const deliveryCount = (db.prepare(`
    SELECT COUNT(*) as c FROM email_briefing_items ebi
    JOIN email_briefings eb ON ebi.briefing_id = eb.id
    WHERE ebi.cluster_id = ? AND eb.status IN ('SENT', 'QUIET_MORNING')
  `).get(clusterId) as any).c || 0;

  // Check if cluster had a material update after the last briefing sent time
  const cluster = db.prepare('SELECT last_updated_at, status FROM story_clusters WHERE id = ?').get(clusterId) as any;
  const isUpdated = Boolean(cluster && cluster.last_updated_at > lastSentTime && cluster.status === 'UPDATED');

  if (deliveryCount === 0) {
    return { penalty: 0, deliveryCount: 0, isUpdated: false };
  }

  if (isUpdated) {
    // Material update reduces repetition penalty significantly
    return { penalty: 15, deliveryCount, isUpdated: true };
  }

  // Cooldown / Repetition Penalties
  let penalty = 60;
  if (deliveryCount === 2) penalty = 85;
  if (deliveryCount >= 3) penalty = 100;

  return { penalty, deliveryCount, isUpdated: false };
}

export function getBriefingCandidates(): {
  candidates: BriefingCandidate[];
  lastBriefingTime: string;
  isQuietMorning: boolean;
  scannedCount: number;
} {
  const lastBriefingTime = getLastSuccessfulBriefingTime();

  // Fetch story clusters updated or created since last successful briefing (or top candidates if gap)
  const candidateClusters = db.prepare(`
    SELECT * FROM story_clusters
    WHERE last_updated_at >= ?
    ORDER BY importance_score DESC, radar_score DESC
    LIMIT 50
  `).all(lastBriefingTime) as any[];

  let scannedCount = candidateClusters.length;

  // If few candidates in exact window, expand window slightly while applying repetition penalties
  let clustersToEvaluate = candidateClusters;
  if (clustersToEvaluate.length < 5) {
    clustersToEvaluate = db.prepare(`
      SELECT * FROM story_clusters
      ORDER BY last_updated_at DESC, importance_score DESC
      LIMIT 40
    `).all() as any[];
    scannedCount = clustersToEvaluate.length;
  }

  const scoredCandidates: BriefingCandidate[] = [];

  for (const c of clustersToEvaluate) {
    const { penalty, deliveryCount, isUpdated } = calculateRepetitionPenalty(c.id, lastBriefingTime);

    // Calculate Novelty Score (0-100)
    let novelty = 90;
    if (c.category === 'MODEL RELEASE' || c.category === 'RESEARCH') novelty = 100;
    if (c.breaking) novelty = 100;
    if (deliveryCount > 0 && !isUpdated) novelty = 20;

    // Calculate Freshness Score (0-100) based on hours since last update
    const diffHours = Math.max(0, (Date.now() - new Date(c.last_updated_at).getTime()) / (1000 * 60 * 60));
    const freshness = Math.max(10, Math.round(100 - (diffHours * 3)));

    // Calculate Daily Priority Score
    const rawScore = (c.importance_score * 0.4) + (novelty * 0.3) + (freshness * 0.3);
    const dailyPriorityScore = Math.max(0, Math.round(rawScore - penalty));

    // Selection Threshold: Must have priority score >= 35 and not exceed repetition penalty limit
    if (dailyPriorityScore >= 35 && penalty < 100) {
      scoredCandidates.push({
        ...c,
        breaking: Boolean(c.breaking),
        repetition_penalty: penalty,
        novelty_score: novelty,
        daily_priority_score: dailyPriorityScore,
        previous_delivery_count: deliveryCount,
        is_updated_since_last_sent: isUpdated
      });
    }
  }

  // Sort by Daily Priority Score
  scoredCandidates.sort((a, b) => b.daily_priority_score - a.daily_priority_score);

  // Take top 5 to 10 stories
  const selected = scoredCandidates.slice(0, 10);
  const isQuietMorning = selected.length === 0;

  return {
    candidates: selected,
    lastBriefingTime,
    isQuietMorning,
    scannedCount
  };
}

export function getNewsPipelineStats() {
  const articlesCount = (db.prepare('SELECT COUNT(*) as c FROM articles').get() as any).c;
  const clustersCount = (db.prepare('SELECT COUNT(*) as c FROM story_clusters').get() as any).c;
  const earlyCount = (db.prepare('SELECT COUNT(*) as c FROM early_signals').get() as any).c;
  const deliveredCount = (db.prepare('SELECT COUNT(DISTINCT cluster_id) as c FROM email_briefing_items').get() as any).c;
  const lastBriefing = db.prepare('SELECT * FROM email_briefings ORDER BY generated_at DESC LIMIT 1').get() as any;

  return {
    articles_scanned: articlesCount,
    events_clustered: clustersCount,
    early_signals_count: earlyCount,
    delivered_events_count: deliveredCount,
    last_briefing: lastBriefing || null
  };
}
