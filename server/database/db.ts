import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const dbPath = process.env.DATABASE_PATH || './radar.db';
const absoluteDbPath = path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath);

// Ensure directory exists
const dbDir = path.dirname(absoluteDbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new DatabaseSync(absoluteDbPath);

// Enable WAL mode & performance pragmas for production concurrency
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA busy_timeout = 5000;');
db.exec('PRAGMA synchronous = NORMAL;');
db.exec('PRAGMA cache_size = -64000;'); // 64MB memory cache
db.exec('PRAGMA temp_store = MEMORY;');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      rss_url TEXT NOT NULL UNIQUE,
      source_type TEXT CHECK(source_type IN ('PRIMARY', 'CREDIBLE_NEWS', 'DISCOVERY', 'COMMUNITY')) NOT NULL DEFAULT 'PRIMARY',
      reliability_score REAL NOT NULL DEFAULT 0.85,
      active INTEGER NOT NULL DEFAULT 1,
      last_checked DATETIME,
      last_success DATETIME,
      error_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      url TEXT NOT NULL,
      canonical_url TEXT NOT NULL,
      author TEXT,
      published_at DATETIME NOT NULL,
      discovered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      image_url TEXT,
      raw_content TEXT,
      content_hash TEXT UNIQUE NOT NULL,
      topic TEXT,
      importance_score INTEGER NOT NULL DEFAULT 50,
      credibility_score REAL NOT NULL DEFAULT 0.85,
      confidence_score INTEGER NOT NULL DEFAULT 70,
      status TEXT DEFAULT 'PROCESSED',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS story_clusters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cluster_title TEXT NOT NULL,
      summary TEXT NOT NULL,
      why_it_matters TEXT,
      key_points_json TEXT,
      importance_score INTEGER NOT NULL DEFAULT 50,
      credibility_score REAL NOT NULL DEFAULT 0.85,
      confidence_score INTEGER NOT NULL DEFAULT 70,
      radar_score INTEGER NOT NULL DEFAULT 50,
      status TEXT CHECK(status IN ('CONFIRMED', 'REPORTED', 'UNVERIFIED', 'CONTRADICTED')) NOT NULL DEFAULT 'REPORTED',
      category TEXT NOT NULL DEFAULT 'OTHER',
      breaking INTEGER NOT NULL DEFAULT 0,
      primary_source_name TEXT,
      primary_source_url TEXT,
      first_seen_at DATETIME NOT NULL,
      last_updated_at DATETIME NOT NULL,
      last_emailed_at DATETIME,
      last_update_hash TEXT
    );

    CREATE TABLE IF NOT EXISTS cluster_articles (
      cluster_id INTEGER NOT NULL REFERENCES story_clusters(id) ON DELETE CASCADE,
      article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
      PRIMARY KEY (cluster_id, article_id)
    );

    CREATE TABLE IF NOT EXISTS early_signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      source_name TEXT NOT NULL,
      source_url TEXT NOT NULL,
      signal_type TEXT NOT NULL DEFAULT 'PAPER',
      confidence TEXT NOT NULL DEFAULT 'Low',
      status TEXT NOT NULL DEFAULT 'WATCHING',
      discovered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS watchlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cluster_id INTEGER UNIQUE NOT NULL REFERENCES story_clusters(id) ON DELETE CASCADE,
      saved_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      icon TEXT DEFAULT 'grid_view',
      color TEXT DEFAULT '#4b41e1',
      parent_id INTEGER REFERENCES topics(id),
      active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS topic_keywords (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      keyword TEXT NOT NULL,
      weight REAL NOT NULL DEFAULT 1.0
    );

    CREATE TABLE IF NOT EXISTS article_topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
      cluster_id INTEGER REFERENCES story_clusters(id) ON DELETE CASCADE,
      topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      relevance_score INTEGER NOT NULL DEFAULT 50,
      classification_method TEXT DEFAULT 'KEYWORD_AND_ENTITY',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(cluster_id, topic_id)
    );

    CREATE TABLE IF NOT EXISTS topic_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT DEFAULT 'default_user',
      topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      followed INTEGER NOT NULL DEFAULT 1,
      notification_level TEXT CHECK(notification_level IN ('OFF', 'DAILY', 'IMPORTANT', 'BREAKING')) DEFAULT 'IMPORTANT',
      priority INTEGER DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, topic_id)
    );

    CREATE TABLE IF NOT EXISTS topic_summaries (
      topic_id INTEGER PRIMARY KEY REFERENCES topics(id) ON DELETE CASCADE,
      headline TEXT,
      summary TEXT,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS daily_briefings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      briefing_date TEXT NOT NULL UNIQUE,
      headline TEXT NOT NULL,
      executive_summary TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS email_briefings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      briefing_date TEXT NOT NULL,
      scheduled_time DATETIME,
      generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      sent_at DATETIME,
      status TEXT CHECK(status IN ('DRAFT', 'SENDING', 'SENT', 'FAILED', 'QUIET_MORNING')) NOT NULL DEFAULT 'DRAFT',
      summary TEXT,
      total_articles_scanned INTEGER DEFAULT 0,
      new_articles_found INTEGER DEFAULT 0,
      new_events_found INTEGER DEFAULT 0,
      stories_selected INTEGER DEFAULT 0,
      idempotency_key TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS email_briefing_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      briefing_id INTEGER NOT NULL REFERENCES email_briefings(id) ON DELETE CASCADE,
      cluster_id INTEGER NOT NULL REFERENCES story_clusters(id) ON DELETE CASCADE,
      article_id INTEGER REFERENCES articles(id) ON DELETE SET NULL,
      rank INTEGER NOT NULL,
      importance_score INTEGER NOT NULL,
      sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS event_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cluster_id INTEGER NOT NULL REFERENCES story_clusters(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      update_description TEXT,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS saved_searches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT DEFAULT 'default_user',
      query TEXT NOT NULL,
      filters_json TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, query)
    );

    CREATE TABLE IF NOT EXISTS job_executions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT NOT NULL,
      job_name TEXT NOT NULL,
      status TEXT CHECK(status IN ('QUEUED', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED')) NOT NULL DEFAULT 'QUEUED',
      started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      items_processed INTEGER DEFAULT 0,
      error_details TEXT
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT DEFAULT 'default_user',
      type TEXT NOT NULL DEFAULT 'BREAKING',
      priority TEXT CHECK(priority IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')) NOT NULL DEFAULT 'HIGH',
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      event_id INTEGER REFERENCES story_clusters(id) ON DELETE SET NULL,
      topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL,
      source_id INTEGER REFERENCES sources(id) ON DELETE SET NULL,
      alert_rule_id INTEGER,
      channel TEXT DEFAULT 'DASHBOARD',
      read INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      read_at DATETIME,
      deduplication_key TEXT UNIQUE,
      metadata_json TEXT
    );

    CREATE TABLE IF NOT EXISTS alert_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT DEFAULT 'default_user',
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'TOPIC',
      conditions_json TEXT,
      targets_json TEXT,
      keywords_json TEXT,
      excluded_keywords_json TEXT,
      importance_threshold INTEGER DEFAULT 70,
      novelty_threshold TEXT DEFAULT 'NEW_ONLY',
      priority_threshold TEXT NOT NULL DEFAULT 'HIGH',
      frequency TEXT NOT NULL DEFAULT 'INSTANT',
      cooldown_minutes INTEGER DEFAULT 1440,
      max_alerts_per_hour INTEGER DEFAULT 5,
      group_related_events INTEGER DEFAULT 1,
      channels_json TEXT,
      quiet_hours_json TEXT,
      quality_score INTEGER DEFAULT 85,
      estimated_frequency TEXT DEFAULT '~3 alerts/week',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_triggered_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      category TEXT NOT NULL DEFAULT 'Generative AI',
      momentum_score INTEGER DEFAULT 75,
      momentum_change INTEGER DEFAULT 5,
      intelligence_count INTEGER DEFAULT 0,
      research_count INTEGER DEFAULT 0,
      release_count INTEGER DEFAULT 0,
      opensource_count INTEGER DEFAULT 0,
      trend_status TEXT DEFAULT 'RISING',
      last_calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS learning_resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      provider TEXT NOT NULL DEFAULT 'Google Skills',
      provider_type TEXT DEFAULT 'OFFICIAL',
      official_url TEXT NOT NULL,
      skill_id INTEGER REFERENCES skills(id) ON DELETE CASCADE,
      category TEXT DEFAULT 'Generative AI',
      difficulty TEXT CHECK(difficulty IN ('Beginner', 'Intermediate', 'Advanced')) DEFAULT 'Beginner',
      resource_type TEXT DEFAULT 'Learning Path',
      duration TEXT DEFAULT '2 hours',
      credential_type TEXT DEFAULT 'Skill Badge',
      badge_available INTEGER DEFAULT 1,
      last_verified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      quality_score INTEGER DEFAULT 95
    );

    CREATE TABLE IF NOT EXISTS user_skills (
      user_id TEXT DEFAULT 'default_user',
      skill_id INTEGER REFERENCES skills(id) ON DELETE CASCADE,
      interest_level INTEGER DEFAULT 80,
      current_level TEXT DEFAULT 'Beginner',
      status TEXT DEFAULT 'INTERESTED',
      progress_percent INTEGER DEFAULT 0,
      followed INTEGER DEFAULT 1,
      goal TEXT,
      PRIMARY KEY(user_id, skill_id)
    );

    CREATE TABLE IF NOT EXISTS user_saved_resources (
      user_id TEXT DEFAULT 'default_user',
      resource_id INTEGER REFERENCES learning_resources(id) ON DELETE CASCADE,
      status TEXT CHECK(status IN ('Not Started', 'In Progress', 'Completed')) DEFAULT 'Not Started',
      progress_percent INTEGER DEFAULT 0,
      saved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      PRIMARY KEY(user_id, resource_id)
    );


    CREATE TABLE IF NOT EXISTS google_skill_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      base_url TEXT NOT NULL,
      domain TEXT NOT NULL,
      source_type TEXT NOT NULL DEFAULT 'OFFICIAL_PORTAL',
      enabled INTEGER NOT NULL DEFAULT 1,
      discovery_method TEXT NOT NULL DEFAULT 'SCRAPER_AND_CATALOG_SYNC',
      sync_interval_hours INTEGER NOT NULL DEFAULT 6,
      last_sync_at DATETIME,
      health_status TEXT NOT NULL DEFAULT 'HEALTHY',
      failure_count INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS google_skills_catalog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER REFERENCES google_skill_sources(id) ON DELETE SET NULL,
      skill_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      official_url TEXT NOT NULL UNIQUE,
      canonical_url TEXT NOT NULL UNIQUE,
      domain TEXT NOT NULL DEFAULT 'skills.google',
      resource_type TEXT NOT NULL DEFAULT 'COURSE',
      provider TEXT NOT NULL DEFAULT 'Google Skills',
      difficulty TEXT CHECK(difficulty IN ('Beginner', 'Intermediate', 'Advanced')) DEFAULT 'Beginner',
      duration TEXT DEFAULT '2 hours',
      thumbnail_url TEXT,
      language TEXT DEFAULT 'en',
      published_at DATETIME,
      first_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      content_hash TEXT NOT NULL,
      status TEXT CHECK(status IN ('DISCOVERED', 'PENDING_VERIFICATION', 'VERIFIED', 'ACTIVE', 'UPDATED', 'UNAVAILABLE', 'DEPRECATED')) DEFAULT 'ACTIVE',
      verification_status TEXT CHECK(verification_status IN ('VERIFIED', 'PENDING', 'FAILED')) DEFAULT 'VERIFIED',
      quality_score INTEGER NOT NULL DEFAULT 95,
      industry_relevance_score INTEGER NOT NULL DEFAULT 85,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS google_skill_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resource_id INTEGER NOT NULL REFERENCES google_skills_catalog(id) ON DELETE CASCADE,
      version_number INTEGER NOT NULL DEFAULT 1,
      title TEXT NOT NULL,
      description TEXT,
      metadata_snapshot TEXT,
      content_hash TEXT NOT NULL,
      detected_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      change_summary TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS google_skill_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resource_id INTEGER NOT NULL REFERENCES google_skills_catalog(id) ON DELETE CASCADE,
      change_type TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      detected_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS google_skill_mappings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resource_id INTEGER NOT NULL REFERENCES google_skills_catalog(id) ON DELETE CASCADE,
      skill_id INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
      mapping_type TEXT CHECK(mapping_type IN ('AUTOMATIC', 'AI_SUGGESTED', 'ADMIN')) DEFAULT 'AUTOMATIC',
      confidence REAL NOT NULL DEFAULT 0.95,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(resource_id, skill_id)
    );

    CREATE TABLE IF NOT EXISTS google_skill_prerequisites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resource_id INTEGER NOT NULL REFERENCES google_skills_catalog(id) ON DELETE CASCADE,
      prerequisite_skill_id INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
      relationship_type TEXT DEFAULT 'PREREQUISITE',
      confidence REAL DEFAULT 0.90,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_skill_interactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT DEFAULT 'default_user',
      resource_id INTEGER NOT NULL REFERENCES google_skills_catalog(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      session_id TEXT,
      metadata_json TEXT,
      timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_skill_bookmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT DEFAULT 'default_user',
      resource_id INTEGER NOT NULL REFERENCES google_skills_catalog(id) ON DELETE CASCADE,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, resource_id)
    );

    CREATE TABLE IF NOT EXISTS catalog_sync_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sync_type TEXT CHECK(sync_type IN ('MANUAL', 'AUTOMATIC', 'FULL', 'INCREMENTAL')) DEFAULT 'MANUAL',
      status TEXT CHECK(status IN ('QUEUED', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED')) DEFAULT 'RUNNING',
      started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      triggered_by TEXT DEFAULT 'ADMIN',
      resources_discovered INTEGER DEFAULT 0,
      resources_checked INTEGER DEFAULT 0,
      new_count INTEGER DEFAULT 0,
      updated_count INTEGER DEFAULT 0,
      unchanged_count INTEGER DEFAULT 0,
      unavailable_count INTEGER DEFAULT 0,
      verification_failed_count INTEGER DEFAULT 0,
      duplicate_count INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 0,
      duration_ms INTEGER DEFAULT 0,
      error_summary TEXT,
      details_json TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS catalog_sync_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sync_run_id INTEGER NOT NULL REFERENCES catalog_sync_runs(id) ON DELETE CASCADE,
      source_name TEXT NOT NULL,
      source_url TEXT NOT NULL,
      status TEXT CHECK(status IN ('HEALTHY', 'PARTIAL', 'FAILED', 'SKIPPED')) DEFAULT 'HEALTHY',
      started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      resources_found INTEGER DEFAULT 0,
      new_count INTEGER DEFAULT 0,
      updated_count INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 0,
      error_message TEXT,
      response_time_ms INTEGER DEFAULT 0
    );
  `);

  // Safe schema migrations for existing databases
  const alterStatements = [
    "ALTER TABLE alert_rules ADD COLUMN targets_json TEXT",
    "ALTER TABLE alert_rules ADD COLUMN keywords_json TEXT",
    "ALTER TABLE alert_rules ADD COLUMN excluded_keywords_json TEXT",
    "ALTER TABLE alert_rules ADD COLUMN importance_threshold INTEGER DEFAULT 70",
    "ALTER TABLE alert_rules ADD COLUMN novelty_threshold TEXT DEFAULT 'NEW_ONLY'",
    "ALTER TABLE alert_rules ADD COLUMN cooldown_minutes INTEGER DEFAULT 1440",
    "ALTER TABLE alert_rules ADD COLUMN max_alerts_per_hour INTEGER DEFAULT 5",
    "ALTER TABLE alert_rules ADD COLUMN group_related_events INTEGER DEFAULT 1",
    "ALTER TABLE alert_rules ADD COLUMN quality_score INTEGER DEFAULT 85",
    "ALTER TABLE alert_rules ADD COLUMN estimated_frequency TEXT DEFAULT '~3 alerts/week'",
    "ALTER TABLE notification_preferences ADD COLUMN global_pause_until DATETIME",
    "ALTER TABLE notification_preferences ADD COLUMN channel_matrix_json TEXT",
    "ALTER TABLE google_skills_catalog ADD COLUMN canonical_url TEXT",
    "ALTER TABLE google_skills_catalog ADD COLUMN domain TEXT DEFAULT 'skills.google'",
    "ALTER TABLE google_skills_catalog ADD COLUMN resource_type TEXT DEFAULT 'COURSE'",
    "ALTER TABLE google_skills_catalog ADD COLUMN difficulty TEXT DEFAULT 'Beginner'",
    "ALTER TABLE google_skills_catalog ADD COLUMN duration TEXT DEFAULT '2 hours'",
    "ALTER TABLE google_skills_catalog ADD COLUMN language TEXT DEFAULT 'en'",
    "ALTER TABLE google_skills_catalog ADD COLUMN published_at DATETIME",
    "ALTER TABLE google_skills_catalog ADD COLUMN content_hash TEXT",
    "ALTER TABLE google_skills_catalog ADD COLUMN status TEXT DEFAULT 'ACTIVE'",
    "ALTER TABLE google_skills_catalog ADD COLUMN verification_status TEXT DEFAULT 'VERIFIED'",
    "ALTER TABLE google_skills_catalog ADD COLUMN quality_score INTEGER DEFAULT 95",
    "ALTER TABLE google_skills_catalog ADD COLUMN industry_relevance_score INTEGER DEFAULT 85",
    "ALTER TABLE google_skills_catalog ADD COLUMN last_seen_at DATETIME",
    "ALTER TABLE google_skills_catalog ADD COLUMN source_id INTEGER",
    "ALTER TABLE google_skills_catalog ADD COLUMN created_at DATETIME",
    "ALTER TABLE google_skills_catalog ADD COLUMN updated_at DATETIME",
    "ALTER TABLE google_skills_catalog ADD COLUMN first_discovered_at DATETIME",
    "ALTER TABLE google_skills_catalog ADD COLUMN last_verified_at DATETIME",
    "ALTER TABLE google_skills_catalog ADD COLUMN consecutive_failures INTEGER DEFAULT 0",
    "ALTER TABLE user_skills ADD COLUMN proficiency_level TEXT DEFAULT 'BEGINNER'",
    "ALTER TABLE user_skills ADD COLUMN confidence REAL DEFAULT 0.8",
    "ALTER TABLE user_skills ADD COLUMN source TEXT DEFAULT 'USER_SELECTED'",
    "ALTER TABLE user_skills ADD COLUMN last_assessed_at DATETIME",
    "ALTER TABLE user_skills ADD COLUMN updated_at DATETIME",
    "ALTER TABLE catalog_sync_runs ADD COLUMN sync_type TEXT DEFAULT 'MANUAL'",
    "ALTER TABLE catalog_sync_runs ADD COLUMN triggered_by TEXT DEFAULT 'ADMIN'",
    "ALTER TABLE catalog_sync_runs ADD COLUMN resources_discovered INTEGER DEFAULT 0",
    "ALTER TABLE catalog_sync_runs ADD COLUMN unchanged_count INTEGER DEFAULT 0",
    "ALTER TABLE catalog_sync_runs ADD COLUMN verification_failed_count INTEGER DEFAULT 0",
    "ALTER TABLE catalog_sync_runs ADD COLUMN duration_ms INTEGER DEFAULT 0",
    "ALTER TABLE catalog_sync_runs ADD COLUMN error_summary TEXT",
    "ALTER TABLE catalog_sync_runs ADD COLUMN created_at DATETIME"
  ];

  // Ensure updated_at column exists for google_skills_catalog (migration safety)
  try {
    db.prepare("ALTER TABLE google_skills_catalog ADD COLUMN updated_at DATETIME").run();
  } catch (e) { /* ignore if already exists */ }

  for (const stmt of alterStatements) {
    try {
      db.prepare(stmt).run();
    } catch (e) {
      // Ignore duplicate column errors during migrations
    }
  }

  // Seed Initial Skill Taxonomy & Google Skills Verified Learning Catalog
  try {
    const skillsCount = (db.prepare('SELECT COUNT(*) as c FROM skills').get() as any).c;
    if (skillsCount === 0) {
      const insertSkill = db.prepare(`
        INSERT INTO skills (name, slug, description, category, momentum_score, momentum_change, trend_status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      insertSkill.run('AI Agents', 'ai-agents', 'Autonomous reasoning agents, tool use, and multi-agent coordination frameworks.', 'AI Agents', 94, 18, 'EXPLODING');
      insertSkill.run('Generative AI', 'generative-ai', 'Foundation models, multimodal synthesis, and diffusion techniques.', 'Generative AI', 91, 12, 'EXPLODING');
      insertSkill.run('AI Coding', 'ai-coding', 'Code generation models, SWE-bench evaluation, and IDE AI assistants.', 'AI Coding', 88, 14, 'RISING');
      insertSkill.run('Large Language Models', 'large-language-models', 'LLM pretraining, fine-tuning, RLHF, and inference optimization.', 'Large Language Models', 85, 8, 'RISING');
      insertSkill.run('Multimodal AI', 'multimodal-ai', 'Vision-language models, audio understanding, and cross-modal reasoning.', 'Multimodal AI', 84, 10, 'RISING');
      insertSkill.run('RAG', 'rag', 'Retrieval-Augmented Generation, vector embeddings, and hybrid search architectures.', 'RAG', 76, 5, 'RISING');
      insertSkill.run('AI Security', 'ai-security', 'Red-teaming, prompt injection defense, guardrails, and model safety.', 'AI Security', 71, 9, 'GROWING');
      insertSkill.run('MLOps', 'mlops', 'Model serving, monitoring, telemetry, and automated evaluation pipelines.', 'MLOps', 68, 4, 'GROWING');
      insertSkill.run('Robotics', 'robotics', 'Embodied AI, spatial intelligence, and physical world foundation models.', 'Robotics', 64, 3, 'GROWING');

      // Seed Verified Google Skills Learning Resources
      const insertResource = db.prepare(`
        INSERT INTO learning_resources (
          title, description, provider, provider_type, official_url, skill_id, category, difficulty, resource_type, duration, credential_type, badge_available, quality_score
        ) VALUES (?, ?, 'Google Skills', 'OFFICIAL', ?, ?, ?, ?, ?, ?, ?, 1, 98)
      `);

      const agentSkillId = (db.prepare("SELECT id FROM skills WHERE slug = 'ai-agents'").get() as any)?.id || 1;
      const genAiSkillId = (db.prepare("SELECT id FROM skills WHERE slug = 'generative-ai'").get() as any)?.id || 2;
      const llmSkillId = (db.prepare("SELECT id FROM skills WHERE slug = 'large-language-models'").get() as any)?.id || 4;

      insertResource.run(
        "Introduction to AI Agents and Google's Agent Ecosystem",
        "Learn core agentic AI architectures, tool integration, and Google DeepMind agent ecosystem design.",
        "https://www.skills.google/paths?pathslistid=ai",
        agentSkillId,
        "AI Agents",
        "Beginner",
        "Learning Path",
        "2 hours",
        "Skill Badge"
      );

      insertResource.run(
        "Inspect & Analyze Generative AI Models with Google Cloud",
        "Hands-on lab exploring model tuning, parameter evaluation, and Vertex AI Model Monitoring.",
        "https://www.skills.google/subscriptions",
        genAiSkillId,
        "Generative AI",
        "Intermediate",
        "Hands-On Lab",
        "3 hours",
        "Skill Badge"
      );

      insertResource.run(
        "Build Real-World AI Applications with Gemini and LangChain",
        "Practical engineering path covering RAG pipelines, function calling, and production Gemini deployment.",
        "https://www.skills.google/paths?pathslistid=ai",
        llmSkillId,
        "Large Language Models",
        "Advanced",
        "Learning Path",
        "5 hours",
        "Skill Badge"
      );

      insertResource.run(
        "Generative AI Fundamentals & Prompt Engineering",
        "Foundational course covering prompt strategies, zero-shot/few-shot learning, and safety guardrails.",
        "https://cloud.google.com/learn/training",
        genAiSkillId,
        "Generative AI",
        "Beginner",
        "Course",
        "1.5 hours",
        "Skill Badge"
      );

    }
  } catch (e) {
    console.error('[Database] Error seeding skills catalog:', e);
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at DESC);
    CREATE INDEX IF NOT EXISTS idx_articles_hash ON articles(content_hash);
    CREATE INDEX IF NOT EXISTS idx_articles_canonical ON articles(canonical_url);
    CREATE INDEX IF NOT EXISTS idx_clusters_updated ON story_clusters(last_updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_clusters_breaking ON story_clusters(breaking);
    CREATE INDEX IF NOT EXISTS idx_clusters_category ON story_clusters(category);
    CREATE INDEX IF NOT EXISTS idx_email_briefings_status ON email_briefings(briefing_date, status);
    CREATE INDEX IF NOT EXISTS idx_email_briefing_items ON email_briefing_items(cluster_id, sent_at);
    CREATE INDEX IF NOT EXISTS idx_article_topics_topic ON article_topics(topic_id, cluster_id);
    CREATE INDEX IF NOT EXISTS idx_sources_active_error ON sources(active, error_count);
    CREATE INDEX IF NOT EXISTS idx_google_skills_canonical ON google_skills_catalog(canonical_url);
    CREATE INDEX IF NOT EXISTS idx_google_skills_hash ON google_skills_catalog(content_hash);
    CREATE INDEX IF NOT EXISTS idx_google_skills_status ON google_skills_catalog(status, verification_status);
    CREATE INDEX IF NOT EXISTS idx_google_skills_type ON google_skills_catalog(resource_type);
    CREATE INDEX IF NOT EXISTS idx_google_skills_published ON google_skills_catalog(published_at DESC);
    CREATE INDEX IF NOT EXISTS idx_google_skills_relevance ON google_skills_catalog(industry_relevance_score DESC);
    CREATE INDEX IF NOT EXISTS idx_google_skill_mappings_skill ON google_skill_mappings(skill_id, resource_id);
    CREATE INDEX IF NOT EXISTS idx_google_skill_mappings_res ON google_skill_mappings(resource_id);
    CREATE INDEX IF NOT EXISTS idx_user_interactions_user ON user_skill_interactions(user_id, resource_id);
    CREATE INDEX IF NOT EXISTS idx_user_interactions_event ON user_skill_interactions(user_id, event_type);
    CREATE INDEX IF NOT EXISTS idx_user_bookmarks_user ON user_skill_bookmarks(user_id, resource_id);
    CREATE INDEX IF NOT EXISTS idx_article_topics_composite ON article_topics(topic_id, relevance_score DESC, cluster_id);
    CREATE INDEX IF NOT EXISTS idx_clusters_feed ON story_clusters(breaking DESC, importance_score DESC, last_updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_google_catalog_composite ON google_skills_catalog(status, verification_status, industry_relevance_score DESC);
  `);
}

initDatabase();

export function logSystemError(service: string, errorCode: string, message: string, stackTrace?: string) {
  try {
    db.prepare(`
      INSERT INTO system_error_logs (service, error_code, message, stack_trace)
      VALUES (?, ?, ?, ?)
    `).run(service, errorCode, message, stackTrace || null);
  } catch (err: any) {
    console.error('[DB Error Logging Failed]:', err.message);
  }
}
