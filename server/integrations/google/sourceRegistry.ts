// server/integrations/google/sourceRegistry.ts
import { db } from '../../database/db.js';

export interface GoogleSource {
  id: number;
  name: string;
  base_url: string;
  domain: string;
  source_type: string;
  enabled: number;
  discovery_method: string;
  sync_interval_hours: number;
  last_sync_at: string | null;
  health_status: string;
  failure_count: number;
}

const DEFAULT_OFFICIAL_SOURCES = [
  {
    name: 'Google Skills Hub',
    base_url: 'https://skills.google',
    domain: 'skills.google',
    source_type: 'OFFICIAL_PORTAL',
    discovery_method: 'SCRAPER_AND_CATALOG_SYNC',
    sync_interval_hours: 6
  },
  {
    name: 'Google Cloud Training & Certifications',
    base_url: 'https://cloud.google.com/learn/training',
    domain: 'cloud.google.com',
    source_type: 'CLOUD_LEARNING',
    discovery_method: 'CATALOG_SYNC',
    sync_interval_hours: 6
  },
  {
    name: 'Google DeepMind Research & Technologies',
    base_url: 'https://deepmind.google/technologies',
    domain: 'deepmind.google',
    source_type: 'RESEARCH_LEARNING',
    discovery_method: 'CURATED_SYNC',
    sync_interval_hours: 12
  }
];

/**
 * Initializes and retrieves active official Google learning sources from the database.
 */
export function getOrInitGoogleSources(): GoogleSource[] {
  try {
    const existing = db.prepare('SELECT * FROM google_skill_sources').all() as unknown as GoogleSource[];
    if (existing.length > 0) {
      return existing.filter((s) => Boolean(s.enabled));
    }

    const insertStmt = db.prepare(`
      INSERT INTO google_skill_sources (
        name, base_url, domain, source_type, discovery_method, sync_interval_hours, health_status
      ) VALUES (?, ?, ?, ?, ?, ?, 'HEALTHY')
    `);

    for (const src of DEFAULT_OFFICIAL_SOURCES) {
      insertStmt.run(
        src.name,
        src.base_url,
        src.domain,
        src.source_type,
        src.discovery_method,
        src.sync_interval_hours
      );
    }

    return db.prepare('SELECT * FROM google_skill_sources WHERE enabled = 1').all() as unknown as GoogleSource[];
  } catch (err: any) {
    console.error('[SourceRegistry] Error loading Google sources:', err.message);
    return [];
  }
}

export function updateSourceSyncHealth(sourceId: number, success: boolean, errorMessage?: string) {
  try {
    if (success) {
      db.prepare(`
        UPDATE google_skill_sources 
        SET last_sync_at = CURRENT_TIMESTAMP, health_status = 'HEALTHY', failure_count = 0, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(sourceId);
    } else {
      db.prepare(`
        UPDATE google_skill_sources 
        SET failure_count = failure_count + 1,
            health_status = CASE WHEN failure_count >= 3 THEN 'DEGRADED' ELSE health_status END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(sourceId);
    }
  } catch (e) {}
}
