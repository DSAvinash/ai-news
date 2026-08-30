// server/integrations/google/normalizer.ts
import { URL } from 'url';
import crypto from 'crypto';

const TRACKING_QUERY_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
  'ref',
  'qlcampaign',
  'source'
];

/**
 * Normalizes an official Google URL into its canonical form by stripping tracking and extra formatting (PRD §13 & §22)
 */
export function canonicalizeUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl.trim());
    
    // Lowercase hostname and protocol
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase();

    // Remove tracking parameters
    for (const param of TRACKING_QUERY_PARAMS) {
      parsed.searchParams.delete(param);
    }

    // Sort remaining search parameters for deterministic URL identity
    parsed.searchParams.sort();

    // Strip trailing slash on path (unless it's just root '/')
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }

    // Strip fragments
    parsed.hash = '';

    return parsed.toString();
  } catch {
    return rawUrl.trim();
  }
}

export interface FingerprintInput {
  canonical_url: string;
  title: string;
  description?: string | null;
  resource_type?: string;
  difficulty?: string;
  duration?: string;
  skills?: string[];
}

/**
 * Generates a deterministic SHA-256 fingerprint from normalized resource metadata for change detection (PRD §17 & §20)
 */
export function computeContentHash(input: FingerprintInput): string {
  const normUrl = canonicalizeUrl(input.canonical_url);
  const normTitle = (input.title || '').trim().toLowerCase();
  const normDesc = (input.description || '').trim().toLowerCase();
  const normType = (input.resource_type || 'COURSE').trim().toUpperCase();
  const normDiff = (input.difficulty || 'Beginner').trim().toLowerCase();
  const normDur = (input.duration || '').trim().toLowerCase();
  const normSkills = (input.skills || []).map((s) => s.trim().toLowerCase()).sort().join(',');

  const payload = `${normUrl}|${normTitle}|${normDesc}|${normType}|${normDiff}|${normDur}|${normSkills}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}
