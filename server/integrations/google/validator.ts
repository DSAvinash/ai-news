// server/integrations/google/validator.ts
import { URL } from 'url';

/**
 * Domain allowlist for official Google learning properties (PRD §7.1 & §14)
 */
export const ALLOWED_GOOGLE_DOMAINS = [
  'skills.google',
  'cloud.google.com',
  'deepmind.google',
  'ai.google',
  'grow.google',
  'developers.google.com'
];

/**
 * SSRF Protection: Blocks private IP ranges, localhost, and non-HTTP protocols (PRD §15 & §74)
 */
const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,
  /^0\.0\.0\.0$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^169\.254\.\d+\.\d+$/, // Link-local / Cloud metadata endpoint
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i
];

export interface ValidationResult {
  valid: boolean;
  sanitizedUrl?: string;
  domain?: string;
  error?: string;
}

/**
 * Validates a resource URL against SSRF rules and the official Google domain allowlist.
 */
export function validateOfficialGoogleUrl(rawUrl: string): ValidationResult {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, error: 'URL is required and must be a string' };
  }

  try {
    const parsed = new URL(rawUrl.trim());

    // 1. Enforce HTTPS only (PRD §12 & §76)
    if (parsed.protocol !== 'https:') {
      return { valid: false, error: `Invalid protocol: ${parsed.protocol}. Only HTTPS is permitted.` };
    }

    const hostname = parsed.hostname.toLowerCase();

    // 2. SSRF Check: Reject loopback, private IPs, or internal hostnames
    for (const pattern of BLOCKED_HOST_PATTERNS) {
      if (pattern.test(hostname)) {
        return { valid: false, error: `SSRF Violation: Hostname ${hostname} is blocked.` };
      }
    }

    // 3. Domain Allowlist Check: Hostname must match or be a subdomain of an allowed domain
    const isAllowed = ALLOWED_GOOGLE_DOMAINS.some(
      (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`)
    );

    if (!isAllowed) {
      return {
        valid: false,
        error: `Domain ${hostname} is not in the approved Google learning domain allowlist.`
      };
    }

    return {
      valid: true,
      sanitizedUrl: parsed.toString(),
      domain: hostname
    };
  } catch (err: any) {
    return { valid: false, error: `Malformed URL: ${err.message}` };
  }
}
