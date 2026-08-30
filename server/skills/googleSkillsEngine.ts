// server/skills/googleSkillsEngine.ts
import { db } from '../database/db.js';

export interface RecommendationReason {
  type: 'SKILL_MOMENTUM' | 'SKILL_GAP' | 'USER_INTEREST' | 'FRESHNESS' | 'PREREQUISITE_MATCH';
  label: string;
  score?: number;
  description: string;
}

export interface RecommendedSkillResource {
  id: number;
  skill_id: string;
  title: string;
  description: string;
  official_url: string;
  canonical_url: string;
  resource_type: string;
  difficulty: string;
  duration: string;
  provider: string;
  thumbnail_url?: string;
  published_at?: string;
  first_seen_at: string;
  last_updated_at: string;
  quality_score: number;
  industry_relevance_score: number;
  recommendation_score: number;
  recommendation_reasons: RecommendationReason[];
  mapped_skills: Array<{ id: number; name: string; slug: string; momentum: number }>;
  prerequisites: Array<{ id: number; name: string; slug: string }>;
  is_saved: boolean;
  is_opened: boolean;
  change_count: number;
  is_new_release: boolean;
}

/**
 * Retrieves the user skill profile including followed skills, levels, and gaps (PRD §32 & §34)
 */
export function getUserSkillProfile(userId: string = 'default_user') {
  const skills = db.prepare(`
    SELECT s.id, s.name, s.slug, s.category, s.momentum_score, s.trend_status,
           COALESCE(us.proficiency_level, 'BEGINNER') as proficiency_level,
           COALESCE(us.interest_level, 75) as interest_level,
           COALESCE(us.followed, 0) as followed,
           us.goal
    FROM skills s
    LEFT JOIN user_skills us ON us.skill_id = s.id AND us.user_id = ?
    ORDER BY us.followed DESC, s.momentum_score DESC
  `).all(userId) as any[];

  return {
    user_id: userId,
    skills,
    total_tracked: skills.filter((s) => s.followed).length
  };
}

/**
 * Calculates user skill gaps against high-momentum industry targets (PRD §34)
 */
export function analyzeUserSkillGaps(userId: string = 'default_user') {
  const gaps = db.prepare(`
    SELECT s.id, s.name, s.slug, s.category, s.momentum_score, s.trend_status,
           COALESCE(us.proficiency_level, 'BEGINNER') as current_level,
           (SELECT COUNT(*) FROM google_skill_mappings gsm WHERE gsm.skill_id = s.id) as available_resources_count
    FROM skills s
    LEFT JOIN user_skills us ON us.skill_id = s.id AND us.user_id = ?
    WHERE (us.proficiency_level IS NULL OR us.proficiency_level IN ('BEGINNER', 'ELEMENTARY'))
      AND s.momentum_score >= 70
    ORDER BY s.momentum_score DESC
    LIMIT 6
  `).all(userId) as any[];

  return gaps;
}

/**
 * Generates explainable, multi-factor personalized Google Skills recommendations (PRD §35, §38, §39, §40)
 * Uses high-performance batch joins to eliminate N+1 database roundtrips.
 */
export function getPersonalizedRecommendations(
  userId: string = 'default_user',
  options: { limit?: number; category?: string } = {}
): RecommendedSkillResource[] {
  const limit = options.limit || 12;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Fetch user profile and negative feedback IDs to suppress
  const userProfile = getUserSkillProfile(userId);
  const userSkillMap = new Map<number, any>();
  for (const s of userProfile.skills) {
    userSkillMap.set(s.id, s);
  }

  const rejectedResourceIds = new Set<number>();
  const negativeInteractions = db.prepare(`
    SELECT resource_id FROM user_skill_interactions 
    WHERE user_id = ? AND event_type = 'FEEDBACK_NEGATIVE'
  `).all(userId) as any[];
  for (const row of negativeInteractions) {
    rejectedResourceIds.add(row.resource_id);
  }

  // 2. Fetch all active catalog items
  const catalog = db.prepare(`
    SELECT g.*,
           (SELECT COUNT(*) FROM user_skill_bookmarks usb WHERE usb.resource_id = g.id AND usb.user_id = ?) as is_saved,
           (SELECT COUNT(*) FROM user_skill_interactions usi WHERE usi.resource_id = g.id AND usi.user_id = ? AND usi.event_type = 'OPEN') as is_opened,
           (SELECT COUNT(*) FROM google_skill_changes gsc WHERE gsc.resource_id = g.id) as change_count
    FROM google_skills_catalog g
    WHERE g.status IN ('ACTIVE', 'NEW', 'UPDATED') AND g.verification_status = 'VERIFIED'
  `).all(userId, userId) as any[];

  if (catalog.length === 0) {
    return [];
  }

  // 3. Batch fetch all mappings & prerequisites (Eliminates N+1 queries)
  const allMappings = db.prepare(`
    SELECT gsm.resource_id, s.id, s.name, s.slug, s.momentum_score as momentum
    FROM google_skill_mappings gsm
    JOIN skills s ON s.id = gsm.skill_id
  `).all() as any[];

  const mappingsByResourceId = new Map<number, Array<{ id: number; name: string; slug: string; momentum: number }>>();
  for (const m of allMappings) {
    const list = mappingsByResourceId.get(m.resource_id) || [];
    list.push({ id: m.id, name: m.name, slug: m.slug, momentum: m.momentum });
    mappingsByResourceId.set(m.resource_id, list);
  }

  const allPrereqs = db.prepare(`
    SELECT gsp.resource_id, s.id, s.name, s.slug
    FROM google_skill_prerequisites gsp
    JOIN skills s ON s.id = gsp.prerequisite_skill_id
  `).all() as any[];

  const prereqsByResourceId = new Map<number, Array<{ id: number; name: string; slug: string }>>();
  for (const p of allPrereqs) {
    const list = prereqsByResourceId.get(p.resource_id) || [];
    list.push({ id: p.id, name: p.name, slug: p.slug });
    prereqsByResourceId.set(p.resource_id, list);
  }

  const scoredResults: RecommendedSkillResource[] = [];

  for (const item of catalog) {
    if (rejectedResourceIds.has(item.id)) continue;

    const mappedSkills = mappingsByResourceId.get(item.id) || [];
    const prerequisites = prereqsByResourceId.get(item.id) || [];
    const reasons: RecommendationReason[] = [];

    // Factor 1: Skill Momentum (30% weight)
    let maxMomentum = 60;
    let topSkillName = 'AI & Cloud';
    for (const ms of mappedSkills) {
      if (ms.momentum > maxMomentum) {
        maxMomentum = ms.momentum;
        topSkillName = ms.name;
      }
    }
    const skillMomentumScore = maxMomentum;
    if (maxMomentum >= 80) {
      reasons.push({
        type: 'SKILL_MOMENTUM',
        label: `${topSkillName} Momentum`,
        score: maxMomentum,
        description: `${topSkillName} momentum is surging at ${maxMomentum}/100 in the AI Industry Radar.`
      });
    }

    // Factor 2: User Interest (20% weight)
    let userInterestScore = 50;
    let isFollowed = false;
    for (const ms of mappedSkills) {
      const userSkill = userSkillMap.get(ms.id);
      if (userSkill) {
        if (userSkill.followed) {
          isFollowed = true;
          userInterestScore = Math.max(userInterestScore, 95);
        }
        if (userSkill.interest_level) {
          userInterestScore = Math.max(userInterestScore, userSkill.interest_level);
        }
      }
    }
    if (isFollowed) {
      reasons.push({
        type: 'USER_INTEREST',
        label: 'Followed Skill',
        score: userInterestScore,
        description: `You are actively tracking ${topSkillName} in your personalized radar.`
      });
    }

    // Factor 3: Skill Gap Match (20% weight)
    let skillGapScore = 40;
    for (const ms of mappedSkills) {
      const userSkill = userSkillMap.get(ms.id);
      if (userSkill && (userSkill.proficiency_level === 'BEGINNER' || userSkill.proficiency_level === 'ELEMENTARY')) {
        skillGapScore = 90;
        reasons.push({
          type: 'SKILL_GAP',
          label: 'Fills Skill Gap',
          score: 90,
          description: `Directly bridges your target competency in ${ms.name}.`
        });
        break;
      }
    }

    // Factor 4: Prerequisite Fit (15% weight)
    let prerequisiteScore = 85;
    let prerequisitesMet = true;
    for (const p of prerequisites) {
      const userSkill = userSkillMap.get(p.id);
      if (!userSkill || userSkill.proficiency_level === 'BEGINNER') {
        prerequisitesMet = false;
        prerequisiteScore = 60;
        break;
      }
    }
    if (prerequisites.length > 0 && prerequisitesMet) {
      reasons.push({
        type: 'PREREQUISITE_MATCH',
        label: 'Prerequisites Met',
        score: 95,
        description: 'You have completed the foundational requirements for this advanced track.'
      });
    }

    // Factor 5: Freshness & Quality (15% weight)
    let freshnessScore = 60;
    const isNewRelease = Boolean(item.first_seen_at && item.first_seen_at >= sevenDaysAgo);
    if (isNewRelease) {
      freshnessScore = 100;
      reasons.push({
        type: 'FRESHNESS',
        label: 'New Release',
        score: 100,
        description: 'Recently published or updated in the official Google Skills catalog.'
      });
    }

    // Master Recommendation Formula (PRD §35)
    // Rec Score = 0.30 * Momentum + 0.20 * Interest + 0.20 * Gap + 0.15 * Prereq + 0.15 * Freshness
    const recommendationScore = Math.min(
      100,
      Math.round(
        0.30 * skillMomentumScore +
        0.20 * userInterestScore +
        0.20 * skillGapScore +
        0.15 * prerequisiteScore +
        0.15 * freshnessScore
      )
    );

    scoredResults.push({
      id: item.id,
      skill_id: item.skill_id,
      title: item.title,
      description: item.description || '',
      official_url: item.official_url,
      canonical_url: item.canonical_url || item.official_url,
      resource_type: item.resource_type || 'COURSE',
      difficulty: item.difficulty || 'Beginner',
      duration: item.duration || '2 hours',
      provider: item.provider || 'Google Skills',
      thumbnail_url: item.thumbnail_url || undefined,
      published_at: item.published_at || undefined,
      first_seen_at: item.first_seen_at,
      last_updated_at: item.last_updated_at,
      quality_score: item.quality_score || 95,
      industry_relevance_score: item.industry_relevance_score || 85,
      recommendation_score: recommendationScore,
      recommendation_reasons: reasons,
      mapped_skills: mappedSkills,
      prerequisites,
      is_saved: Boolean(item.is_saved),
      is_opened: Boolean(item.is_opened),
      change_count: item.change_count || 0,
      is_new_release: isNewRelease
    });
  }

  // Sort descending by recommendation score
  scoredResults.sort((a, b) => b.recommendation_score - a.recommendation_score);

  return scoredResults.slice(0, limit);
}
