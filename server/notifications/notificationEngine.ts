import { db } from '../database/db.js';
import { logger } from '../logger.js';
import { sendTestEmail, verifySmtpConnection, createTransporter } from '../email/emailService.js';

export interface NotificationItem {
  id: number;
  user_id: string;
  type: string; // 'BREAKING' | 'MODEL' | 'RESEARCH' | 'AGENTS' | 'SYSTEM' | etc.
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  message: string;
  event_id?: number | null;
  topic_id?: number | null;
  source_id?: number | null;
  alert_rule_id?: number | null;
  channel: string;
  read: boolean;
  created_at: string;
  read_at?: string | null;
  deduplication_key?: string | null;
}

// SMTP Rate Limiter: Max 3 immediate email alerts dispatched per minute to avoid SMTP 421 throttling
let lastEmailTimestamps: number[] = [];
const MAX_EMAILS_PER_MINUTE = 3;

function isEmailRateLimited(): boolean {
  const now = Date.now();
  // Filter out timestamps older than 60 seconds
  lastEmailTimestamps = lastEmailTimestamps.filter((t) => now - t < 60000);
  if (lastEmailTimestamps.length >= MAX_EMAILS_PER_MINUTE) {
    return true;
  }
  lastEmailTimestamps.push(now);
  return false;
}

export function isGlobalPauseActive(): boolean {
  try {
    const prefs = db.prepare("SELECT global_pause_until FROM notification_preferences WHERE user_id = 'default_user'").get() as any;
    if (!prefs || !prefs.global_pause_until) return false;
    return new Date(prefs.global_pause_until).getTime() > Date.now();
  } catch (e) {
    return false;
  }
}

export function isQuietHoursActive(): boolean {
  try {
    const prefs = db.prepare("SELECT * FROM notification_preferences WHERE user_id = 'default_user'").get() as any;
    if (!prefs || !prefs.quiet_hours_start || !prefs.quiet_hours_end) return false;

    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    const [startH, startM] = prefs.quiet_hours_start.split(':').map(Number);
    const [endH, endM] = prefs.quiet_hours_end.split(':').map(Number);

    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;

    if (startMins > endMins) {
      // Crosses midnight (e.g. 22:00 to 07:00)
      return currentMins >= startMins || currentMins < endMins;
    } else {
      return currentMins >= startMins && currentMins < endMins;
    }
  } catch (e) {
    return false;
  }
}

export function createNotification(entry: {
  type: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  message: string;
  event_id?: number | null;
  topic_id?: number | null;
  source_id?: number | null;
  alert_rule_id?: number | null;
  deduplication_key?: string | null;
}): NotificationItem | null {
  const {
    type,
    priority,
    title,
    message,
    event_id = null,
    topic_id = null,
    source_id = null,
    alert_rule_id = null,
    deduplication_key = null
  } = entry;

  const dedupKey = deduplication_key || (event_id ? `notification:event:${event_id}` : `notification:${Date.now()}:${Math.random()}`);

  try {
    const existing = db.prepare('SELECT id FROM notifications WHERE deduplication_key = ?').get(dedupKey);
    if (existing) {
      return null; // Skip duplicate notification (PRD §29)
    }

    const stmt = db.prepare(`
      INSERT INTO notifications (
        user_id, type, priority, title, message, event_id, topic_id, source_id, alert_rule_id, channel, read, deduplication_key
      ) VALUES ('default_user', ?, ?, ?, ?, ?, ?, ?, ?, 'DASHBOARD', 0, ?)
    `);

    const result = stmt.run(type, priority, title, message, event_id, topic_id, source_id, alert_rule_id, dedupKey);
    const newId = Number(result.lastInsertRowid);

    logger.info('NOTIFICATION_ENGINE', 'CREATE_NOTIFICATION', `Created [${priority}] notification "${title}"`, {
      job_id: `notif_${newId}`
    });

    const notif = db.prepare('SELECT * FROM notifications WHERE id = ?').get(newId) as any;
    return {
      ...notif,
      read: Boolean(notif.read)
    };
  } catch (err: any) {
    logger.error('NOTIFICATION_ENGINE', 'CREATE_NOTIFICATION_FAILED', err.message, { stack_trace: err.stack });
    return null;
  }
}

export async function evaluateEventForNotifications(cluster: {
  id: number;
  cluster_title: string;
  summary: string;
  category: string;
  importance_score: number;
  breaking: boolean;
  primary_source_name?: string;
  primary_source_url?: string;
}) {
  try {
    // PRD §60: Check Global Pause
    if (isGlobalPauseActive()) {
      logger.info('NOTIFICATION_ENGINE', 'GLOBAL_PAUSE', `Skipping cluster #${cluster.id} due to active global pause.`);
      return;
    }

    // 1. Determine Priority
    let priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
    if (cluster.breaking || cluster.importance_score >= 85 || cluster.category === 'MODEL RELEASE') {
      priority = 'CRITICAL';
    } else if (cluster.importance_score >= 70 || cluster.category === 'RESEARCH' || cluster.category === 'AI AGENTS') {
      priority = 'HIGH';
    } else if (cluster.importance_score < 40) {
      priority = 'LOW';
    }

    // Filter out LOW / noise (PRD §2)
    if (priority === 'LOW') return;

    const title = `${priority === 'CRITICAL' ? '🔴 BREAKING: ' : priority === 'HIGH' ? '🟠 ' : '🔵 '}${cluster.cluster_title}`;
    const message = cluster.summary;

    const notif = createNotification({
      type: cluster.category.toUpperCase().replace(/\s+/g, '_'),
      priority,
      title,
      message,
      event_id: cluster.id,
      deduplication_key: `notification:cluster:${cluster.id}`
    });

    if (!notif) return; // Skip if deduplicated

    // 2. Check Immediate Email Alert Dispatch
    const prefs = db.prepare("SELECT * FROM notification_preferences WHERE user_id = 'default_user'").get() as any;
    const emailLevel = prefs?.email_alerts_level || 'CRITICAL';

    const shouldSendEmail =
      (emailLevel === 'CRITICAL' && priority === 'CRITICAL') ||
      (emailLevel === 'HIGH' && ['CRITICAL', 'HIGH'].includes(priority)) ||
      (emailLevel === 'ALL');

    const inQuietHours = isQuietHoursActive();
    const bypassQuietHours = priority === 'CRITICAL' && Boolean(prefs?.critical_override);

    if (shouldSendEmail && (!inQuietHours || bypassQuietHours)) {
      if (isEmailRateLimited()) {
        logger.info('NOTIFICATION_ENGINE', 'EMAIL_THROTTLED', `Email alert throttled for cluster #${cluster.id} to preserve SMTP rate limits.`);
        return;
      }

      const recipient = process.env.EMAIL_TO || process.env.SMTP_USERNAME;
      if (recipient) {
        try {
          const transporter = createTransporter();
          const fromAddress = process.env.EMAIL_FROM || `"AI Intelligence Radar" <${process.env.SMTP_USERNAME}>`;

          await transporter.sendMail({
            from: fromAddress,
            to: recipient,
            subject: `🚨 [IMMEDIATE ALERT] ${cluster.cluster_title}`,
            html: `
              <div style="font-family: sans-serif; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 600px;">
                <div style="color: #e11d48; font-weight: bold; text-transform: uppercase; font-size: 12px; margin-bottom: 8px;">
                  🚨 CRITICAL AI INTELLIGENCE EVENT DETECTED
                </div>
                <h2 style="color: #0f172a; margin-top: 0;">${cluster.cluster_title}</h2>
                <p style="color: #334155; line-height: 1.6;">${cluster.summary}</p>
                <div style="background: #f1f5f9; padding: 12px; border-radius: 6px; font-size: 13px; margin: 16px 0;">
                  <strong>Category:</strong> ${cluster.category} • <strong>Source:</strong> ${cluster.primary_source_name || 'Primary Outlet'}
                </div>
                <a href="${cluster.primary_source_url || 'http://localhost:3000'}" style="display: inline-block; background: #4b41e1; color: #fff; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 13px;">
                  Read Original Source →
                </a>
              </div>
            `
          });
          logger.info('NOTIFICATION_ENGINE', 'EMAIL_ALERT_SENT', `Email alert dispatched to ${recipient} for cluster #${cluster.id}`);
        } catch (mailErr: any) {
          logger.error('NOTIFICATION_ENGINE', 'EMAIL_ALERT_FAILED', mailErr.message);
        }
      }
    }
  } catch (err: any) {
    logger.error('NOTIFICATION_ENGINE', 'EVALUATION_FAILED', err.message, { stack_trace: err.stack });
  }
}
