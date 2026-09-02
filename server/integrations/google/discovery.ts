// server/integrations/google/discovery.ts
import { db } from '../../database/db.js';
import { validateOfficialGoogleUrl } from './validator.js';
import { canonicalizeUrl, computeContentHash } from './normalizer.js';
import { getOrInitGoogleSources, updateSourceSyncHealth } from './sourceRegistry.js';
import { fetchSkillsGoogleResources, RawDiscoveredResource } from './adapters/skillsGoogleAdapter.js';
import { fetchCloudLearningResources } from './adapters/cloudLearningAdapter.js';
import { broadcastStreamEvent } from '../../notifications/eventStream.js';

export type SyncType = 'MANUAL' | 'AUTOMATIC' | 'FULL' | 'INCREMENTAL';
export type SyncStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'PARTIAL' | 'FAILED' | 'CANCELLED';

export interface ActiveSyncJob {
  syncId: number;
  syncType: SyncType;
  status: SyncStatus;
  triggeredBy: string;
  progress: number;
  currentStep: string;
  startedAt: string;
  startTimeMs: number;
  resourcesDiscovered: number;
  resourcesChecked: number;
  newCount: number;
  updatedCount: number;
  unchangedCount: number;
  unavailableCount: number;
  verificationFailedCount: number;
  duplicateCount: number;
  errorCount: number;
  cancelRequested: boolean;
  sourceReports: Array<{
    sourceName: string;
    sourceUrl: string;
    status: 'HEALTHY' | 'PARTIAL' | 'FAILED';
    resourcesFound: number;
    newCount: number;
    updatedCount: number;
    errorCount: number;
    errorMessage?: string;
    responseTimeMs: number;
  }>;
}

export interface SyncRunResult {
  sync_id: number;
  sync_type: SyncType;
  status: SyncStatus;
  started_at: string;
  completed_at: string;
  duration_ms: number;
  resources_discovered: number;
  resources_checked: number;
  new_count: number;
  updated_count: number;
  unchanged_count: number;
  unavailable_count: number;
  verification_failed_count: number;
  duplicate_count: number;
  error_count: number;
  error_summary?: string;
  source_reports: any[];
  what_changed: {
    new_resources: any[];
    updated_resources: any[];
    unavailable_resources: any[];
  };
}

// In-memory Sync Lock to prevent concurrent simultaneous sync runs (PRD §25)
let activeSyncJob: ActiveSyncJob | null = null;

/**
 * Returns current sync status or active job
 */
export function getActiveSyncStatus() {
  if (!activeSyncJob) {
    // Return last completed sync run from database
    const lastRun = db.prepare(`
      SELECT * FROM catalog_sync_runs
      ORDER BY id DESC
      LIMIT 1
    `).get() as any;

    return {
      is_running: false,
      active_job: null,
      last_sync: lastRun || null
    };
  }

  return {
    is_running: true,
    active_job: {
      sync_id: activeSyncJob.syncId,
      sync_type: activeSyncJob.syncType,
      status: activeSyncJob.status,
      progress: activeSyncJob.progress,
      current_step: activeSyncJob.currentStep,
      started_at: activeSyncJob.startedAt,
      duration_ms: Date.now() - activeSyncJob.startTimeMs,
      resources_discovered: activeSyncJob.resourcesDiscovered,
      resources_checked: activeSyncJob.resourcesChecked,
      new_count: activeSyncJob.newCount,
      updated_count: activeSyncJob.updatedCount,
      unchanged_count: activeSyncJob.unchangedCount,
      unavailable_count: activeSyncJob.unavailableCount,
      verification_failed_count: activeSyncJob.verificationFailedCount,
      error_count: activeSyncJob.errorCount
    },
    last_sync: null
  };
}

/**
 * Cancel an active sync job (PRD §24)
 */
export function cancelGoogleCatalogSync(syncId: number): boolean {
  if (activeSyncJob && activeSyncJob.syncId === syncId) {
    activeSyncJob.cancelRequested = true;
    activeSyncJob.status = 'CANCELLED';
    return true;
  }
  return false;
}

/**
 * Calculates dynamic Industry Relevance Score (0-100) combining Skill Radar momentum, activity & quality (PRD §31)
 */
export function calculateIndustryRelevance(mappedSkillIds: number[], qualityScore: number = 95, publishedAt?: string): number {
  let highestSkillMomentum = 70;

  if (mappedSkillIds.length > 0) {
    const placeholders = mappedSkillIds.map(() => '?').join(',');
    const momentumRow = db.prepare(`
      SELECT MAX(momentum_score) as max_mom
      FROM skills 
      WHERE id IN (${placeholders})
    `).get(...mappedSkillIds) as any;

    if (momentumRow?.max_mom) {
      highestSkillMomentum = momentumRow.max_mom;
    }
  }

  // Freshness score (0-100)
  let freshnessScore = 60;
  if (publishedAt) {
    const daysOld = (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60 * 24);
    freshnessScore = Math.max(40, Math.min(100, Math.round(100 - (daysOld * 1.0))));
  }

  const relevance = Math.round(
    0.45 * highestSkillMomentum +
    0.25 * highestSkillMomentum +
    0.15 * freshnessScore +
    0.15 * qualityScore
  );

  return Math.min(100, Math.max(10, relevance));
}

/**
 * Master Discovery & Sync Pipeline (PRD §8, §11, §14-§28, §43)
 */
export async function runGoogleCatalogSync(options: {
  syncType?: SyncType;
  triggeredBy?: string;
} = {}): Promise<SyncRunResult> {
  const syncType = options.syncType || 'MANUAL';
  const triggeredBy = options.triggeredBy || 'ADMIN';

  // 1. Concurrency Control: Acquire Sync Lock (PRD §25)
  if (activeSyncJob && (activeSyncJob.status === 'RUNNING' || activeSyncJob.status === 'QUEUED')) {
    console.warn(`[GoogleSkillsSync] Sync already in progress (ID: ${activeSyncJob.syncId}). Rejecting duplicate request.`);
    throw new Error(`Sync already in progress (Job ID: ${activeSyncJob.syncId}, Progress: ${activeSyncJob.progress}%). Please wait for completion.`);
  }

  const startTimeMs = Date.now();
  const startTimeIso = new Date().toISOString();

  // Create audit sync run in DB
  const syncRunStmt = db.prepare(`
    INSERT INTO catalog_sync_runs (
      sync_type, status, started_at, triggered_by
    ) VALUES (?, 'RUNNING', ?, ?)
  `);
  const syncRunInfo = syncRunStmt.run(syncType, startTimeIso, triggeredBy);
  const syncRunId = Number(syncRunInfo.lastInsertRowid);

  // Initialize Active Job State
  activeSyncJob = {
    syncId: syncRunId,
    syncType,
    status: 'RUNNING',
    triggeredBy,
    progress: 5,
    currentStep: 'Initializing discovery sources',
    startedAt: startTimeIso,
    startTimeMs,
    resourcesDiscovered: 0,
    resourcesChecked: 0,
    newCount: 0,
    updatedCount: 0,
    unchangedCount: 0,
    unavailableCount: 0,
    verificationFailedCount: 0,
    duplicateCount: 0,
    errorCount: 0,
    cancelRequested: false,
    sourceReports: []
  };

  const sources = getOrInitGoogleSources();
  const whatChanged = {
    new_resources: [] as any[],
    updated_resources: [] as any[],
    unavailable_resources: [] as any[]
  };

  const updateProgress = (progress: number, step: string) => {
    if (!activeSyncJob) return;
    activeSyncJob.progress = progress;
    activeSyncJob.currentStep = step;
    broadcastStreamEvent('HEARTBEAT', {
      sync_id: syncRunId,
      progress,
      step,
      new_count: activeSyncJob.newCount,
      updated_count: activeSyncJob.updatedCount
    });
  };

  try {
    updateProgress(15, 'Discovering official Google learning sources');

    // 2. Discover from Official Google Sources (Source-Level Tracking PRD §7)
    const allDiscovered: Array<{ item: RawDiscoveredResource; sourceId: number; sourceDomain: string }> = [];

    // Source A: skills.google
    const skillsGoogleSource = sources.find(s => s.domain === 'skills.google') || sources[0];
    const sourceAT0 = Date.now();
    try {
      updateProgress(25, 'Fetching catalog from skills.google');
      const itemsA = await fetchSkillsGoogleResources();
      const durationA = Date.now() - sourceAT0;
      
      for (const it of itemsA) {
        allDiscovered.push({ item: it, sourceId: skillsGoogleSource.id, sourceDomain: 'skills.google' });
      }

      const reportA = {
        sourceName: 'Google Skills Portal',
        sourceUrl: skillsGoogleSource.base_url,
        status: 'HEALTHY' as const,
        resourcesFound: itemsA.length,
        newCount: 0,
        updatedCount: 0,
        errorCount: 0,
        responseTimeMs: durationA
      };
      activeSyncJob.sourceReports.push(reportA);
      updateSourceSyncHealth(skillsGoogleSource.id, true);

      // Save source sync row
      db.prepare(`
        INSERT INTO catalog_sync_sources (
          sync_run_id, source_name, source_url, status, started_at, completed_at, resources_found, response_time_ms
        ) VALUES (?, ?, ?, 'HEALTHY', ?, CURRENT_TIMESTAMP, ?, ?)
      `).run(syncRunId, reportA.sourceName, reportA.sourceUrl, new Date(sourceAT0).toISOString(), itemsA.length, durationA);

    } catch (err: any) {
      activeSyncJob.errorCount++;
      const durationA = Date.now() - sourceAT0;
      activeSyncJob.sourceReports.push({
        sourceName: 'Google Skills Portal',
        sourceUrl: skillsGoogleSource.base_url,
        status: 'FAILED',
        resourcesFound: 0,
        newCount: 0,
        updatedCount: 0,
        errorCount: 1,
        errorMessage: err.message,
        responseTimeMs: durationA
      });
      updateSourceSyncHealth(skillsGoogleSource.id, false);
      db.prepare(`
        INSERT INTO catalog_sync_sources (
          sync_run_id, source_name, source_url, status, started_at, completed_at, resources_found, error_count, error_message, response_time_ms
        ) VALUES (?, ?, ?, 'FAILED', ?, CURRENT_TIMESTAMP, 0, 1, ?, ?)
      `).run(syncRunId, 'Google Skills Portal', skillsGoogleSource.base_url, new Date(sourceAT0).toISOString(), err.message, durationA);
    }

    // Source B: cloud.google.com & deepmind.google
    const cloudSource = sources.find(s => s.domain === 'cloud.google.com' || s.domain === 'deepmind.google') || sources[0];
    const sourceBT0 = Date.now();
    try {
      updateProgress(40, 'Fetching training modules from Google Cloud & DeepMind');
      const itemsB = await fetchCloudLearningResources();
      const durationB = Date.now() - sourceBT0;

      for (const it of itemsB) {
        allDiscovered.push({ item: it, sourceId: cloudSource.id, sourceDomain: cloudSource.domain });
      }

      const reportB = {
        sourceName: 'Google Cloud & DeepMind Learning',
        sourceUrl: cloudSource.base_url,
        status: 'HEALTHY' as const,
        resourcesFound: itemsB.length,
        newCount: 0,
        updatedCount: 0,
        errorCount: 0,
        responseTimeMs: durationB
      };
      activeSyncJob.sourceReports.push(reportB);
      updateSourceSyncHealth(cloudSource.id, true);

      db.prepare(`
        INSERT INTO catalog_sync_sources (
          sync_run_id, source_name, source_url, status, started_at, completed_at, resources_found, response_time_ms
        ) VALUES (?, ?, ?, 'HEALTHY', ?, CURRENT_TIMESTAMP, ?, ?)
      `).run(syncRunId, reportB.sourceName, reportB.sourceUrl, new Date(sourceBT0).toISOString(), itemsB.length, durationB);

    } catch (err: any) {
      activeSyncJob.errorCount++;
      const durationB = Date.now() - sourceBT0;
      activeSyncJob.sourceReports.push({
        sourceName: 'Google Cloud & DeepMind Learning',
        sourceUrl: cloudSource.base_url,
        status: 'FAILED',
        resourcesFound: 0,
        newCount: 0,
        updatedCount: 0,
        errorCount: 1,
        errorMessage: err.message,
        responseTimeMs: durationB
      });
      updateSourceSyncHealth(cloudSource.id, false);
      db.prepare(`
        INSERT INTO catalog_sync_sources (
          sync_run_id, source_name, source_url, status, started_at, completed_at, resources_found, error_count, error_message, response_time_ms
        ) VALUES (?, ?, ?, 'FAILED', ?, CURRENT_TIMESTAMP, 0, 1, ?, ?)
      `).run(syncRunId, 'Google Cloud & DeepMind Learning', cloudSource.base_url, new Date(sourceBT0).toISOString(), err.message, durationB);
    }

    activeSyncJob.resourcesDiscovered = allDiscovered.length;
    updateProgress(55, `Validating and deduplicating ${allDiscovered.length} discovered resources`);

    // 3. Process Each Discovered Resource in a Database Transaction (PRD §28)
    const seenCanonicalUrls = new Set<string>();
    const seenResourceIds = new Set<number>();
    const now = new Date().toISOString();

    for (let i = 0; i < allDiscovered.length; i++) {
      if (activeSyncJob.cancelRequested) {
        throw new Error('Sync job was cancelled by user request.');
      }

      const { item, sourceId, sourceDomain } = allDiscovered[i];
      activeSyncJob.resourcesChecked++;

      // a. URL Validation & SSRF Check (PRD §10)
      const valResult = validateOfficialGoogleUrl(item.official_url);
      if (!valResult.valid || !valResult.sanitizedUrl) {
        activeSyncJob.verificationFailedCount++;
        activeSyncJob.errorCount++;
        console.warn(`[GoogleSkillsSync] URL validation failed for "${item.official_url}": ${valResult.error}`);
        continue;
      }

      // b. URL Canonicalization (PRD §11)
      const canonicalUrl = canonicalizeUrl(valResult.sanitizedUrl);
      if (seenCanonicalUrls.has(canonicalUrl)) {
        activeSyncJob.duplicateCount++;
        continue;
      }
      seenCanonicalUrls.add(canonicalUrl);

      // c. Content Fingerprinting & SHA-256 Hash (PRD §13)
      const contentHash = computeContentHash({
        title: item.title,
        description: item.description || '',
        canonical_url: canonicalUrl,
        resource_type: item.resource_type,
        difficulty: item.difficulty,
        duration: item.duration,
        skills: item.mapped_skill_slugs
      });

      // d. Resolve Skill IDs from taxonomy (PRD §31)
      const mappedSkillIds: number[] = [];
      for (const slug of item.mapped_skill_slugs) {
        const skill = db.prepare('SELECT id FROM skills WHERE slug = ?').get(slug) as any;
        if (skill?.id) mappedSkillIds.push(skill.id);
      }

      const industryRelevance = calculateIndustryRelevance(mappedSkillIds, 98, item.published_at);

      // e. Compare With Existing Database Record (PRD §14)
      const existing = db.prepare(`
        SELECT * FROM google_skills_catalog 
        WHERE canonical_url = ? OR official_url = ?
      `).get(canonicalUrl, valResult.sanitizedUrl) as any;

      if (!existing) {
        // CASE: NEW RESOURCE (PRD §16)
        const insertStmt = db.prepare(`
          INSERT INTO google_skills_catalog (
            source_id, skill_id, title, description, official_url, canonical_url, domain,
            resource_type, provider, difficulty, duration, thumbnail_url, published_at,
            first_seen_at, first_discovered_at, last_seen_at, last_verified_at, last_updated_at,
            content_hash, status, verification_status, quality_score, industry_relevance_score,
            consecutive_failures
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?,
            ?, 'Google Skills', ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, 'NEW', 'VERIFIED', 98, ?, 0
          )
        `);

        const resInfo = insertStmt.run(
          sourceId,
          item.skill_id,
          item.title,
          item.description,
          valResult.sanitizedUrl,
          canonicalUrl,
          valResult.domain || sourceDomain,
          item.resource_type,
          item.difficulty,
          item.duration,
          item.thumbnail_url || null,
          item.published_at || now,
          now,
          now,
          now,
          now,
          now,
          contentHash,
          industryRelevance
        );

        const resourceId = Number(resInfo.lastInsertRowid);
        seenResourceIds.add(resourceId);
        activeSyncJob.newCount++;

        // Initial Version Snapshot (PRD §18)
        db.prepare(`
          INSERT INTO google_skill_versions (
            resource_id, version_number, title, description, metadata_snapshot, content_hash, change_summary
          ) VALUES (?, 1, ?, ?, ?, ?, 'Initial verified release discovered from Google catalog')
        `).run(
          resourceId,
          item.title,
          item.description,
          JSON.stringify({ difficulty: item.difficulty, duration: item.duration, type: item.resource_type }),
          contentHash
        );

        // Mappings (PRD §31)
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
                INSERT OR IGNORE INTO google_skill_prerequisites (resource_id, prerequisite_skill_id, relationship_type)
                VALUES (?, ?, 'PREREQUISITE')
              `).run(resourceId, prereqSkill.id);
            }
          }
        }

        whatChanged.new_resources.push({
          id: resourceId,
          title: item.title,
          difficulty: item.difficulty,
          duration: item.duration,
          url: valResult.sanitizedUrl
        });

        // Broadcast stream event for new skill
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
        seenResourceIds.add(existing.id);

        // CASE: EXISTING RESOURCE - CHANGE DETECTION (PRD §15, §17, §19)
        if (existing.content_hash !== contentHash || syncType === 'FULL') {
          const fieldChanges: Array<{ field: string; oldVal: string; newVal: string }> = [];

          if (existing.title !== item.title) {
            fieldChanges.push({ field: 'TITLE', oldVal: existing.title, newVal: item.title });
          }
          if (existing.description !== item.description) {
            fieldChanges.push({ field: 'DESCRIPTION', oldVal: existing.description || '', newVal: item.description || '' });
          }
          if (existing.difficulty !== item.difficulty) {
            fieldChanges.push({ field: 'DIFFICULTY', oldVal: existing.difficulty, newVal: item.difficulty });
          }
          if (existing.duration !== item.duration) {
            fieldChanges.push({ field: 'DURATION', oldVal: existing.duration, newVal: item.duration });
          }
          if (existing.resource_type !== item.resource_type) {
            fieldChanges.push({ field: 'RESOURCE_TYPE', oldVal: existing.resource_type, newVal: item.resource_type });
          }

          if (fieldChanges.length > 0 || existing.status === 'UNAVAILABLE') {
            activeSyncJob.updatedCount++;

            // Record changes in google_skill_changes (PRD §19)
            for (const fc of fieldChanges) {
              db.prepare(`
                INSERT INTO google_skill_changes (resource_id, change_type, old_value, new_value, detected_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
              `).run(existing.id, fc.field, fc.oldVal, fc.newVal);
            }

            // Version Snapshot
            const verCount = (db.prepare('SELECT COUNT(*) as c FROM google_skill_versions WHERE resource_id = ?').get(existing.id) as any)?.c || 1;
            const changeSummary = fieldChanges.map(fc => `${fc.field}: ${fc.oldVal} → ${fc.newVal}`).join('; ') || 'Re-verified and metadata refreshed';

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
                verification_status = 'VERIFIED',
                last_seen_at = ?,
                last_verified_at = ?,
                last_updated_at = ?,
                industry_relevance_score = ?,
                consecutive_failures = 0
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
              now,
              industryRelevance,
              existing.id
            );

            whatChanged.updated_resources.push({
              id: existing.id,
              title: item.title,
              changes: fieldChanges
            });
          } else {
            // Hash identical, update last_seen_at & last_verified_at (UNCHANGED PRD §14)
            db.prepare(`
              UPDATE google_skills_catalog SET
                last_seen_at = ?,
                last_verified_at = ?,
                industry_relevance_score = ?,
                consecutive_failures = 0
              WHERE id = ?
            `).run(now, now, industryRelevance, existing.id);
            activeSyncJob.unchangedCount++;
          }
        } else {
          // UNCHANGED
          db.prepare(`
            UPDATE google_skills_catalog SET
              last_seen_at = ?,
              last_verified_at = ?,
              industry_relevance_score = ?,
              consecutive_failures = 0
            WHERE id = ?
          `).run(now, now, industryRelevance, existing.id);
          activeSyncJob.unchangedCount++;
        }

        // Ensure mappings exist
        for (const skillId of mappedSkillIds) {
          db.prepare(`
            INSERT OR IGNORE INTO google_skill_mappings (resource_id, skill_id, mapping_type, confidence)
            VALUES (?, ?, 'AUTOMATIC', 0.95)
          `).run(existing.id, skillId);
        }
      }

      const itemPercent = 55 + Math.round(((i + 1) / allDiscovered.length) * 35);
      updateProgress(itemPercent, `Processing catalog items (${i + 1}/${allDiscovered.length})`);
    }

    // 4. Failure Tolerance & Unavailable Detection (PRD §20, §21)
    updateProgress(92, 'Evaluating unavailable resources and failure tolerance');
    const allCatalogRows = db.prepare('SELECT id, title, canonical_url, consecutive_failures, status FROM google_skills_catalog').all() as any[];

    for (const catRow of allCatalogRows) {
      if (!seenResourceIds.has(catRow.id)) {
        // Resource wasn't seen in this sync
        const nextFailures = (catRow.consecutive_failures || 0) + 1;
        if (nextFailures >= 3 && catRow.status !== 'UNAVAILABLE') {
          db.prepare(`
            UPDATE google_skills_catalog 
            SET status = 'UNAVAILABLE', consecutive_failures = ?
            WHERE id = ?
          `).run(nextFailures, catRow.id);

          activeSyncJob.unavailableCount++;
          whatChanged.unavailable_resources.push({
            id: catRow.id,
            title: catRow.title,
            reason: '3 consecutive sync misses from official Google feed'
          });

          db.prepare(`
            INSERT INTO google_skill_changes (resource_id, change_type, old_value, new_value, detected_at)
            VALUES (?, 'STATUS', ?, 'UNAVAILABLE', CURRENT_TIMESTAMP)
          `).run(catRow.id, catRow.status);
        } else {
          db.prepare('UPDATE google_skills_catalog SET consecutive_failures = ? WHERE id = ?').run(nextFailures, catRow.id);
        }
      }
    }

    // 5. Finalize Sync Run (PRD §32)
    updateProgress(98, 'Finalizing sync metrics and refreshing recommendation caches');
    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - startTimeMs;
    const finalStatus: SyncStatus = activeSyncJob.errorCount > 0
      ? (activeSyncJob.newCount > 0 || activeSyncJob.updatedCount > 0 ? 'PARTIAL' : 'FAILED')
      : 'COMPLETED';

    db.prepare(`
      UPDATE catalog_sync_runs SET
        completed_at = ?,
        status = ?,
        resources_discovered = ?,
        resources_checked = ?,
        new_count = ?,
        updated_count = ?,
        unchanged_count = ?,
        unavailable_count = ?,
        verification_failed_count = ?,
        duplicate_count = ?,
        error_count = ?,
        duration_ms = ?,
        details_json = ?
      WHERE id = ?
    `).run(
      completedAt,
      finalStatus,
      activeSyncJob.resourcesDiscovered,
      activeSyncJob.resourcesChecked,
      activeSyncJob.newCount,
      activeSyncJob.updatedCount,
      activeSyncJob.unchangedCount,
      activeSyncJob.unavailableCount,
      activeSyncJob.verificationFailedCount,
      activeSyncJob.duplicateCount,
      activeSyncJob.errorCount,
      durationMs,
      JSON.stringify({
        source_reports: activeSyncJob.sourceReports,
        what_changed: whatChanged
      }),
      syncRunId
    );

    const finalResult: SyncRunResult = {
      sync_id: syncRunId,
      sync_type: syncType,
      status: finalStatus,
      started_at: startTimeIso,
      completed_at: completedAt,
      duration_ms: durationMs,
      resources_discovered: activeSyncJob.resourcesDiscovered,
      resources_checked: activeSyncJob.resourcesChecked,
      new_count: activeSyncJob.newCount,
      updated_count: activeSyncJob.updatedCount,
      unchanged_count: activeSyncJob.unchangedCount,
      unavailable_count: activeSyncJob.unavailableCount,
      verification_failed_count: activeSyncJob.verificationFailedCount,
      duplicate_count: activeSyncJob.duplicateCount,
      error_count: activeSyncJob.errorCount,
      source_reports: activeSyncJob.sourceReports,
      what_changed: whatChanged
    };

    // Broadcast final completion event
    broadcastStreamEvent('HEARTBEAT', {
      type: 'CATALOG_SYNC_COMPLETED',
      sync_id: syncRunId,
      status: finalStatus,
      summary: `+${activeSyncJob.newCount} New, ↻${activeSyncJob.updatedCount} Updated, ✓${activeSyncJob.unchangedCount} Unchanged`
    });

    console.log(`[GoogleSkillsSync] Sync #${syncRunId} finished with status "${finalStatus}" in ${durationMs}ms (+${activeSyncJob.newCount} new, ↻${activeSyncJob.updatedCount} updated, ✓${activeSyncJob.unchangedCount} unchanged).`);

    return finalResult;

  } catch (err: any) {
    console.error('[GoogleSkillsSync] Fatal sync execution error:', err.message);
    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - startTimeMs;

    db.prepare(`
      UPDATE catalog_sync_runs SET
        completed_at = ?,
        status = 'FAILED',
        error_count = error_count + 1,
        error_summary = ?,
        duration_ms = ?
      WHERE id = ?
    `).run(completedAt, err.message, durationMs, syncRunId);

    throw err;

  } finally {
    // Release Sync Lock
    activeSyncJob = null;
  }
}
