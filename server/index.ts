import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { apiRouter } from './routes.js';
import { startBackgroundTasks } from './scheduler.js';
import { fetchAllActiveSources } from './ingestion/rssParser.js';
import { processArticlesIntoClusters } from './ingestion/clustering.js';
import { runGoogleCatalogSync } from './integrations/google/discovery.js';
import './database/seedSources.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3001', 10);
const distClientPath = path.resolve(process.cwd(), 'dist');

import { db, logSystemError } from './database/db.js';

// Process-level Crash Prevention Handlers
process.on('uncaughtException', (error) => {
  console.error('[FATAL UNCAUGHT EXCEPTION]:', error);
  try {
    logSystemError('SYSTEM', 'UNCAUGHT_EXCEPTION', error.message, error.stack);
  } catch (e) {}
});

process.on('unhandledRejection', (reason: any) => {
  console.error('[UNHANDLED PROMISE REJECTION]:', reason);
  try {
    logSystemError('SYSTEM', 'UNHANDLED_REJECTION', reason?.message || String(reason), reason?.stack);
  } catch (e) {}
});

// Production Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Production In-Memory API Rate Limiter (180 requests/minute per IP)
const ipRequestCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 180;

app.use('/api', (req, res, next) => {
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const now = Date.now();
  const clientBucket = ipRequestCounts.get(ip);

  if (!clientBucket || now > clientBucket.resetAt) {
    ipRequestCounts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }

  clientBucket.count++;
  if (clientBucket.count > MAX_REQUESTS_PER_WINDOW) {
    const retryAfterSec = Math.ceil((clientBucket.resetAt - now) / 1000);
    res.setHeader('Retry-After', retryAfterSec);
    return res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Too many requests. Please retry in ${retryAfterSec} seconds.`,
        retryAfter: retryAfterSec
      }
    });
  }

  next();
});

// Periodic rate limiter map cleanup (every 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of ipRequestCounts.entries()) {
    if (now > bucket.resetAt) {
      ipRequestCounts.delete(ip);
    }
  }
}, 10 * 60 * 1000);

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Health Check Endpoints (PRD §10)
app.get(['/health', '/health/live', '/api/health/live'], (req, res) => {
  res.json({ status: 'alive', timestamp: new Date().toISOString() });
});

app.get(['/health/ready', '/api/health/ready'], (req, res) => {
  res.json({ status: 'ready', timestamp: new Date().toISOString() });
});

app.get(['/health/database', '/api/health/database'], (req, res) => {
  try {
    const test = db.prepare('SELECT 1 as val').get() as any;
    if (test && test.val === 1) {
      return res.json({ status: 'healthy', database: 'connected', mode: 'WAL' });
    }
    res.status(500).json({ status: 'unhealthy', error: 'Database ping returned unexpected result' });
  } catch (err: any) {
    res.status(500).json({ status: 'unhealthy', error: err.message });
  }
});

app.get(['/health/rss', '/api/health/rss'], (req, res) => {
  try {
    const active = (db.prepare('SELECT COUNT(*) as c FROM sources WHERE active = 1').get() as any)?.c || 0;
    const degraded = (db.prepare('SELECT COUNT(*) as c FROM sources WHERE error_count >= 5').get() as any)?.c || 0;
    res.json({ status: 'healthy', active_sources: active, degraded_sources: degraded });
  } catch (err: any) {
    res.status(500).json({ status: 'unhealthy', error: err.message });
  }
});

app.get(['/health/llm', '/api/health/llm'], (req, res) => {
  res.json({ status: 'online', model: process.env.GEMINI_MODEL || 'gemini-2.5-flash', fallback_ready: true });
});

app.get(['/health/smtp', '/api/health/smtp'], (req, res) => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = process.env.SMTP_PORT || '465';
  res.json({ status: 'healthy', host, port, user_configured: Boolean(process.env.SMTP_USERNAME || process.env.EMAIL_TO) });
});

app.get(['/health/details', '/api/health/details'], (req, res) => {
  try {
    const sourcesCount = (db.prepare('SELECT COUNT(*) as c FROM sources WHERE active = 1').get() as any)?.c || 0;
    const articlesCount = (db.prepare('SELECT COUNT(*) as c FROM articles').get() as any)?.c || 0;
    const clustersCount = (db.prepare('SELECT COUNT(*) as c FROM story_clusters').get() as any)?.c || 0;
    const errorLogsCount = (db.prepare("SELECT COUNT(*) as c FROM system_error_logs WHERE status = 'UNRESOLVED'").get() as any)?.c || 0;
    const lastBriefing = db.prepare('SELECT briefing_date, status, sent_at FROM email_briefings ORDER BY generated_at DESC LIMIT 1').get();

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      components: {
        database: 'HEALTHY',
        rss_ingestion: Number(sourcesCount) > 0 ? 'HEALTHY' : 'DEGRADED',
        ai_service: 'ONLINE_FALLBACK_READY',
        scheduler: 'RUNNING'
      },
      metrics: {
        active_sources: sourcesCount,
        total_articles: articlesCount,
        total_clusters: clustersCount,
        unresolved_errors: errorLogsCount
      },
      last_briefing: lastBriefing || null
    });
  } catch (err: any) {
    res.status(500).json({ status: 'degraded', error: err.message });
  }
});

// API Routes
app.use('/api', apiRouter);

// API 404 Handler: Unmatched /api routes return structured JSON
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `API route ${req.originalUrl} does not exist.`
    }
  });
});

// Serve static React frontend bundle in production mode
app.use(express.static(distClientPath));

app.get('*', async (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  const fs = await import('fs');
  const indexFile = path.join(distClientPath, 'index.html');
  if (fs.existsSync(indexFile)) {
    return res.sendFile(indexFile);
  }
  next();
});

// Global Express Error Middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const reqId = Math.random().toString(36).substring(7);
  console.error(`[Express Global Error ${reqId}]:`, err.stack || err.message);
  try {
    logSystemError('EXPRESS_API', 'INTERNAL_ERROR', err.message, err.stack);
  } catch (e) {}

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected application error occurred. Service recovered safely.',
      requestId: reqId,
      timestamp: new Date().toISOString()
    }
  });
});

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`🚀 AI Intelligence Radar Backend running on http://127.0.0.1:${port}`);
  console.log(`======================================================\n`);

  // Start background cron tasks
  startBackgroundTasks();

  // Run initial ingestion and catalog sync asynchronously on startup
  setTimeout(async () => {
    console.log('[Startup] Executing initial RSS feed ingestion & Google Skills sync...');
    try {
      await runGoogleCatalogSync();
      const articles = await fetchAllActiveSources();
      processArticlesIntoClusters(articles);
    } catch (err: any) {
      console.warn('[Startup] Initial startup warning:', err.message);
    }
  }, 1500);
});

// Graceful Process Termination
const handleGracefulShutdown = (signal: string) => {
  console.log(`\n[Shutdown] Received ${signal}. Closing HTTP server and database handles...`);
  server.close(() => {
    console.log('[Shutdown] HTTP server closed cleanly.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));
