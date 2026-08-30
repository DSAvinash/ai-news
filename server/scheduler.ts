import cron from 'node-cron';
import { runGoogleCatalogSync } from './integrations/google/discovery.js';
import dotenv from 'dotenv';
import { fetchAllActiveSources } from './ingestion/rssParser.js';
import { processArticlesIntoClusters } from './ingestion/clustering.js';
import { sendDailyBriefingEmail } from './email/emailService.js';
import { logSystemError } from './database/db.js';

dotenv.config();

const pollInterval = parseInt(process.env.NEWS_POLL_INTERVAL_MINUTES || '5', 10);
const timezone = process.env.APP_TIMEZONE || 'Asia/Kolkata';

let isIngestionRunning = false;
let isBriefingRunning = false;

export function startBackgroundTasks() {
  console.log(`[Scheduler] Initializing background tasks...`);

  // 1. RSS Ingestion Cron (Every 5 minutes)
  cron.schedule(`*/${pollInterval} * * * *`, async () => {
    if (isIngestionRunning) {
      console.warn('[Scheduler] Skip: Previous RSS ingestion cycle is still executing.');
      return;
    }

    isIngestionRunning = true;
    console.log('[Scheduler] Running scheduled RSS ingestion...');
    try {
      const articles = await fetchAllActiveSources();
      processArticlesIntoClusters(articles);
    } catch (err: any) {
      console.error('[Scheduler] Ingestion error:', err.message);
      logSystemError('SCHEDULER', 'INGESTION_FAILED', err.message, err.stack);
    } finally {
      isIngestionRunning = false;
    }
  });

  // 2. Daily Briefing Email Cron (Every day at 07:00 AM in Asia/Kolkata)
  cron.schedule('0 7 * * *', async () => {
    if (isBriefingRunning) {
      console.warn('[Scheduler] Skip: Previous daily briefing task is still executing.');
      return;
    }

    isBriefingRunning = true;
    console.log('[Scheduler] 07:00 AM trigger — Preparing daily AI briefing email...');
    try {
      await sendDailyBriefingEmail();
    } catch (err: any) {
      console.error('[Scheduler] Daily briefing email error:', err.message);
      logSystemError('SCHEDULER', 'BRIEFING_FAILED', err.message, err.stack);
    } finally {
      isBriefingRunning = false;
    }
  }, {
    timezone: timezone
  });

  console.log(`[Scheduler] Ingestion scheduled every ${pollInterval} mins. Daily briefing scheduled for 07:00 AM (${timezone}).`);

  // 3. Google Skills Catalog Sync & Intelligence (Every 6 hours - PRD §62)
  cron.schedule('0 */6 * * *', async () => {
    console.log('[Scheduler] Running scheduled Google Skills catalog sync...');
    try {
      await runGoogleCatalogSync();
    } catch (err: any) {
      console.error('[Scheduler] Google Skills sync error:', err.message);
      logSystemError('SCHEDULER', 'GOOGLE_SKILLS_SYNC_FAILED', err.message, err.stack);
    }
  }, { timezone: timezone });
}
