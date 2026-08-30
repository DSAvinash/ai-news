import fs from 'fs';
import path from 'path';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  operation: string;
  job_id?: string;
  message: string;
  error_message?: string;
  stack_trace?: string;
  source_url?: string;
  retry_count?: number;
  duration_ms?: number;
}

const LOG_DIR = path.resolve(process.cwd(), 'logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}
const LOG_FILE = path.join(LOG_DIR, 'application.log');

/**
 * Mask sensitive credentials like API keys, PATs, and SMTP passwords from logs
 */
export function maskSecrets(input: string): string {
  if (!input) return '';
  return input
    .replace(/sbp_[a-f0-9]{30,}/gi, 'sbp_********************')
    .replace(/AQ\.[a-zA-Z0-9_-]{25,}/g, 'AQ.********************')
    .replace(/evqb\s*cpws\s*oovw\s*vvxf/gi, '**** **** **** ****')
    .replace(/key=[^&]+/gi, 'key=REDACTED')
    .replace(/password[:=]\s*["']?[^"'\s]+["']?/gi, 'password=REDACTED')
    .replace(/bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer REDACTED');
}

export function logEvent(entry: Omit<LogEntry, 'timestamp'>) {
  const timestamp = new Date().toISOString();
  const safeMessage = maskSecrets(entry.message);
  const safeError = entry.error_message ? maskSecrets(entry.error_message) : undefined;
  const safeStack = entry.stack_trace ? maskSecrets(entry.stack_trace) : undefined;

  const fullEntry: LogEntry = {
    ...entry,
    timestamp,
    message: safeMessage,
    error_message: safeError,
    stack_trace: safeStack
  };

  const formattedStr = `[${timestamp}] [${entry.level}] [${entry.component}:${entry.operation}]${entry.job_id ? ` [JOB:${entry.job_id}]` : ''} ${safeMessage}${safeError ? ` | Error: ${safeError}` : ''}`;

  if (entry.level === 'ERROR' || entry.level === 'CRITICAL') {
    console.error(formattedStr);
  } else if (entry.level === 'WARNING') {
    console.warn(formattedStr);
  } else {
    console.log(formattedStr);
  }

  // Append to application log file safely
  try {
    fs.appendFileSync(LOG_FILE, JSON.stringify(fullEntry) + '\n', 'utf-8');
  } catch (e) {
    // Silent fallback to console
  }
}

export const logger = {
  debug: (component: string, operation: string, message: string, meta: Partial<LogEntry> = {}) =>
    logEvent({ level: 'DEBUG', component, operation, message, ...meta }),
  info: (component: string, operation: string, message: string, meta: Partial<LogEntry> = {}) =>
    logEvent({ level: 'INFO', component, operation, message, ...meta }),
  warn: (component: string, operation: string, message: string, meta: Partial<LogEntry> = {}) =>
    logEvent({ level: 'WARNING', component, operation, message, ...meta }),
  error: (component: string, operation: string, message: string, meta: Partial<LogEntry> = {}) =>
    logEvent({ level: 'ERROR', component, operation, message, ...meta }),
  critical: (component: string, operation: string, message: string, meta: Partial<LogEntry> = {}) =>
    logEvent({ level: 'CRITICAL', component, operation, message, ...meta })
};
