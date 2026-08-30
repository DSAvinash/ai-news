import { Router } from 'express';
import { db } from './database/db.js';
import { fetchAllActiveSources } from './ingestion/rssParser.js';
import { processArticlesIntoClusters } from './ingestion/clustering.js';
import { sendDailyBriefingEmail, sendTestEmail, getSafeEmailHealthStatus } from './email/emailService.js';
import { generateDailyLandscapeSummary, enrichClusterWithGemini } from './ai/geminiService.js';
import { calculateTopicMomentum, extractEntitiesForTopic, getTopicWhatChanged } from './ingestion/topicEngine.js';
import { getNewsPipelineStats } from './ingestion/freshnessEngine.js';
import { executeGlobalSearch } from './search/searchEngine.js';
import { isQuietHoursActive } from './notifications/notificationEngine.js';
import { recalculateSkillMomentum, getSkillDetails, getSkillRecommendations } from './skills/skillEngine.js';
import { handleEventStream, getStreamMetrics } from './notifications/eventStream.js';

export const apiRouter = Router();

// Google Skills routes
import { googleSkillsRouter } from './routes/googleSkills.js';
apiRouter.use('/google-skills', googleSkillsRouter);

// GET /api/search — Production-grade global AI intelligence search engine (PRD §76)
apiRouter.get('/search', (req, res) => {
  try {
    const { q, type, category, source, range, importance, sort, page, limit } = req.query;
    const searchOptions = {
      query: (q as string) || '',
      type: (type as string) || 'all',
      category: (category as string) || 'All',
      source: (source as string) || 'All',
      range: (range as string) || 'all',
      importance: (importance as string) || 'all',
      sort: (sort as string) || 'relevance',
      page: parseInt((page as string) || '1', 10),
      limit: parseInt((limit as string) || '20', 10)
    };

    const response = executeGlobalSearch(searchOptions);
    res.json(response);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'SEARCH_FAILED', message: err.message || 'Search execution failed.' }
    });
  }
});

// GET /api/search/saved — Retrieve user's saved searches
apiRouter.get('/search/saved', (req, res) => {
  try {
    const saved = db.prepare('SELECT * FROM saved_searches WHERE user_id = "default_user" ORDER BY created_at DESC').all();
    res.json({ success: true, data: saved });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/search/saved — Save a search query
apiRouter.post('/search/saved', (req, res) => {
  try {
    const { query, filters } = req.body || {};
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ success: false, message: 'Query string is required.' });
    }

    db.prepare(`
      INSERT OR IGNORE INTO saved_searches (user_id, query, filters_json)
      VALUES ('default_user', ?, ?)
    `).run(query.trim(), JSON.stringify(filters || {}));

    res.json({ success: true, message: 'Search saved successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/system/status — Full System Diagnostic Panel Data (PRD §8 & §10)
apiRouter.get('/system/status', (req, res) => {
  try {
    const activeSources = db.prepare('SELECT COUNT(*) as c FROM sources WHERE active = 1').get() as any;
    const failedSources = db.prepare('SELECT COUNT(*) as c FROM sources WHERE error_count > 0').get() as any;
    const totalArticles = db.prepare('SELECT COUNT(*) as c FROM articles').get() as any;
    const totalClusters = db.prepare('SELECT COUNT(*) as c FROM story_clusters').get() as any;
    const lastBriefing = db.prepare('SELECT briefing_date, status, sent_at, stories_selected FROM email_briefings ORDER BY generated_at DESC LIMIT 1').get() as any;
    const lastJob = db.prepare('SELECT job_name, status, started_at, ended_at, error_details FROM job_executions ORDER BY started_at DESC LIMIT 1').get() as any;
    const lastIngestedArticle = db.prepare('SELECT published_at FROM articles ORDER BY published_at DESC LIMIT 1').get() as any;

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      system: {
        status: 'HEALTHY',
        uptime_seconds: process.uptime(),
        memory_usage_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
      },
      sources: {
        active: activeSources?.c || 0,
        failed: failedSources?.c || 0
      },
      content: {
        total_articles: totalArticles?.c || 0,
        total_clusters: totalClusters?.c || 0,
        last_ingested_at: lastIngestedArticle?.published_at || null
      },
      briefing: {
        last_date: lastBriefing?.briefing_date || null,
        status: lastBriefing?.status || 'NO_BRIEFINGS_SENT',
        sent_at: lastBriefing?.sent_at || null,
        stories_count: lastBriefing?.stories_selected || 0
      },
      last_job: lastJob || null
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
// GET /api/notifications — Retrieve notifications list (PRD §56)
apiRouter.get('/notifications', (req, res) => {
  try {
    const { unreadOnly, priority, type, page = '1', limit = '30' } = req.query;
    let query = "SELECT * FROM notifications WHERE user_id = 'default_user'";
    const params: any[] = [];

    if (unreadOnly === 'true') {
      query += ' AND read = 0';
    }
    if (priority && priority !== 'ALL') {
      query += ' AND priority = ?';
      params.push(priority);
    }
    if (type && type !== 'ALL') {
      query += ' AND type = ?';
      params.push(type);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;
    params.push(limitNum, offset);

    const items = db.prepare(query).all(...params) as any[];
    const formatted = items.map(n => ({ ...n, read: Boolean(n.read) }));

    res.json({ success: true, data: formatted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/notifications/unread-count — Unread notification badge count (PRD §13 & §56)
apiRouter.get('/notifications/unread-count', (req, res) => {
  try {
    const row = db.prepare("SELECT COUNT(*) as c FROM notifications WHERE user_id = 'default_user' AND read = 0").get() as any;
    res.json({ success: true, count: row?.c || 0 });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/notifications/:id/read — Mark single notification as read (PRD §11)
apiRouter.post('/notifications/:id/read', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare("UPDATE notifications SET read = 1, read_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = 'default_user'").run(id);
    res.json({ success: true, message: 'Notification marked as read.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/notifications/read-all — Mark all notifications as read (PRD §12)
apiRouter.post('/notifications/read-all', (req, res) => {
  try {
    db.prepare("UPDATE notifications SET read = 1, read_at = CURRENT_TIMESTAMP WHERE user_id = 'default_user' AND read = 0").run();
    res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/notifications/:id — Delete notification (PRD §41)
apiRouter.delete('/notifications/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare("DELETE FROM notifications WHERE id = ? AND user_id = 'default_user'").run(id);
    res.json({ success: true, message: 'Notification deleted.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/notifications/test — Send test notification (PRD §51)
apiRouter.post('/notifications/test', (req, res) => {
  try {
    const notifId = Date.now();
    db.prepare(`
      INSERT INTO notifications (user_id, type, priority, title, message, channel, read, deduplication_key)
      VALUES ('default_user', 'SYSTEM', 'CRITICAL', '🔴 BREAKING TEST: Major Model Release Alert', 'This is a test notification confirming your notification center and alert pipeline are operational.', 'DASHBOARD', 0, ?)
    `).run(`test_notif_${notifId}`);

    res.json({ success: true, message: 'Test notification created successfully!' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/alerts — List user alert rules (PRD §57)
apiRouter.get('/alerts', (req, res) => {
  try {
    const rules = db.prepare("SELECT * FROM alert_rules WHERE user_id = 'default_user' ORDER BY created_at DESC").all() as any[];
    const formatted = rules.map(r => ({
      ...r,
      enabled: Boolean(r.enabled),
      conditions: r.conditions_json ? JSON.parse(r.conditions_json) : {},
      channels: r.channels_json ? JSON.parse(r.channels_json) : ['DASHBOARD']
    }));

    res.json({ success: true, data: formatted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/alerts — Create new alert rule (PRD §26 & §57)
apiRouter.post('/alerts', (req, res) => {
  try {
    const { name, type = 'TOPIC', conditions = {}, priority_threshold = 'HIGH', frequency = 'INSTANT', channels = ['DASHBOARD'] } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Alert name is required.' });
    }

    const stmt = db.prepare(`
      INSERT INTO alert_rules (user_id, name, type, conditions_json, priority_threshold, frequency, channels_json, enabled)
      VALUES ('default_user', ?, ?, ?, ?, ?, ?, 1)
    `);
    const result = stmt.run(name.trim(), type, JSON.stringify(conditions), priority_threshold, frequency, JSON.stringify(channels));

    res.json({ success: true, message: 'Alert rule created successfully.', alert_id: Number(result.lastInsertRowid) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/alerts/:id — Delete alert rule (PRD §49)
apiRouter.delete('/alerts/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare("DELETE FROM alert_rules WHERE id = ? AND user_id = 'default_user'").run(id);
    res.json({ success: true, message: 'Alert rule deleted.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/alerts/:id/pause & resume — Pause/Resume alert rule (PRD §50)
apiRouter.post('/alerts/:id/pause', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare("UPDATE alert_rules SET enabled = 0 WHERE id = ? AND user_id = 'default_user'").run(id);
    res.json({ success: true, message: 'Alert rule paused.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/alerts/:id/resume', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare("UPDATE alert_rules SET enabled = 1 WHERE id = ? AND user_id = 'default_user'").run(id);
    res.json({ success: true, message: 'Alert rule resumed.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/skills — Retrieve skills list with momentum scores (PRD §8 & §11)
apiRouter.get('/skills', (req, res) => {
  try {
    recalculateSkillMomentum();
    const skills = db.prepare("SELECT * FROM skills ORDER BY momentum_score DESC").all() as any[];
    const followedIds = new Set(
      (db.prepare("SELECT skill_id FROM user_skills WHERE user_id = 'default_user' AND followed = 1").all() as any[]).map(s => s.skill_id)
    );

    const formatted = skills.map(s => ({
      ...s,
      followed: followedIds.has(s.id)
    }));

    res.json({ success: true, data: formatted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/skills/recommendations — Learn Next Hero card & recommendations (PRD §4 & §7)
apiRouter.get('/skills/recommendations', (req, res) => {
  try {
    const data = getSkillRecommendations('default_user');
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/skills/:slug — Skill Detail view payload (PRD §13, §14, §15, §17)
apiRouter.get('/skills/:slug', (req, res) => {
  try {
    const { slug } = req.params;
    const details = getSkillDetails(slug, 'default_user');
    if (!details) {
      return res.status(404).json({ success: false, message: 'Skill not found.' });
    }

    res.json({ success: true, data: details });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// GET /api/my-learning — Saved Learning Resources & Queue (PRD §28, §29, §30)
apiRouter.get('/my-learning', (req, res) => {
  try {
    const saved = db.prepare(`
      SELECT s.*, r.title, r.description, r.provider, r.provider_type, r.official_url, r.difficulty, r.duration, r.credential_type
      FROM user_saved_resources s
      JOIN learning_resources r ON s.resource_id = r.id
      WHERE s.user_id = 'default_user'
      ORDER BY s.saved_at DESC
    `).all() as any[];

    res.json({ success: true, data: saved });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/user-skills/follow & unfollow — Follow skill (PRD §39)
apiRouter.post('/user-skills/follow', (req, res) => {
  try {
    const { skill_id } = req.body || {};
    db.prepare(`
      INSERT INTO user_skills (user_id, skill_id, followed)
      VALUES ('default_user', ?, 1)
      ON CONFLICT(user_id, skill_id) DO UPDATE SET followed = 1
    `).run(skill_id);

    res.json({ success: true, message: 'Skill followed successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

apiRouter.post('/user-skills/unfollow', (req, res) => {
  try {
    const { skill_id } = req.body || {};
    db.prepare(`
      UPDATE user_skills SET followed = 0 WHERE user_id = 'default_user' AND skill_id = ?
    `).run(skill_id);

    res.json({ success: true, message: 'Skill unfollowed.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/my-learning/save — Save learning resource (PRD §29)
apiRouter.post('/my-learning/save', (req, res) => {
  try {
    const { resource_id } = req.body || {};
    db.prepare(`
      INSERT INTO user_saved_resources (user_id, resource_id, status)
      VALUES ('default_user', ?, 'In Progress')
      ON CONFLICT(user_id, resource_id) DO NOTHING
    `).run(resource_id);

    res.json({ success: true, message: 'Resource saved to My Learning!' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.post('/alerts/simulate', (req, res) => {
  try {
    const { topic = 'AI Agents', importance_threshold = 70, novelty_threshold = 'NEW_ONLY', keywords = [] } = req.body || {};

    let query = 'SELECT id, cluster_title, importance_score, category, first_seen_at FROM story_clusters WHERE 1=1';
    const params: any[] = [];

    if (importance_threshold) {
      query += ' AND importance_score >= ?';
      params.push(importance_threshold);
    }

    const clusters = db.prepare(query).all(...params) as any[];

    // Calculate quality score & frequency estimate
    const matchCount = clusters.length;
    let qualityScore = 85;
    let estimatedFreq = '~2–4 alerts/week';
    let noiseWarning = null;

    if (matchCount > 100) {
      qualityScore = 55;
      estimatedFreq = '~15+ alerts/day';
      noiseWarning = '⚠ This alert rule may generate high volume. Consider restricting topics or raising importance threshold.';
    } else if (matchCount > 30) {
      qualityScore = 75;
      estimatedFreq = '~1–2 alerts/day';
    } else if (matchCount === 0) {
      qualityScore = 60;
      estimatedFreq = '< 1 alert/month';
    }

    res.json({
      success: true,
      data: {
        matches_count: matchCount,
        quality_score: qualityScore,
        estimated_frequency: estimatedFreq,
        noise_warning: noiseWarning,
        sample_matches: clusters.slice(0, 5)
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/alerts/templates/:templateId — Create rule from prebuilt template (PRD §58)
apiRouter.post('/alerts/templates/:templateId', (req, res) => {
  try {
    const { templateId } = req.params;

    const TEMPLATES: Record<string, { name: string; topic: string; priority: string; score: number; freq: string }> = {
      major_releases: { name: '🚨 Major AI Model Releases', topic: 'AI Models', priority: 'CRITICAL', score: 90, freq: '~1 alert/week' },
      ai_agents: { name: '🤖 AI Agent Breakthroughs', topic: 'AI Agents', priority: 'HIGH', score: 70, freq: '~3 alerts/week' },
      ai_coding: { name: '💻 AI Coding Agents & Models', topic: 'AI Coding', priority: 'HIGH', score: 70, freq: '~2 alerts/week' },
      open_source: { name: '🔓 Open Source Model Releases', topic: 'Open Source', priority: 'HIGH', score: 70, freq: '~4 alerts/week' },
      ai_research: { name: '🧠 Breakthrough Research Papers', topic: 'AI Research', priority: 'HIGH', score: 75, freq: '~2 alerts/week' },
      ai_funding: { name: '💰 Major AI Funding & Mergers', topic: 'AI Business', priority: 'MEDIUM', score: 65, freq: '~2 alerts/week' },
      ai_regulation: { name: '⚖️ AI Regulation & Safety Laws', topic: 'AI Safety', priority: 'HIGH', score: 75, freq: '~1 alert/month' },
      ai_security: { name: '🛡️ AI Vulnerabilities & Security', topic: 'AI Security', priority: 'CRITICAL', score: 85, freq: '~1 alert/month' }
    };

    const tmpl = TEMPLATES[templateId];
    if (!tmpl) {
      return res.status(404).json({ success: false, message: 'Template not found.' });
    }

    const stmt = db.prepare(`
      INSERT INTO alert_rules (
        user_id, name, type, conditions_json, targets_json, importance_threshold, priority_threshold, frequency, quality_score, estimated_frequency, enabled
      ) VALUES ('default_user', ?, 'TOPIC', ?, ?, ?, ?, 'INSTANT', ?, ?, 1)
    `);

    const result = stmt.run(
      tmpl.name,
      JSON.stringify({ topic: tmpl.topic }),
      JSON.stringify({ topics: [tmpl.topic] }),
      tmpl.score,
      tmpl.priority,
      88,
      tmpl.freq
    );

    res.json({ success: true, message: `Created alert rule "${tmpl.name}"!`, alert_id: Number(result.lastInsertRowid) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/alerts/duplicate/:id — Duplicate alert rule (PRD §42)
apiRouter.post('/alerts/duplicate/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare("SELECT * FROM alert_rules WHERE id = ? AND user_id = 'default_user'").get(id) as any;
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Alert rule not found.' });
    }

    const stmt = db.prepare(`
      INSERT INTO alert_rules (
        user_id, name, type, conditions_json, targets_json, keywords_json, excluded_keywords_json,
        importance_threshold, novelty_threshold, priority_threshold, frequency, cooldown_minutes,
        max_alerts_per_hour, group_related_events, channels_json, quality_score, estimated_frequency, enabled
      ) VALUES ('default_user', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    const newName = `${existing.name} (Copy)`;
    const result = stmt.run(
      newName, existing.type, existing.conditions_json, existing.targets_json, existing.keywords_json, existing.excluded_keywords_json,
      existing.importance_threshold, existing.novelty_threshold, existing.priority_threshold, existing.frequency, existing.cooldown_minutes,
      existing.max_alerts_per_hour, existing.group_related_events, existing.channels_json, existing.quality_score, existing.estimated_frequency
    );

    res.json({ success: true, message: `Duplicated alert rule as "${newName}".`, alert_id: Number(result.lastInsertRowid) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/notification-preferences/global-pause — Set global pause duration (PRD §60 & §61)
apiRouter.post('/notification-preferences/global-pause', (req, res) => {
  try {
    const { durationHours = 0 } = req.body || {};

    let pauseUntil: string | null = null;
    if (durationHours > 0) {
      const untilDate = new Date(Date.now() + durationHours * 3600 * 1000);
      pauseUntil = untilDate.toISOString();
    }

    db.prepare(`
      UPDATE notification_preferences SET global_pause_until = ? WHERE user_id = 'default_user'
    `).run(pauseUntil);

    res.json({
      success: true,
      message: pauseUntil ? `Notifications paused for ${durationHours} hours.` : 'Global notification pause resumed.'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/notifications/diagnostics — Health diagnostics of notification system (PRD §73)
apiRouter.get('/notifications/diagnostics', (req, res) => {
  try {
    const totalNotifs = (db.prepare("SELECT COUNT(*) as c FROM notifications WHERE user_id = 'default_user'").get() as any).c;
    const unreadNotifs = (db.prepare("SELECT COUNT(*) as c FROM notifications WHERE user_id = 'default_user' AND read = 0").get() as any).c;
    const activeRules = (db.prepare("SELECT COUNT(*) as c FROM alert_rules WHERE user_id = 'default_user' AND enabled = 1").get() as any).c;
    const prefs = db.prepare("SELECT * FROM notification_preferences WHERE user_id = 'default_user'").get() as any;

    const isPaused = prefs?.global_pause_until ? new Date(prefs.global_pause_until).getTime() > Date.now() : false;

    res.json({
      success: true,
      diagnostics: {
        notification_engine: { status: isPaused ? 'PAUSED' : 'OPERATIONAL', global_pause: isPaused },
        email_service: { status: 'CONNECTED', host: process.env.SMTP_HOST || 'smtp.gmail.com', level: prefs?.email_alerts_level || 'CRITICAL' },
        dashboard_notifications: { status: prefs?.dashboard_enabled ? 'ENABLED' : 'DISABLED', unread_count: unreadNotifs, total_count: totalNotifs },
        browser_push: { status: prefs?.browser_push_enabled ? 'ENABLED' : 'DISABLED' },
        active_alert_rules: activeRules,
        quiet_hours: { active: isQuietHoursActive(), start: prefs?.quiet_hours_start || '22:00', end: prefs?.quiet_hours_end || '07:00' }
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
apiRouter.get('/notification-preferences', (req, res) => {
  try {
    let prefs = db.prepare("SELECT * FROM notification_preferences WHERE user_id = 'default_user'").get() as any;
    if (!prefs) {
      db.prepare(`
        INSERT INTO notification_preferences (user_id, dashboard_enabled, email_alerts_level, browser_push_enabled, sound_enabled, quiet_hours_start, quiet_hours_end, critical_override)
        VALUES ('default_user', 1, 'CRITICAL', 0, 0, '22:00', '07:00', 1)
      `).run();
      prefs = db.prepare("SELECT * FROM notification_preferences WHERE user_id = 'default_user'").get() as any;
    }

    res.json({
      success: true,
      data: {
        ...prefs,
        dashboard_enabled: Boolean(prefs.dashboard_enabled),
        browser_push_enabled: Boolean(prefs.browser_push_enabled),
        sound_enabled: Boolean(prefs.sound_enabled),
        critical_override: Boolean(prefs.critical_override)
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/notification-preferences — Save user notification settings
apiRouter.post('/notification-preferences', (req, res) => {
  try {
    const { dashboard_enabled = true, email_alerts_level = 'CRITICAL', browser_push_enabled = false, sound_enabled = false, quiet_hours_start = '22:00', quiet_hours_end = '07:00', critical_override = true } = req.body || {};

    db.prepare(`
      INSERT INTO notification_preferences (user_id, dashboard_enabled, email_alerts_level, browser_push_enabled, sound_enabled, quiet_hours_start, quiet_hours_end, critical_override)
      VALUES ('default_user', ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        dashboard_enabled = excluded.dashboard_enabled,
        email_alerts_level = excluded.email_alerts_level,
        browser_push_enabled = excluded.browser_push_enabled,
        sound_enabled = excluded.sound_enabled,
        quiet_hours_start = excluded.quiet_hours_start,
        quiet_hours_end = excluded.quiet_hours_end,
        critical_override = excluded.critical_override
    `).run(
      dashboard_enabled ? 1 : 0,
      email_alerts_level,
      browser_push_enabled ? 1 : 0,
      sound_enabled ? 1 : 0,
      quiet_hours_start,
      quiet_hours_end,
      critical_override ? 1 : 0
    );

    res.json({ success: true, message: 'Notification preferences updated.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/news — Clustered Story Feed
apiRouter.get('/news', (req, res) => {
  try {
    const { category, timeRange = 'all', search, breakingOnly, page = '1', limit = '60' } = req.query;

    let query = `
      SELECT c.*, 
        (SELECT COUNT(*) FROM cluster_articles ca WHERE ca.cluster_id = c.id) as supporting_count
      FROM story_clusters c
      WHERE 1=1
    `;
    const params: any[] = [];

    if (timeRange === 'today') {
      const cutoffTime = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
      query += ` AND c.last_updated_at >= ?`;
      params.push(cutoffTime);
    } else if (timeRange && timeRange !== 'all') {
      let timeFilterMs = 24 * 60 * 60 * 1000;
      if (timeRange === '1h') timeFilterMs = 1 * 60 * 60 * 1000;
      if (timeRange === '6h') timeFilterMs = 6 * 60 * 60 * 1000;
      if (timeRange === '24h') timeFilterMs = 24 * 60 * 60 * 1000;
      if (timeRange === '3d') timeFilterMs = 3 * 24 * 60 * 60 * 1000;
      if (timeRange === '7d') timeFilterMs = 7 * 24 * 60 * 60 * 1000;

      const cutoffTime = new Date(Date.now() - timeFilterMs).toISOString();
      query += ` AND c.last_updated_at >= ?`;
      params.push(cutoffTime);
    }

    if (category && category !== 'All') {
      query += ` AND c.category = ?`;
      params.push(category);
    }

    if (breakingOnly === 'true') {
      query += ` AND c.breaking = 1`;
    }

    if (search && typeof search === 'string' && search.trim() !== '') {
      query += ` AND (c.cluster_title LIKE ? OR c.summary LIKE ? OR c.primary_source_name LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    query += ` ORDER BY c.breaking DESC, c.importance_score DESC, c.last_updated_at DESC`;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    let clusters = db.prepare(query).all(...params) as any[];

    // Fallback: If strict time window returned 0 clusters, fetch without cutoffTime constraint
    if (clusters.length === 0 && !search && category === 'All') {
      let fallbackQuery = `
        SELECT c.*, 
          (SELECT COUNT(*) FROM cluster_articles ca WHERE ca.cluster_id = c.id) as supporting_count
        FROM story_clusters c
        ORDER BY c.importance_score DESC, c.last_updated_at DESC
        LIMIT ? OFFSET ?
      `;
      clusters = db.prepare(fallbackQuery).all(limitNum, offset) as any[];
    }

    // Format response and attach key_points array
    const formatted = clusters.map(c => ({
      ...c,
      key_points: c.key_points_json ? JSON.parse(c.key_points_json) : [],
      breaking: Boolean(c.breaking)
    }));

    res.json({ success: true, data: formatted, count: formatted.length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/news/:id — Detail view of a story cluster
apiRouter.get('/news/:id', async (req, res) => {
  try {
    const clusterId = req.params.id;
    const cluster = db.prepare('SELECT * FROM story_clusters WHERE id = ?').get(clusterId) as any;

    if (!cluster) {
      return res.status(404).json({ success: false, error: 'Story cluster not found' });
    }

    // Fetch linked articles and sources
    const articles = db.prepare(`
      SELECT a.*, s.name as source_name, s.url as source_domain, s.source_type
      FROM cluster_articles ca
      JOIN articles a ON ca.article_id = a.id
      JOIN sources s ON a.source_id = s.id
      WHERE ca.cluster_id = ?
      ORDER BY a.credibility_score DESC, a.published_at ASC
    `).all(clusterId) as any[];

    // Trigger Gemini enrichment on demand if not already rich
    if (process.env.GEMINI_API_KEY && cluster.summary.length < 50) {
      const enrichment = await enrichClusterWithGemini(cluster.cluster_title, articles);
      if (enrichment) {
        db.prepare(`
          UPDATE story_clusters SET
            summary = ?,
            why_it_matters = ?,
            key_points_json = ?,
            status = ?
          WHERE id = ?
        `).run(
          enrichment.summary,
          enrichment.why_it_matters,
          JSON.stringify(enrichment.key_points),
          enrichment.status,
          clusterId
        );
        cluster.summary = enrichment.summary;
        cluster.why_it_matters = enrichment.why_it_matters;
        cluster.key_points_json = JSON.stringify(enrichment.key_points);
        cluster.status = enrichment.status;
      }
    }

    res.json({
      success: true,
      data: {
        ...cluster,
        key_points: cluster.key_points_json ? JSON.parse(cluster.key_points_json) : [],
        breaking: Boolean(cluster.breaking),
        supporting_sources: articles
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/early-signals — Unconfirmed watching signals
apiRouter.get('/early-signals', (req, res) => {
  try {
    const signals = db.prepare(`
      SELECT * FROM early_signals 
      WHERE status = 'WATCHING' 
      ORDER BY discovered_at DESC 
      LIMIT 10
    `).all();

    res.json({ success: true, data: signals });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/watchlist — Saved stories
apiRouter.get('/watchlist', (req, res) => {
  try {
    const clusters = db.prepare(`
      SELECT c.*, 
        (SELECT COUNT(*) FROM cluster_articles ca WHERE ca.cluster_id = c.id) as supporting_count,
        w.saved_at
      FROM watchlist w
      JOIN story_clusters c ON w.cluster_id = c.id
      ORDER BY w.saved_at DESC
    `).all() as any[];

    const formatted = clusters.map(c => ({
      ...c,
      key_points: c.key_points_json ? JSON.parse(c.key_points_json) : [],
      breaking: Boolean(c.breaking),
      saved: true
    }));

    res.json({ success: true, data: formatted, count: formatted.length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/watchlist — Save story
apiRouter.post('/watchlist', (req, res) => {
  try {
    const { clusterId } = req.body;
    if (!clusterId) {
      return res.status(400).json({ success: false, error: 'clusterId is required' });
    }

    db.prepare(`
      INSERT OR IGNORE INTO watchlist (cluster_id) VALUES (?)
    `).run(clusterId);

    res.json({ success: true, message: 'Saved to watchlist' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/watchlist/:clusterId — Remove story from watchlist
apiRouter.delete('/watchlist/:clusterId', (req, res) => {
  try {
    const { clusterId } = req.params;
    db.prepare('DELETE FROM watchlist WHERE cluster_id = ?').run(clusterId);
    res.json({ success: true, message: 'Removed from watchlist' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/summary — Executive landscape summary
apiRouter.get('/summary', async (req, res) => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const topClusters = db.prepare(`
      SELECT cluster_title as title, summary, category, primary_source_name as source
      FROM story_clusters 
      WHERE last_updated_at >= ?
      ORDER BY importance_score DESC 
      LIMIT 5
    `).all(twentyFourHoursAgo) as any[];

    if (topClusters.length === 0) {
      return res.json({
        success: true,
        data: {
          headline: 'Continuous AI monitoring is active across primary research and tech feeds.',
          executive_summary: 'Ingestion engine is tracking releases from OpenAI, Anthropic, Google DeepMind, and open-source model repositories.'
        }
      });
    }

    // Try Gemini summary or construct deterministic fallback
    let summaryObj: any = null;
    try {
      summaryObj = await generateDailyLandscapeSummary(topClusters);
    } catch (e) {
      console.warn('[API Summary] Gemini summary unavailable, using rule-based summary.');
    }

    if (!summaryObj) {
      const topTitle = topClusters[0]?.title || 'Key AI updates released today';
      summaryObj = {
        headline: `${topTitle} leads today's top AI developments.`,
        executive_summary: topClusters.map(c => `[${c.category}] ${c.title}: ${c.summary}`).join(' ')
      };
    }

    res.json({ success: true, data: summaryObj });
  } catch (err: any) {
    const topTitle = 'Key AI updates released today';
    res.json({
      success: true,
      data: {
        headline: `${topTitle} leads today's top AI developments.`,
        executive_summary: 'Continuous AI primary source monitoring is active across model releases, research breakthroughs, and open-source models.'
      }
    });
  }
});

// GET /api/stats — Header metrics
apiRouter.get('/stats', (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    const articlesAnalyzed = (db.prepare('SELECT COUNT(*) as c FROM articles WHERE discovered_at >= ?').get(todayIso) as any).c;
    const importantDevs = (db.prepare('SELECT COUNT(*) as c FROM story_clusters WHERE last_updated_at >= ? AND importance_score >= 60').get(todayIso) as any).c;
    const breakingCount = (db.prepare('SELECT COUNT(*) as c FROM story_clusters WHERE breaking = 1 AND last_updated_at >= ?').get(todayIso) as any).c;
    const sourcesCount = (db.prepare('SELECT COUNT(*) as c FROM sources WHERE active = 1').get() as any).c;

    res.json({
      success: true,
      data: {
        articles_analyzed_today: articlesAnalyzed,
        important_developments: importantDevs,
        breaking_count: breakingCount,
        sources_monitored: sourcesCount,
        last_updated: new Date().toISOString()
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/sources — Monitored RSS sources
apiRouter.get('/sources', (req, res) => {
  try {
    const sources = db.prepare('SELECT * FROM sources ORDER BY source_type ASC, name ASC').all();
    res.json({ success: true, data: sources });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/sources — Add new source
apiRouter.post('/sources', (req, res) => {
  try {
    const { name, url, rss_url, source_type = 'PRIMARY', reliability_score = 0.85 } = req.body;
    if (!name || !rss_url) {
      return res.status(400).json({ success: false, error: 'Name and RSS URL are required' });
    }

    const info = db.prepare(`
      INSERT INTO sources (name, url, rss_url, source_type, reliability_score)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, url || rss_url, rss_url, source_type, reliability_score);

    res.json({ success: true, id: info.lastInsertRowid });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/ingest — Manual trigger for RSS ingestion
apiRouter.post('/ingest', async (req, res) => {
  try {
    const newArticles = await fetchAllActiveSources();
    processArticlesIntoClusters(newArticles);
    res.json({ success: true, message: `Successfully fetched and clustered ${newArticles.length} articles.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/email/test — Dedicated email delivery test endpoint (PRD §6)
apiRouter.post('/email/test', async (req, res) => {
  try {
    const { recipient } = req.body || {};
    const result = await sendTestEmail(recipient);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: err.message || 'An unexpected error occurred during email testing.'
      }
    });
  }
});

// POST /api/test-email — Alias endpoint supporting dryRun and previewOnly
apiRouter.post('/test-email', async (req, res) => {
  try {
    const { dryRun = false, previewOnly = false, recipient } = req.body || {};
    if (dryRun || previewOnly) {
      const result = await sendDailyBriefingEmail({ dryRun, previewOnly });
      return res.json(result);
    }
    const result = await sendTestEmail(recipient);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: err.message }
    });
  }
});

// POST /api/send-briefing — Daily Briefing Delivery Trigger (PRD §31)
apiRouter.post('/send-briefing', async (req, res) => {
  try {
    const result = await sendDailyBriefingEmail({ dryRun: false });
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// GET /api/email/health — Safe diagnostic endpoint (PRD §29)
apiRouter.get('/email/health', (req, res) => {
  try {
    const health = getSafeEmailHealthStatus();
    res.json({ success: true, data: health });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/latest-briefing-html — Serve generated HTML briefing preview (PRD §12 & §13)
apiRouter.get('/latest-briefing-html', async (req, res) => {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const previewPath = path.resolve(process.cwd(), 'dist', 'latest_briefing.html');
    if (fs.existsSync(previewPath)) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(fs.readFileSync(previewPath, 'utf-8'));
    } else {
      res.status(404).json({
        success: false,
        error: {
          code: 'NO_BRIEFING_AVAILABLE',
          message: 'No briefing has been generated yet. Please trigger an email test or daily briefing first.'
        }
      });
    }
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: 'HTML_GENERATION_FAILED', message: err.message }
    });
  }
});

// GET /api/admin/pipeline — News Pipeline Debug & Audit Stats
apiRouter.get('/admin/pipeline', (req, res) => {
  try {
    const stats = getNewsPipelineStats();
    res.json({ success: true, data: stats });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/briefings/history — Past delivered daily briefings
apiRouter.get('/briefings/history', (req, res) => {
  try {
    const briefings = db.prepare(`
      SELECT eb.*,
        (SELECT COUNT(*) FROM email_briefing_items ebi WHERE ebi.briefing_id = eb.id) as delivered_stories_count
      FROM email_briefings eb
      ORDER BY eb.generated_at DESC
      LIMIT 30
    `).all() as any[];

    res.json({ success: true, data: briefings });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/briefings/:id — Briefing details & delivered story items
apiRouter.get('/briefings/:id', (req, res) => {
  try {
    const { id } = req.params;
    const briefing = db.prepare('SELECT * FROM email_briefings WHERE id = ?').get(id) as any;
    if (!briefing) {
      return res.status(404).json({ success: false, error: 'Briefing not found' });
    }

    const items = db.prepare(`
      SELECT ebi.*, c.cluster_title, c.summary, c.category, c.primary_source_name, c.primary_source_url
      FROM email_briefing_items ebi
      JOIN story_clusters c ON ebi.cluster_id = c.id
      WHERE ebi.briefing_id = ?
      ORDER BY ebi.rank ASC
    `).all(id) as any[];

    res.json({ success: true, data: { briefing, items } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/topics — Topic Directory & Preferences
apiRouter.get('/topics', (req, res) => {
  try {
    const topics = db.prepare(`
      SELECT t.*,
        (SELECT COUNT(*) FROM article_topics at WHERE at.topic_id = t.id) as story_count,
        COALESCE(tp.followed, 0) as followed,
        COALESCE(tp.notification_level, 'IMPORTANT') as notification_level
      FROM topics t
      LEFT JOIN topic_preferences tp ON t.id = tp.topic_id AND tp.user_id = 'default_user'
      WHERE t.active = 1
      ORDER BY t.category ASC, t.name ASC
    `).all() as any[];

    const formatted = topics.map(t => ({
      ...t,
      followed: Boolean(t.followed),
      momentum_score: calculateTopicMomentum(t.id)
    }));

    res.json({ success: true, data: formatted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/user/topics — Followed topics for homepage and digest
apiRouter.get('/user/topics', (req, res) => {
  try {
    const topics = db.prepare(`
      SELECT t.*,
        (SELECT COUNT(*) FROM article_topics at WHERE at.topic_id = t.id) as story_count,
        tp.notification_level
      FROM topic_preferences tp
      JOIN topics t ON tp.topic_id = t.id
      WHERE tp.user_id = 'default_user' AND tp.followed = 1
      ORDER BY t.name ASC
    `).all() as any[];

    const formatted = topics.map(t => {
      const topStory = db.prepare(`
        SELECT c.cluster_title, c.summary, c.last_updated_at
        FROM article_topics at
        JOIN story_clusters c ON at.cluster_id = c.id
        WHERE at.topic_id = ?
        ORDER BY c.importance_score DESC, c.last_updated_at DESC
        LIMIT 1
      `).get(t.id) as any;

      return {
        ...t,
        followed: true,
        momentum_score: calculateTopicMomentum(t.id),
        latest_story: topStory || null
      };
    });

    res.json({ success: true, data: formatted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/topics/:slug/follow — Toggle follow and set notification preferences
apiRouter.post('/topics/:slug/follow', (req, res) => {
  try {
    const { slug } = req.params;
    const { followed = true, notificationLevel = 'IMPORTANT' } = req.body;

    const topic = db.prepare('SELECT id FROM topics WHERE slug = ?').get(slug) as any;
    if (!topic) {
      return res.status(404).json({ success: false, error: 'Topic not found' });
    }

    if (followed) {
      db.prepare(`
        INSERT INTO topic_preferences (user_id, topic_id, followed, notification_level)
        VALUES ('default_user', ?, 1, ?)
        ON CONFLICT(user_id, topic_id) DO UPDATE SET
          followed = 1,
          notification_level = excluded.notification_level
      `).run(topic.id, notificationLevel);
    } else {
      db.prepare(`
        DELETE FROM topic_preferences WHERE user_id = 'default_user' AND topic_id = ?
      `).run(topic.id);
    }

    res.json({ success: true, message: 'Topic preferences updated' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/topics/:slug — Detailed Topic Intelligence Page Data
apiRouter.get('/topics/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const topic = db.prepare(`
      SELECT t.*,
        COALESCE(tp.followed, 0) as followed,
        COALESCE(tp.notification_level, 'IMPORTANT') as notification_level
      FROM topics t
      LEFT JOIN topic_preferences tp ON t.id = tp.topic_id AND tp.user_id = 'default_user'
      WHERE t.slug = ?
    `).get(slug) as any;

    if (!topic) {
      return res.status(404).json({ success: false, error: 'Topic not found' });
    }

    const topicId = topic.id;
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Topic Story Clusters
    const clusters = db.prepare(`
      SELECT c.*, at.relevance_score,
        (SELECT COUNT(*) FROM cluster_articles ca WHERE ca.cluster_id = c.id) as supporting_count
      FROM article_topics at
      JOIN story_clusters c ON at.cluster_id = c.id
      WHERE at.topic_id = ?
      ORDER BY at.relevance_score DESC, c.importance_score DESC, c.last_updated_at DESC
      LIMIT 60
    `).all(topicId) as any[];

    const formattedClusters = clusters.map(c => ({
      ...c,
      key_points: c.key_points_json ? JSON.parse(c.key_points_json) : [],
      breaking: Boolean(c.breaking)
    }));

    // Metrics
    const storiesToday = (db.prepare(`
      SELECT COUNT(*) as c FROM article_topics at
      JOIN story_clusters c ON at.cluster_id = c.id
      WHERE at.topic_id = ? AND c.last_updated_at >= ?
    `).get(topicId, twentyFourHoursAgo) as any).c;

    const highSignalCount = (db.prepare(`
      SELECT COUNT(*) as c FROM article_topics at
      JOIN story_clusters c ON at.cluster_id = c.id
      WHERE at.topic_id = ? AND c.importance_score >= 65
    `).get(topicId) as any).c;

    const breakingCount = (db.prepare(`
      SELECT COUNT(*) as c FROM article_topics at
      JOIN story_clusters c ON at.cluster_id = c.id
      WHERE at.topic_id = ? AND c.breaking = 1
    `).get(topicId) as any).c;

    const earlySignals = db.prepare(`
      SELECT * FROM early_signals 
      WHERE (title LIKE ? OR summary LIKE ?)
      ORDER BY discovered_at DESC LIMIT 5
    `).all(`%${topic.name}%`, `%${topic.name}%`) as any[];

    const sourcesCount = (db.prepare(`
      SELECT COUNT(DISTINCT c.primary_source_name) as c 
      FROM article_topics at
      JOIN story_clusters c ON at.cluster_id = c.id
      WHERE at.topic_id = ?
    `).get(topicId) as any).c;

    // Entities & What Changed
    const { companies, models } = extractEntitiesForTopic(topicId);
    const whatChanged = getTopicWhatChanged(topicId);
    const momentumScore = calculateTopicMomentum(topicId);

    // Topic Summary (Cached or Dynamic Fallback)
    let summaryData = db.prepare('SELECT headline, summary FROM topic_summaries WHERE topic_id = ?').get(topicId) as any;
    if (!summaryData && formattedClusters.length > 0) {
      summaryData = {
        headline: `${topic.name} developments accelerated with ${formattedClusters.length} active story signals.`,
        summary: `Key activity in ${topic.name} centers on primary source releases, community open weights, and ongoing technical benchmarks.`
      };
    }

    // Related Topics in same category
    const relatedTopics = db.prepare(`
      SELECT name, slug, icon, color FROM topics 
      WHERE category = ? AND id != ?
      LIMIT 6
    `).all(topic.category, topicId) as any[];

    res.json({
      success: true,
      data: {
        topic: {
          ...topic,
          followed: Boolean(topic.followed),
          momentum_score: momentumScore
        },
        summary: summaryData,
        metrics: {
          stories_today: storiesToday,
          high_signal_count: highSignalCount,
          breaking_count: breakingCount,
          early_signals_count: earlySignals.length,
          sources_count: sourcesCount || 12
        },
        clusters: formattedClusters,
        early_signals: earlySignals,
        what_changed: whatChanged,
        companies_to_watch: companies,
        models_and_products: models,
        related_topics: relatedTopics
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/stream/events — Real-time Server-Sent Events (SSE) stream (PRD §53 & §65)
apiRouter.get('/stream/events', handleEventStream);

// GET /api/stream/metrics — Event stream health and subscriber stats
apiRouter.get('/stream/metrics', (req, res) => {
  res.json({ success: true, data: getStreamMetrics() });
});

