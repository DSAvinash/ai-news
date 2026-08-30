// server/routes/googleSkills.ts
import { Router } from 'express';
import { db } from '../database/db.js';
import { runGoogleCatalogSync } from '../integrations/google/discovery.js';
import {
  getPersonalizedRecommendations,
  getUserSkillProfile,
  analyzeUserSkillGaps
} from '../skills/googleSkillsEngine.js';

const router = Router();

// GET /api/v1/google-skills — Search, multi-facet filter, and catalog list (PRD §41, §42, §43, §56)
router.get('/', (req, res) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) || '24', 10), 100);
    const offset = parseInt((req.query.offset as string) || '0', 10);
    const userId = (req.query.user_id as string) || 'default_user';
    const filter = (req.query.filter as string) || 'all'; // all, new, updated, trending, saved, unexplored
    const search = ((req.query.search as string) || '').trim().toLowerCase();
    const difficulty = (req.query.difficulty as string) || '';
    const resourceType = (req.query.resource_type as string) || '';
    const skillId = req.query.skill_id ? parseInt(req.query.skill_id as string, 10) : null;

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    let query = `
      SELECT 
        g.*,
        (SELECT COUNT(*) FROM user_skill_bookmarks usb WHERE usb.resource_id = g.id AND usb.user_id = ?) as is_saved,
        (SELECT COUNT(*) FROM user_skill_interactions usi WHERE usi.resource_id = g.id AND usi.user_id = ? AND usi.event_type = 'OPEN') as is_opened,
        (SELECT COUNT(*) FROM google_skill_changes gsc WHERE gsc.resource_id = g.id) as change_count,
        CASE WHEN g.published_at >= ? OR (g.published_at IS NULL AND g.first_seen_at >= ?) THEN 1 ELSE 0 END AS is_new,
        CASE WHEN g.status = 'UPDATED' OR (SELECT COUNT(*) FROM google_skill_changes gsc2 WHERE gsc2.resource_id = g.id) > 0 THEN 1 ELSE 0 END AS is_updated
      FROM google_skills_catalog g
      WHERE g.status IN ('ACTIVE', 'NEW', 'UPDATED') AND g.verification_status = 'VERIFIED'
    `;
    const params: any[] = [userId, userId, sevenDaysAgo, sevenDaysAgo];

    if (search) {
      query += ` AND (LOWER(g.title) LIKE ? OR LOWER(g.description) LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    if (difficulty && difficulty !== 'All') {
      query += ` AND g.difficulty = ?`;
      params.push(difficulty);
    }

    if (resourceType && resourceType !== 'All') {
      query += ` AND g.resource_type = ?`;
      params.push(resourceType);
    }

    if (skillId) {
      query += ` AND EXISTS (SELECT 1 FROM google_skill_mappings gsm WHERE gsm.resource_id = g.id AND gsm.skill_id = ?)`;
      params.push(skillId);
    }

    if (filter === 'new') {
      query += ` AND (g.published_at >= ? OR (g.published_at IS NULL AND g.first_seen_at >= ?))`;
      params.push(sevenDaysAgo, sevenDaysAgo);
    } else if (filter === 'updated') {
      query += ` AND (g.status = 'UPDATED' OR (SELECT COUNT(*) FROM google_skill_changes gsc3 WHERE gsc3.resource_id = g.id) > 0)`;
    } else if (filter === 'trending') {
      query += ` AND g.industry_relevance_score >= 80`;
    } else if (filter === 'saved') {
      query += ` AND EXISTS (SELECT 1 FROM user_skill_bookmarks usb2 WHERE usb2.resource_id = g.id AND usb2.user_id = ?)`;
      params.push(userId);
    } else if (filter === 'unexplored') {
      query += ` AND NOT EXISTS (SELECT 1 FROM user_skill_interactions usi2 WHERE usi2.resource_id = g.id AND usi2.user_id = ? AND usi2.event_type = 'OPEN')`;
      params.push(userId);
    }

    query += ` ORDER BY is_new DESC, is_updated DESC, g.industry_relevance_score DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const skills = db.prepare(query).all(...params) as any[];

    // Fetch mapped skills for each item
    const formattedSkills = skills.map((s) => {
      const mappedSkills = db.prepare(`
        SELECT sk.id, sk.name, sk.slug, sk.momentum_score as momentum
        FROM google_skill_mappings gsm
        JOIN skills sk ON sk.id = gsm.skill_id
        WHERE gsm.resource_id = ?
      `).all(s.id) as any[];

      return {
        ...s,
        viewed: Boolean(s.is_opened),
        saved: Boolean(s.is_saved),
        is_new: Boolean(s.is_new),
        is_updated: Boolean(s.is_updated),
        is_trending: Boolean(s.industry_relevance_score >= 85),
        mapped_skills: mappedSkills
      };
    });

    const totalCount = (db.prepare('SELECT COUNT(*) as c FROM google_skills_catalog WHERE status IN (\'ACTIVE\', \'NEW\', \'UPDATED\') AND verification_status = \'VERIFIED\'').get() as any)?.c || 0;

    res.json({
      success: true,
      data: {
        skills: formattedSkills,
        total: totalCount,
        limit,
        offset
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/google-skills/recommended — Personalized Recommendations (PRD §35, §36, §57)
router.get('/recommended', (req, res) => {
  try {
    const userId = (req.query.user_id as string) || 'default_user';
    const recommendations = getPersonalizedRecommendations(userId, { limit: 12 });
    const gaps = analyzeUserSkillGaps(userId);

    res.json({
      success: true,
      data: {
        recommended: recommendations,
        skill_gaps: gaps
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/google-skills/stats — Dashboard health and statistics (PRD §74)
router.get('/stats', (req, res) => {
  try {
    const userId = (req.query.user_id as string) || 'default_user';
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const total = (db.prepare('SELECT COUNT(*) as c FROM google_skills_catalog WHERE status IN (\'ACTIVE\', \'NEW\', \'UPDATED\')').get() as any)?.c || 0;
    const verified = (db.prepare('SELECT COUNT(*) as c FROM google_skills_catalog WHERE verification_status = \'VERIFIED\'').get() as any)?.c || 0;
    const newCount = (db.prepare('SELECT COUNT(*) as c FROM google_skills_catalog WHERE published_at >= ? OR first_seen_at >= ?').get(sevenDaysAgo, sevenDaysAgo) as any)?.c || 0;
    const updatedCount = (db.prepare('SELECT COUNT(*) as c FROM google_skills_catalog WHERE status = \'UPDATED\'').get() as any)?.c || 0;
    const viewedCount = (db.prepare('SELECT COUNT(DISTINCT resource_id) as c FROM user_skill_interactions WHERE user_id = ? AND event_type = \'OPEN\'').get(userId) as any)?.c || 0;
    const savedCount = (db.prepare('SELECT COUNT(*) as c FROM user_skill_bookmarks WHERE user_id = ?').get(userId) as any)?.c || 0;
    const lastSync = db.prepare('SELECT started_at, completed_at, status FROM catalog_sync_runs ORDER BY started_at DESC LIMIT 1').get() as any;

    res.json({
      success: true,
      data: {
        total_skills: total,
        verified_skills: verified,
        new_skills: newCount,
        updated_skills: updatedCount,
        viewed_skills: viewedCount,
        saved_skills: savedCount,
        unexplored_skills: Math.max(0, total - viewedCount),
        last_sync: lastSync || null
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/google-skills/:id — Deep dive with version history & diffs (PRD §23, §28, §45)
router.get('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const userId = (req.query.user_id as string) || 'default_user';

    const skill = db.prepare(`
      SELECT g.*,
             (SELECT COUNT(*) FROM user_skill_bookmarks usb WHERE usb.resource_id = g.id AND usb.user_id = ?) as is_saved,
             (SELECT COUNT(*) FROM user_skill_interactions usi WHERE usi.resource_id = g.id AND usi.user_id = ? AND usi.event_type = 'OPEN') as is_opened
      FROM google_skills_catalog g
      WHERE g.id = ?
    `).get(userId, userId, id) as any;

    if (!skill) return res.status(404).json({ success: false, error: 'Skill not found in catalog' });

    // Fetch mapped skills
    const mappedSkills = db.prepare(`
      SELECT sk.id, sk.name, sk.slug, sk.category, sk.momentum_score as momentum, sk.trend_status
      FROM google_skill_mappings gsm
      JOIN skills sk ON sk.id = gsm.skill_id
      WHERE gsm.resource_id = ?
    `).all(id) as any[];

    // Fetch prerequisites
    const prerequisites = db.prepare(`
      SELECT sk.id, sk.name, sk.slug
      FROM google_skill_prerequisites gsp
      JOIN skills sk ON sk.id = gsp.prerequisite_skill_id
      WHERE gsp.resource_id = ?
    `).all(id) as any[];

    // Fetch change history diffs ("What Changed?") (PRD §22 & §23)
    const changes = db.prepare(`
      SELECT change_type, old_value, new_value, detected_at
      FROM google_skill_changes
      WHERE resource_id = ?
      ORDER BY detected_at DESC
      LIMIT 10
    `).all(id) as any[];

    // Fetch version snapshots
    const versions = db.prepare(`
      SELECT version_number, change_summary, detected_at
      FROM google_skill_versions
      WHERE resource_id = ?
      ORDER BY version_number DESC
    `).all(id) as any[];

    // Fetch related AI story clusters based on mapped skill keywords
    let relatedClusters: any[] = [];
    if (mappedSkills.length > 0) {
      const topSkill = mappedSkills[0];
      relatedClusters = db.prepare(`
        SELECT id, cluster_title, summary, importance_score, radar_score, category, first_seen_at
        FROM story_clusters
        WHERE (cluster_title LIKE ? OR summary LIKE ?)
        ORDER BY importance_score DESC, last_updated_at DESC
        LIMIT 3
      `).all(`%${topSkill.name}%`, `%${topSkill.name}%`) as any[];
    }

    res.json({
      success: true,
      data: {
        ...skill,
        viewed: Boolean(skill.is_opened),
        saved: Boolean(skill.is_saved),
        mapped_skills: mappedSkills,
        prerequisites,
        changes,
        versions,
        related_clusters: relatedClusters
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/google-skills/:id/open — Secure Open Flow (PRD §60 & §67)
router.post('/:id/open', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const userId = (req.body.user_id as string) || 'default_user';

    const skill = db.prepare('SELECT id, official_url, canonical_url, status, verification_status FROM google_skills_catalog WHERE id = ?').get(id) as any;
    if (!skill) return res.status(404).json({ success: false, error: 'Resource not found' });

    // Record verified OPEN interaction
    db.prepare(`
      INSERT INTO user_skill_interactions (user_id, resource_id, event_type)
      VALUES (?, ?, 'OPEN')
    `).run(userId, id);

    // Return authoritative verified URL
    res.json({
      success: true,
      verified_url: skill.official_url || skill.canonical_url,
      resource_id: skill.id
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/google-skills/:id/bookmark — Toggle Save / Bookmark (PRD §51 & §58)
router.post('/:id/bookmark', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const userId = (req.body.user_id as string) || 'default_user';

    const existing = db.prepare('SELECT id FROM user_skill_bookmarks WHERE user_id = ? AND resource_id = ?').get(userId, id);
    if (existing) {
      db.prepare('DELETE FROM user_skill_bookmarks WHERE user_id = ? AND resource_id = ?').run(userId, id);
      db.prepare('INSERT INTO user_skill_interactions (user_id, resource_id, event_type) VALUES (?, ?, \'UNSAVE\')').run(userId, id);
      return res.json({ success: true, saved: false, message: 'Bookmark removed' });
    } else {
      db.prepare('INSERT INTO user_skill_bookmarks (user_id, resource_id) VALUES (?, ?)').run(userId, id);
      db.prepare('INSERT INTO user_skill_interactions (user_id, resource_id, event_type) VALUES (?, ?, \'SAVE\')').run(userId, id);
      return res.json({ success: true, saved: true, message: 'Resource saved to bookmarks' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/google-skills/:id/feedback — Capture Recommendation Feedback (PRD §42 & §52)
router.post('/:id/feedback', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const userId = (req.body.user_id as string) || 'default_user';
    const isHelpful = Boolean(req.body.helpful);

    const eventType = isHelpful ? 'FEEDBACK_POSITIVE' : 'FEEDBACK_NEGATIVE';
    db.prepare(`
      INSERT INTO user_skill_interactions (user_id, resource_id, event_type, metadata_json)
      VALUES (?, ?, ?, ?)
    `).run(userId, id, eventType, JSON.stringify({ feedback: isHelpful ? 'HELPFUL' : 'NOT_RELEVANT' }));

    res.json({ success: true, message: 'Feedback recorded to optimize future recommendations' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/users/me/gap-analysis — Multi-axial Gap Radar Assessment
router.get('/users/me/gap-analysis', (req, res) => {
  try {
    const userId = (req.query.user_id as string) || 'default_user';
    const profile = getUserSkillProfile(userId);
    
    // Map proficiency levels to 0-100 numerical scale
    const PROFICIENCY_SCORES: Record<string, number> = {
      BEGINNER: 25,
      ELEMENTARY: 35,
      INTERMEDIATE: 65,
      ADVANCED: 95,
      EXPERT: 100
    };

    const radarAxes = profile.skills.map((s) => {
      const userLevel = (s.proficiency_level || 'BEGINNER').toUpperCase();
      const userScore = PROFICIENCY_SCORES[userLevel] || 25;
      const industryScore = s.momentum_score || 70;
      const gapDelta = Math.max(0, industryScore - userScore);

      return {
        id: s.id,
        name: s.name,
        slug: s.slug,
        category: s.category,
        user_proficiency: userLevel,
        user_score: userScore,
        industry_momentum: industryScore,
        gap_delta: gapDelta,
        trend_status: s.trend_status || 'RISING',
        is_priority_gap: gapDelta >= 20
      };
    });

    // Priority gap skills
    const priorityGaps = radarAxes
      .filter((a) => a.is_priority_gap)
      .sort((a, b) => b.gap_delta - a.gap_delta);

    // Targeted Google Skills to close gaps
    const targetedCourses = getPersonalizedRecommendations(userId, { limit: 6 });

    res.json({
      success: true,
      data: {
        radar_axes: radarAxes,
        priority_gaps: priorityGaps,
        total_gaps_count: priorityGaps.length,
        average_user_readiness: Math.round(
          radarAxes.reduce((acc, a) => acc + a.user_score, 0) / (radarAxes.length || 1)
        ),
        average_industry_momentum: Math.round(
          radarAxes.reduce((acc, a) => acc + a.industry_momentum, 0) / (radarAxes.length || 1)
        ),
        targeted_courses: targetedCourses
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/users/me/skill-profile — User Skill Profile (PRD §32 & §58)
router.get('/users/me/skill-profile', (req, res) => {
  try {
    const userId = (req.query.user_id as string) || 'default_user';
    const profile = getUserSkillProfile(userId);
    res.json({ success: true, data: profile });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/v1/users/me/skill-profile — Update User Proficiency (PRD §32 & §58)
router.put('/users/me/skill-profile', (req, res) => {
  try {
    const userId = (req.body.user_id as string) || 'default_user';
    const { skill_id, proficiency_level, interest_level, followed, goal } = req.body || {};

    db.prepare(`
      INSERT INTO user_skills (user_id, skill_id, proficiency_level, interest_level, followed, goal, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, skill_id) DO UPDATE SET
        proficiency_level = COALESCE(excluded.proficiency_level, user_skills.proficiency_level),
        interest_level = COALESCE(excluded.interest_level, user_skills.interest_level),
        followed = COALESCE(excluded.followed, user_skills.followed),
        goal = COALESCE(excluded.goal, user_skills.goal),
        updated_at = CURRENT_TIMESTAMP
    `).run(
      userId,
      skill_id,
      proficiency_level || 'BEGINNER',
      interest_level || 80,
      followed !== undefined ? (followed ? 1 : 0) : 1,
      goal || null
    );

    res.json({ success: true, message: 'User skill profile updated' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/admin/google-skills/sync — Manual Catalog Sync Trigger (PRD §49 & §59)
router.post('/admin/sync', async (req, res) => {
  try {
    const result = await runGoogleCatalogSync();
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/admin/google-skills/sync-history — Audit Logs (PRD §50 & §63)
router.get('/admin/sync-history', (req, res) => {
  try {
    const history = db.prepare(`
      SELECT * FROM catalog_sync_runs
      ORDER BY started_at DESC
      LIMIT 15
    `).all() as any[];

    res.json({ success: true, data: history });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export const googleSkillsRouter = router;
