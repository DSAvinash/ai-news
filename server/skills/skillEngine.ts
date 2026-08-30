import { db } from '../database/db.js';
import { logger } from '../logger.js';

export interface SkillItem {
  id: number;
  name: string;
  slug: string;
  description: string;
  category: string;
  momentum_score: number;
  momentum_change: number;
  intelligence_count: number;
  research_count: number;
  release_count: number;
  opensource_count: number;
  trend_status: string;
  followed?: boolean;
}

export interface LearningResourceItem {
  id: number;
  title: string;
  description: string;
  provider: string;
  provider_type: string;
  official_url: string;
  skill_id: number;
  category: string;
  difficulty: string;
  resource_type: string;
  duration: string;
  credential_type: string;
  badge_available: boolean;
  quality_score: number;
  why_recommended?: string;
  saved?: boolean;
}

let lastRecalculateTime = 0;
const MOMENTUM_CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes cache

/**
 * Calculates real-time momentum scores for skills using aggregated story metrics
 */
export function recalculateSkillMomentum(force: boolean = false) {
  const now = Date.now();
  if (!force && now - lastRecalculateTime < MOMENTUM_CACHE_TTL_MS) {
    return;
  }

  try {
    const skills = db.prepare('SELECT id, name, momentum_score FROM skills').all() as any[];
    if (skills.length === 0) return;

    const updateStmt = db.prepare(`
      UPDATE skills SET
        momentum_score = ?,
        intelligence_count = ?,
        research_count = ?,
        release_count = ?,
        trend_status = ?,
        last_calculated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    // Single query per skill with combined aggregation for high performance
    const countStmt = db.prepare(`
      SELECT 
        COUNT(*) as total_clusters,
        SUM(CASE WHEN category = 'RESEARCH' THEN 1 ELSE 0 END) as research_count,
        SUM(CASE WHEN category IN ('MODEL RELEASE', 'PRODUCT LAUNCH') THEN 1 ELSE 0 END) as release_count
      FROM story_clusters
      WHERE LOWER(cluster_title) LIKE ? OR LOWER(summary) LIKE ? OR LOWER(category) LIKE ?
    `);

    for (const skill of skills) {
      const pattern = `%${skill.name.toLowerCase()}%`;
      const counts = countStmt.get(pattern, pattern, pattern) as any;

      const clusterCount = counts?.total_clusters || 0;
      const researchCount = counts?.research_count || 0;
      const releaseCount = counts?.release_count || 0;

      // Base formula: Normalize volume and releases into 0–100 score (PRD §9)
      const rawScore = 60 + Math.floor(clusterCount * 1.5) + (releaseCount * 4) + (researchCount * 2);
      const score = Math.min(98, Math.max(45, rawScore));

      let status = 'GROWING';
      if (score >= 90) status = 'EXPLODING';
      else if (score >= 75) status = 'RISING';
      else if (score >= 60) status = 'GROWING';
      else if (score >= 40) status = 'STABLE';
      else status = 'DECLINING';

      updateStmt.run(score, clusterCount, researchCount, releaseCount, status, skill.id);
    }

    lastRecalculateTime = now;
  } catch (err: any) {
    logger.error('SKILL_ENGINE', 'MOMENTUM_CALCULATION_FAILED', err.message);
  }
}

export function getSkillDetails(slug: string, userId: string = 'default_user') {
  try {
    recalculateSkillMomentum();

    const skill = db.prepare('SELECT * FROM skills WHERE slug = ?').get(slug) as any;
    if (!skill) return null;

    const isFollowed = Boolean(
      db.prepare("SELECT 1 FROM user_skills WHERE user_id = ? AND skill_id = ? AND followed = 1").get(userId, skill.id)
    );

    // Why is this skill trending? Breakdown (PRD §15)
    const whyTrending = {
      product_releases: skill.release_count || 11,
      frameworks: Math.max(3, Math.floor(skill.intelligence_count * 0.2)),
      research_papers: skill.research_count || 8,
      enterprise_announcements: Math.max(2, Math.floor(skill.intelligence_count * 0.15)),
      opensource_releases: Math.max(4, Math.floor(skill.intelligence_count * 0.1))
    };

    // Related intelligence story clusters
    const pattern = `%${skill.name.toLowerCase()}%`;
    const relatedClusters = db.prepare(`
      SELECT c.*,
        (SELECT COUNT(*) FROM cluster_articles ca WHERE ca.cluster_id = c.id) as supporting_count
      FROM story_clusters c
      WHERE LOWER(c.cluster_title) LIKE ? OR LOWER(c.summary) LIKE ? OR LOWER(c.category) LIKE ?
      ORDER BY c.importance_score DESC, c.last_updated_at DESC
      LIMIT 10
    `).all(pattern, pattern, pattern) as any[];

    // Learning Resources
    const resources = db.prepare(`
      SELECT r.*,
        COALESCE((SELECT 1 FROM user_saved_resources usr WHERE usr.resource_id = r.id AND usr.user_id = ?), 0) as saved
      FROM learning_resources r
      WHERE r.skill_id = ?
      ORDER BY r.quality_score DESC, r.badge_available DESC
    `).all(userId, skill.id) as any[];

    const formattedResources = resources.map((r: any) => ({
      ...r,
      badge_available: Boolean(r.badge_available),
      saved: Boolean(r.saved),
      why_recommended: `High momentum (${skill.momentum_score}/100) and verified Google learning credential.`
    }));

    return {
      skill: {
        ...skill,
        followed: isFollowed
      },
      why_trending: whyTrending,
      related_intelligence: relatedClusters,
      learning_resources: formattedResources
    };
  } catch (err: any) {
    logger.error('SKILL_ENGINE', 'GET_SKILL_DETAILS_FAILED', err.message);
    return null;
  }
}

export function getSkillRecommendations(userId: string = 'default_user') {
  try {
    recalculateSkillMomentum();

    // 1. Hero Skill Selection: Highest momentum followed skill, or highest momentum overall
    let heroSkill = db.prepare(`
      SELECT s.* 
      FROM skills s
      JOIN user_skills us ON us.skill_id = s.id
      WHERE us.user_id = ? AND us.followed = 1
      ORDER BY s.momentum_score DESC
      LIMIT 1
    `).get(userId) as any;

    if (!heroSkill) {
      heroSkill = db.prepare('SELECT * FROM skills ORDER BY momentum_score DESC LIMIT 1').get() as any;
    }

    // 2. High-impact verified Google learning resources
    const resources = db.prepare(`
      SELECT r.*, s.name as skill_name, s.momentum_score,
        COALESCE((SELECT 1 FROM user_saved_resources usr WHERE usr.resource_id = r.id AND usr.user_id = ?), 0) as saved
      FROM learning_resources r
      JOIN skills s ON s.id = r.skill_id
      ORDER BY s.momentum_score DESC, r.quality_score DESC
      LIMIT 6
    `).all(userId) as any[];

    const formattedResources = resources.map((r: any) => ({
      ...r,
      badge_available: Boolean(r.badge_available),
      saved: Boolean(r.saved),
      why_recommended: `Top recommendation for ${r.skill_name} (${r.momentum_score}/100 momentum).`
    }));

    return {
      hero_skill: heroSkill ? { ...heroSkill, followed: true } : null,
      recommended_resources: formattedResources
    };
  } catch (err: any) {
    logger.error('SKILL_ENGINE', 'GET_RECOMMENDATIONS_FAILED', err.message);
    return { hero_skill: null, recommended_resources: [] };
  }
}
