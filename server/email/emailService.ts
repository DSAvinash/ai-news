import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { db, logSystemError } from '../database/db.js';
import { generateDailyLandscapeSummary } from '../ai/geminiService.js';
import { getBriefingCandidates, BriefingCandidate } from '../ingestion/freshnessEngine.js';

dotenv.config();

export interface SmtpConfigValidation {
  valid: boolean;
  code?: string;
  message?: string;
  details?: {
    host: string;
    port: number;
    userConfigured: boolean;
    passConfigured: boolean;
    fromConfigured: boolean;
    toConfigured: boolean;
  };
}

export function validateSmtpConfig(): SmtpConfigValidation {
  const host = process.env.SMTP_HOST || '';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const user = process.env.SMTP_USERNAME || '';
  const pass = process.env.SMTP_PASSWORD || '';
  const from = process.env.EMAIL_FROM || '';
  const to = process.env.EMAIL_TO || '';

  const details = {
    host,
    port,
    userConfigured: Boolean(user),
    passConfigured: Boolean(pass),
    fromConfigured: Boolean(from || user),
    toConfigured: Boolean(to)
  };

  if (!host || !user || !pass) {
    return {
      valid: false,
      code: 'EMAIL_CONFIGURATION_MISSING',
      message: 'SMTP credentials (SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD) are not fully configured in environment variables.',
      details
    };
  }

  if (!to) {
    return {
      valid: false,
      code: 'EMAIL_CONFIGURATION_MISSING',
      message: 'Default recipient address (EMAIL_TO) is missing in environment variables.',
      details
    };
  }

  return { valid: true, details };
}

export function createTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.hostinger.com';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USERNAME || '';
  const pass = process.env.SMTP_PASSWORD || '';

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });
}

export async function verifySmtpConnection(): Promise<{ success: boolean; code?: string; message: string }> {
  const validation = validateSmtpConfig();
  if (!validation.valid) {
    return { success: false, code: validation.code, message: validation.message! };
  }

  try {
    const transporter = createTransporter();
    await transporter.verify();
    return { success: true, message: 'SMTP server connection verified successfully.' };
  } catch (err: any) {
    const msg = err.message || String(err);
    console.error('[SMTP Verification Error]:', msg);

    let code = 'SMTP_CONNECTION_FAILED';
    let userMsg = 'Unable to connect to the configured SMTP server.';

    if (err.code === 'EAUTH' || msg.includes('535') || msg.includes('Invalid login') || msg.includes('authentication failed')) {
      code = 'SMTP_AUTH_FAILED';
      userMsg = 'SMTP authentication failed. Your username or password was rejected by Hostinger.';
    } else if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKET' || msg.includes('timeout')) {
      code = 'SMTP_TIMEOUT';
      userMsg = 'The SMTP mail server did not respond within the configured timeout period.';
    } else if (err.code === 'ENOTFOUND') {
      code = 'SMTP_CONNECTION_FAILED';
      userMsg = `Could not resolve SMTP host "${process.env.SMTP_HOST}".`;
    }

    logSystemError('EMAIL_SERVICE', code, msg, err.stack);
    return { success: false, code, message: userMsg };
  }
}

export function generateBriefingHtml(
  dateStr: string,
  executiveSummary: string,
  stories: BriefingCandidate[],
  isQuietMorning: boolean = false,
  isTestMode: boolean = false
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f5f7; margin: 0; padding: 20px; color: #172b4d; }
    .container { max-width: 650px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; padding: 32px; }
    .test-banner { background: #fef3c7; color: #92400e; border: 1px solid #f59e0b; padding: 10px 16px; border-radius: 6px; font-weight: 700; font-size: 13px; text-align: center; margin-bottom: 20px; }
    .header { border-bottom: 2px solid #4b41e1; padding-bottom: 16px; margin-bottom: 24px; }
    .header h1 { margin: 0; color: #4b41e1; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
    .header .subtitle { color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; margin-top: 4px; }
    .date-badge { display: inline-block; background: #eeedfd; color: #4b41e1; font-weight: 700; font-size: 12px; padding: 4px 10px; border-radius: 6px; margin-top: 8px; }
    .summary-box { background: #f8fafc; border-left: 4px solid #4b41e1; padding: 16px 20px; border-radius: 0 8px 8px 0; margin-bottom: 28px; }
    .summary-box h2 { margin: 0 0 8px 0; font-size: 15px; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px; }
    .summary-box p { margin: 0; color: #334155; font-size: 14px; line-height: 1.6; }
    .section-title { font-size: 16px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin: 28px 0 16px 0; text-transform: uppercase; letter-spacing: 0.5px; }
    .card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 14px; }
    .card-meta { display: flex; justify-content: space-between; font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; margin-bottom: 6px; }
    .card-title { font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 6px; text-decoration: none; display: block; }
    .card-summary { font-size: 13px; color: #475569; line-height: 1.5; margin-bottom: 10px; }
    .card-why { background: #f1f5f9; padding: 8px 12px; border-radius: 6px; font-size: 12px; color: #334155; margin-bottom: 8px; font-style: italic; }
    .card-link { color: #4b41e1; font-weight: 600; font-size: 12px; text-decoration: none; }
    .footer { text-align: center; font-size: 12px; color: #94a3b8; margin-top: 36px; border-top: 1px solid #e2e8f0; padding-top: 16px; }
    .updated-badge { background: #dbeafe; color: #1e40af; font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    ${isTestMode ? `<div class="test-banner">⚡ AI INTELLIGENCE RADAR — SYSTEM TEST EMAIL</div>` : ''}
    <div class="header">
      <h1>🛰️ AI INTELLIGENCE RADAR</h1>
      <div class="subtitle">Here is your curated AI intelligence for the day.</div>
      <div class="date-badge">${dateStr}</div>
    </div>

    ${isQuietMorning ? `
      <div class="summary-box" style="border-left-color: #64748b; background: #f1f5f9;">
        <h2 style="color: #475569;">QUIET MORNING</h2>
        <p>No major new AI developments were detected since your last briefing. Your intelligence monitoring engine scanned all active feeds and filtered out redundant reports.</p>
      </div>
    ` : `
      <div class="summary-box">
        <h2>WHAT CHANGED SINCE YOUR LAST BRIEFING</h2>
        <p>${executiveSummary}</p>
      </div>

      ${stories.length > 0 ? `
        <div class="section-title">Top Intelligence Developments</div>
        ${stories.map((c) => `
          <div class="card">
            <div class="card-meta">
              <span>[${c.category}] • RADAR SCORE: ${c.radar_score}</span>
              ${c.is_updated_since_last_sent ? '<span class="updated-badge">UPDATED</span>' : ''}
            </div>
            <div class="card-title">${c.cluster_title}</div>
            <div class="card-summary">${c.summary}</div>
            <div class="card-why">WHY IT MATTERS: High-signal development from verified primary outlets.</div>
            <a class="card-link" href="${c.primary_source_url || '#'}" target="_blank">Read Original Coverage (${c.primary_source_name || 'Primary Source'}) →</a>
          </div>
        `).join('')}
      ` : ''}
    `}

    <div class="footer">
      Generated automatically by AI Intelligence Radar • Source links provided for deep-dives.<br>
      ${isTestMode ? 'This is a test notification confirming Hostinger SMTP integration.' : 'Click <a href="http://localhost:3000" style="color:#4b41e1;font-weight:bold;">Dashboard Link</a> to see the full board.'}
    </div>
  </div>
</body>
</html>
  `;
}

let lastTestEmailTime = 0;

export async function sendTestEmail(targetRecipient?: string): Promise<{ success: boolean; message?: string; messageId?: string; timestamp?: string; error?: { code: string; message: string } }> {
  // Prevent duplicate clicks within 5 seconds (Request Lock)
  if (Date.now() - lastTestEmailTime < 5000) {
    return {
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'An email test is already in progress. Please wait a few seconds before testing again.'
      }
    };
  }
  lastTestEmailTime = Date.now();

  const recipient = targetRecipient || process.env.EMAIL_TO || '';
  if (!recipient) {
    return {
      success: false,
      error: {
        code: 'EMAIL_CONFIGURATION_MISSING',
        message: 'Recipient email address is missing. Please set EMAIL_TO in environment variables.'
      }
    };
  }

  // Pre-flight SMTP Connection Test
  const verifyRes = await verifySmtpConnection();
  if (!verifyRes.success) {
    return {
      success: false,
      error: {
        code: verifyRes.code || 'SMTP_CONNECTION_FAILED',
        message: verifyRes.message
      }
    };
  }

  try {
    const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const { candidates, isQuietMorning } = getBriefingCandidates();

    let executiveSummary = 'Hostinger SMTP test briefing successfully generated. Pipeline scanning is active across 17 primary feeds.';
    if (!isQuietMorning && candidates.length > 0) {
      const aiSummary = await generateDailyLandscapeSummary(candidates.slice(0, 3).map(c => ({
        title: c.cluster_title,
        summary: c.summary,
        category: c.category,
        source: c.primary_source_name || 'Primary Source'
      })));
      if (aiSummary) executiveSummary = aiSummary.executive_summary;
    }

    const htmlContent = generateBriefingHtml(dateStr, executiveSummary, candidates.slice(0, 3), isQuietMorning, true);

    // Save preview HTML
    const fs = await import('fs');
    const path = await import('path');
    const previewPath = path.resolve(process.cwd(), 'dist', 'latest_briefing.html');
    fs.writeFileSync(previewPath, htmlContent, 'utf-8');

    const transporter = createTransporter();
    const user = process.env.SMTP_USERNAME || '';
    const fromAddress = process.env.EMAIL_FROM || `"AI Intelligence Radar" <${user}>`;

    const info = await transporter.sendMail({
      from: fromAddress,
      to: recipient,
      subject: `☀️ [TEST] Daily AI Intelligence Briefing: ${dateStr}`,
      html: htmlContent
    });

    console.log(`[Test Email] Test email delivered to ${recipient}. MessageId: ${info.messageId}`);

    return {
      success: true,
      message: `Test email sent successfully to ${recipient}`,
      messageId: info.messageId,
      timestamp: new Date().toISOString()
    };
  } catch (error: any) {
    const msg = error.message || String(error);
    console.error('[Test Email Failed]:', msg);
    logSystemError('EMAIL_SERVICE', 'SMTP_SEND_FAILED', msg, error.stack);

    return {
      success: false,
      error: {
        code: 'SMTP_SEND_FAILED',
        message: `SMTP delivery failed: ${msg}`
      }
    };
  }
}

export async function sendDailyBriefingEmail(options: { dryRun?: boolean; previewOnly?: boolean } = {}): Promise<{ success: boolean; message: string; briefingId?: number; error?: { code: string; message: string } }> {
  const { dryRun = false, previewOnly = false } = options;
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const todayYmd = new Date().toISOString().split('T')[0];
  const idempotencyKey = `${todayYmd}-daily-briefing`;
  const recipient = process.env.EMAIL_TO || '';

  if (!recipient) {
    return {
      success: false,
      message: 'EMAIL_TO is missing.',
      error: { code: 'EMAIL_CONFIGURATION_MISSING', message: 'EMAIL_TO is not configured in environment variables.' }
    };
  }

  // Check Idempotency: Skip if already sent today unless dryRun / previewOnly
  const existingBriefing = db.prepare("SELECT * FROM email_briefings WHERE idempotency_key = ? AND status IN ('SENT', 'QUIET_MORNING')").get(idempotencyKey) as any;
  if (existingBriefing && !dryRun && !previewOnly) {
    return { success: true, message: `Daily briefing for ${todayYmd} was already delivered successfully.` };
  }

  try {
    const { candidates, isQuietMorning, scannedCount } = getBriefingCandidates();

    let executiveSummary = 'Continuous AI primary source monitoring has filtered the latest model releases, open weights, and research breakthroughs.';
    if (!isQuietMorning && candidates.length > 0) {
      const aiSummary = await generateDailyLandscapeSummary(candidates.map(c => ({
        title: c.cluster_title,
        summary: c.summary,
        category: c.category,
        source: c.primary_source_name || 'Primary Source'
      })));
      if (aiSummary) executiveSummary = aiSummary.executive_summary;
    }

    const htmlContent = generateBriefingHtml(dateStr, executiveSummary, candidates, isQuietMorning, false);

    const fs = await import('fs');
    const path = await import('path');
    const previewPath = path.resolve(process.cwd(), 'dist', 'latest_briefing.html');
    fs.writeFileSync(previewPath, htmlContent, 'utf-8');

    if (dryRun || previewOnly) {
      console.log(`[Email Engine] ${dryRun ? 'DRY RUN' : 'PREVIEW'} Briefing generated. Saved to ${previewPath}`);
      return {
        success: true,
        message: `${dryRun ? '[DRY RUN] ' : ''}Briefing generated! Preview saved to dist/latest_briefing.html. Delivery state was NOT altered.`
      };
    }

    const verifyRes = await verifySmtpConnection();
    if (!verifyRes.success) {
      return {
        success: false,
        message: verifyRes.message,
        error: { code: verifyRes.code || 'SMTP_CONNECTION_FAILED', message: verifyRes.message }
      };
    }

    const transporter = createTransporter();
    const user = process.env.SMTP_USERNAME || '';
    const fromAddress = process.env.EMAIL_FROM || `"AI Intelligence Radar" <${user}>`;

    await transporter.sendMail({
      from: fromAddress,
      to: recipient,
      subject: `☀️ Daily AI Intelligence Briefing: ${dateStr}`,
      html: htmlContent
    });

    const statusVal = isQuietMorning ? 'QUIET_MORNING' : 'SENT';
    const briefingRes = db.prepare(`
      INSERT INTO email_briefings (
        briefing_date, scheduled_time, sent_at, status, summary,
        total_articles_scanned, stories_selected, idempotency_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(idempotency_key) DO UPDATE SET
        sent_at = CURRENT_TIMESTAMP,
        status = excluded.status,
        summary = excluded.summary,
        stories_selected = excluded.stories_selected
    `).run(
      todayYmd,
      new Date().toISOString(),
      new Date().toISOString(),
      statusVal,
      executiveSummary,
      scannedCount,
      candidates.length,
      idempotencyKey
    );

    const briefingId = briefingRes.lastInsertRowid ? Number(briefingRes.lastInsertRowid) : 1;

    const insertItemStmt = db.prepare(`
      INSERT INTO email_briefing_items (briefing_id, cluster_id, rank, importance_score, sent_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    candidates.forEach((c, idx) => {
      insertItemStmt.run(briefingId, c.id, idx + 1, c.importance_score);
    });

    console.log(`[Email Engine] Daily briefing email sent to ${recipient}. ${candidates.length} stories marked delivered.`);
    return { success: true, message: `Daily briefing successfully sent to ${recipient}`, briefingId };
  } catch (error: any) {
    console.error('[Email Engine] Failed to send email:', error.message);
    logSystemError('EMAIL_SERVICE', 'DAILY_BRIEFING_FAILED', error.message, error.stack);

    db.prepare(`
      INSERT INTO email_briefings (briefing_date, status, summary, idempotency_key)
      VALUES (?, 'FAILED', ?, ?)
      ON CONFLICT(idempotency_key) DO UPDATE SET status = 'FAILED'
    `).run(todayYmd, error.message, idempotencyKey);

    return {
      success: false,
      message: `Failed to send email: ${error.message}`,
      error: { code: 'SMTP_SEND_FAILED', message: error.message }
    };
  }
}

export function getSafeEmailHealthStatus() {
  const validation = validateSmtpConfig();
  const lastBriefing = db.prepare("SELECT * FROM email_briefings ORDER BY generated_at DESC LIMIT 1").get() as any;

  return {
    configured: validation.valid,
    smtpHostConfigured: Boolean(process.env.SMTP_HOST),
    smtpPortConfigured: Boolean(process.env.SMTP_PORT),
    credentialsConfigured: Boolean(process.env.SMTP_USERNAME && process.env.SMTP_PASSWORD),
    fromConfigured: Boolean(process.env.EMAIL_FROM || process.env.SMTP_USERNAME),
    toConfigured: Boolean(process.env.EMAIL_TO),
    lastBriefingStatus: lastBriefing ? lastBriefing.status : 'NONE',
    lastBriefingDate: lastBriefing ? lastBriefing.briefing_date : null,
    status: validation.valid ? 'healthy' : 'configuration_missing'
  };
}
