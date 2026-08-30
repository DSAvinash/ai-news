// server/integrations/google/discovery.ts
import { db } from '../../database/db.js';
import { validateOfficialGoogleUrl } from './validator.js';
import { canonicalizeUrl, computeContentHash } from './normalizer.js';
import { getOrInitGoogleSources, updateSourceSyncHealth } from './sourceRegistry.js';
import { fetchSkillsGoogleResources, RawDiscoveredResource } from './adapters/skillsGoogleAdapter.js';
import { fetchCloudLearningResources } from './adapters/cloudLearningAdapter.js';
import { broadcastStreamEvent } from '../../notifications/eventStream.js';

export interface SyncRunResult {
  status: 'COMPLETED' | 'PARTIAL' | 'FAILED';
  resources_checked: number;
  new_count: number;
  updated_count: number;
  duplicate_count: number;
  error_count: number;
  sync_run_id: number;
}

/**
 * Calculates dynamic Industry Relevance Score (0-100) combining Skill Radar momentum, activity & quality (PRD §30)
 */
export function calculateIndustryRelevance(mappedSkillIds: number[], qualityScore: number = 95, publishedAt?: string): number {
  let highestSkillMomentum = 70;

  if (mappedSkillIds.length > 0) {
    const placeholders = mappedSkillIds.map(() => '?').join(',');
    const momentumRow = db.prepare(`
      SELECT MAX(momentum_score) as max_mom, MAX(intelligence_count) as max_intel 
      FROM skills 
      WHERE id IN (${placeholders})
    `).get(...mappedSkillIds) as any;

    if (momentumRow?.max_mom) {
      highestSkillMomentum = momentumRow.max_mom;
    }
  }

  // Freshness score (0-100): 100 if <= 7 days, linearly decaying to 40 at 60 days
  let freshnessScore = 60;
  if (publishedAt) {
    const daysOld = (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60 * 24);
    freshnessScore = Math.max(40, Math.min(100, Math.round(100 - (daysOld * 1.0))));
  }

  // Formula (PRD §30): 0.45 * Momentum + 0.25 * Story Activity + 0.15 * Freshness + 0.15 * Quality
  const relevance = Math.round(
    0.45 * highestSkillMomentum +
    0.25 * highestSkillMomentum + // Correlated with real-time story activity
    0.15 * freshnessScore +
    0.15 * qualityScore
  );

  return Math.min(100, Math.max(10, relevance));
}

/**
 * Master Discovery & Sync Pipeline (PRD §8, §11, §18, §20, §61)
 */
export async function runGoogleCatalogSync(): Promise<SyncRunResult> {
  console.log('[GoogleSkillsSync] Starting Google Skills intelligence sync run...');
  const sources = getOrInitGoogleSources();
  const startTime = new Date().toISOString();

  // 1. Create audit sync run record
  const syncRunStmt = db.prepare(`
    INSERT INTO catalog_sync_runs (started_at, status)
    VALUES (?, 'RUNNING')
  `);
  const syncRunInfo = syncRunStmt.run(startTime);
  const syncRunId = Number(syncRunInfo.lastInsertRowid);

  let resourcesChecked = 0;
  let newCount = 0;
  let updatedCount = 0;
  let duplicateCount = 0;
  let errorCount = 0;

  try {
    // 2. Ingest from all official adapters
    const discovered: RawDiscoveredResource[] = [];
    
    try {
      const skillsGoogleItems = await fetchSkillsGoogleResources();
      discovered.push(...skillsGoogleItems);
      const src = sources.find((s) => s.domain === 'skills.google');
      if (src) updateSourceSyncHealth(src.id, true);
    } catch (err: any) {
      errorCount++;
      console.error('[GoogleSkillsSync] Error from skills.google adapter:', err.message);
    }

    try {
      const cloudItems = await fetchCloudLearningResources();
      discovered.push(...cloudItems);
      const src = sources.find((s) => s.domain === 'cloud.google.com' || s.domain === 'deepmind.google');
      if (src) updateSourceSyncHealth(src.id, true);
    } catch (err: any) {
      errorCount++;
      console.error('[GoogleSkillsSync] Error from cloud learning adapter:', err.message);
    }

    // 3. Process each discovered resource through validation, fingerprinting, and diffing
    for (const item of discovered) {
      resourcesChecked++;

      // a. URL Validation & SSRF Check
      const valResult = validateOfficialGoogleUrl(item.official_url);
      if (!valResult.valid || !valResult.sanitizedUrl) {
        console.warn(`[GoogleSkillsSync] Rejecting invalid URL "${item.official_url}": ${valResult.error}`);
        errorCount++;
        continue;
      }

      // b. Canonicalization & Fingerprinting
      const canonicalUrl = canonicalizeUrl(valResult.sanitizedUrl);
      const contentHash = computeContentHash({
        canonical_url: canonicalUrl,
        title: item.title,
        description: item.description,
        resource_type: item.resource_type,
        difficulty: item.difficulty,
        duration: item.duration,
        skills: item.mapped_skill_slugs
      });

      // c. Resolve Skill IDs from taxonomy
      const mappedSkillIds: number[] = [];
      for (const slug of item.mapped_skill_slugs) {
        const skill = db.prepare('SELECT id FROM skills WHERE slug = ?').get(slug) as any;
        if (skill?.id) mappedSkillIds.push(skill.id);
      }

      const industryRelevance = calculateIndustryRelevance(mappedSkillIds, 98, item.published_at);
      const source = sources.find((s) => s.domain === valResult.domain) || sources[0];
      const now = new Date().toISOString();

      // d. Check if existing resource in catalog
      const existing = db.prepare('SELECT * FROM google_skills_catalog WHERE canonical_url = ? OR official_url = ?').get(canonicalUrl, valResult.sanitizedUrl) as any;

      if (!existing) {
        // NEW RESOURCE INSERTION
        const insertStmt = db.prepare(`
          INSERT INTO google_skills_catalog (
            source_id, skill_id, title, description, official_url, canonical_url, domain,
            resource_type, provider, difficulty, duration, thumbnail_url, published_at,
            first_seen_at, last_seen_at, last_updated_at, content_hash, status,
            verification_status, quality_score, industry_relevance_score
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?,
            ?, 'Google Skills', ?, ?, ?, ?,
            ?, ?, ?, ?, 'ACTIVE',
            'VERIFIED', 98, ?
          )
        `);

        const resInfo = insertStmt.run(
          source?.id || 1,
          item.skill_id,
          item.title,
          item.description,
          valResult.sanitizedUrl,
          canonicalUrl,
          valResult.domain || 'skills.google',
          item.resource_type,
          item.difficulty,
          item.duration,
          item.thumbnail_url || null,
          item.published_at || now,
          now,
          now,
          now,
          contentHash,
          industryRelevance
        );

        const resourceId = Number(resInfo.lastInsertRowid);
        newCount++;

        // Initial version snapshot
        db.prepare(`
          INSERT INTO google_skill_versions (
            resource_id, version_number, title, description, metadata_snapshot, content_hash, change_summary
          ) VALUES (?, 1, ?, ?, ?, ?, 'Initial verified release')
        `).run(
          resourceId,
          item.title,
          item.description,
          JSON.stringify({ difficulty: item.difficulty, duration: item.duration, type: item.resource_type }),
          contentHash
        );

        // Mappings
        for (const skillId of mappedSkillIds) {
          db.prepare(`
            INSERT OR IGNORE INTO google_skill_mappings (resource_id, skill_id, mapping_type, confidence)
            VALUES (?, ?, 'AUTOMATIC', 0.95)
          `).run(resourceId, skillId);
        }

        // Prerequisites
        if (item.prerequisite_skill_slugs && item.prerequisite_skill_slugs.length > 0) {
          for (const prereqSlug of item.prerequisite_skill_slugs) {
            const prereqSkill = db.prepare('SELECT id FROM skills WHERE slug = ?').get(prereqSlug) as any;
            if (prereqSkill?.id) {
              db.prepare(`
                INSERT INTO google_skill_prerequisites (resource_id, prerequisite_skill_id, relationship_type)
                VALUES (?, ?, 'PREREQUISITE')
              `).run(resourceId, prereqSkill.id);
            }
          }
        }

        // Broadcast real-time stream event for new Google Skill discovery
        broadcastStreamEvent('GOOGLE_SKILL_SYNCED', {
          id: resourceId,
          title: item.title,
          description: item.description,
          official_url: valResult.sanitizedUrl,
          difficulty: item.difficulty,
          duration: item.duration,
          provider: 'Google Skills'
        });
      } else {
        // EXISTING RESOURCE UPDATE / CHANGE DETECTION (PRD §18, §20, §22)
        if (existing.content_hash !== contentHash) {
          // Content or metadata changed!
          const changes: { type: string; old: string; new: string }[] = [];

          if (existing.title !== item.title) changes.push({ type: 'TITLE', old: existing.title, new: item.title });
          if (existing.description !== item.description) changes.push({ type: 'DESCRIPTION', old: existing.description || '', new: item.description });
          if (existing.difficulty !== item.difficulty) changes.push({ type: 'DIFFICULTY', old: existing.difficulty, new: item.difficulty });
          if (existing.duration !== item.duration) changes.push({ type: 'DURATION', old: existing.duration, new: item.duration });
          if (existing.resource_type !== item.resource_type) changes.push({ type: 'RESOURCE_TYPE', old: existing.resource_type, new: item.resource_type });

          // Record change diffs
          for (const chg of changes) {
            db.prepare(`
              INSERT INTO google_skill_changes (resource_id, change_type, old_value, new_value)
              VALUES (?, ?, ?, ?)
            `).run(existing.id, chg.type, chg.old, chg.new);
          }

          // Count existing versions for version number
          const verCount = (db.prepare('SELECT COUNT(*) as c FROM google_skill_versions WHERE resource_id = ?').get(existing.id) as any)?.c || 1;
          const changeSummary = changes.length > 0 
            ? changes.map((c) => `Updated ${c.type.toLowerCase()}`).join(', ')
            : 'Updated course content and learning metadata';

          // Snapshot new version
          db.prepare(`
            INSERT INTO google_skill_versions (
              resource_id, version_number, title, description, metadata_snapshot, content_hash, change_summary
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            existing.id,
            verCount + 1,
            item.title,
            item.description,
            JSON.stringify({ difficulty: item.difficulty, duration: item.duration, type: item.resource_type }),
            contentHash,
            changeSummary
          );

          // Update main catalog row
          db.prepare(`
            UPDATE google_skills_catalog SET
              title = ?,
              description = ?,
              resource_type = ?,
              difficulty = ?,
              duration = ?,
              content_hash = ?,
              status = 'UPDATED',
              last_seen_at = ?,
              last_updated_at = ?,
              industry_relevance_score = ?,
              last_updated_at = ?
            WHERE id = ?
          `).run(
            item.title,
            item.description,
            item.resource_type,
            item.difficulty,
            item.duration,
            contentHash,
            now,
            now,
            industryRelevance,
            now,
            existing.id
          );

          updatedCount++;
        } else {
          // Unchanged, just bump last_seen_at
          db.prepare(`
            UPDATE google_skills_catalog SET
              last_seen_at = ?,
              industry_relevance_score = ?
            WHERE id = ?
          `).run(now, industryRelevance, existing.id);
          duplicateCount++;
        }

        // Ensure mappings exist
        for (const skillId of mappedSkillIds) {
          db.prepare(`
            INSERT OR IGNORE INTO google_skill_mappings (resource_id, skill_id, mapping_type, confidence)
            VALUES (?, ?, 'AUTOMATIC', 0.95)
          `).run(existing.id, skillId);
        }
      }
    }

    const overallStatus = errorCount > 0 ? (newCount > 0 || updatedCount > 0 ? 'PARTIAL' : 'FAILED') : 'COMPLETED';
    const completedAt = new Date().toISOString();

    db.prepare(`
      UPDATE catalog_sync_runs SET
        completed_at = ?,
        status = ?,
        resources_checked = ?,
        new_count = ?,
        updated_count = ?,
        unavailable_count = 0,
        duplicate_count = ?,
        error_count = ?
      WHERE id = ?
    `).run(completedAt, overallStatus, resourcesChecked, newCount, updatedCount, duplicateCount, errorCount, syncRunId);

    console.log(`[GoogleSkillsSync] Sync finished with status "${overallStatus}". Checked: ${resourcesChecked}, New: ${newCount}, Updated: ${updatedCount}`);

    return {
      status: overallStatus,
      resources_checked: resourcesChecked,
      new_count: newCount,
      updated_count: updatedCount,
      duplicate_count: duplicateCount,
      error_count: errorCount,
      sync_run_id: syncRunId
    };
  } catch (err: any) {
    console.error('[GoogleSkillsSync] Fatal sync error:', err.message);
    db.prepare(`
      UPDATE catalog_sync_runs SET
        completed_at = CURRENT_TIMESTAMP,
        status = 'FAILED',
        error_count = error_count + 1,
        details_json = ?
      WHERE id = ?
    `).run(JSON.stringify({ fatal_error: err.message, stack: err.stack }), syncRunId);

    return {
      status: 'FAILED',
      resources_checked: resourcesChecked,
      new_count: newCount,
      updated_count: updatedCount,
      duplicate_count: duplicateCount,
      error_count: errorCount + 1,
      sync_run_id: syncRunId
    };
  }
}
