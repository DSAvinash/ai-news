import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { logSystemError } from '../database/db.js';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY || '';
const configuredModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

// Resilient fallback candidate models in priority order
const MODEL_CANDIDATES = Array.from(new Set([
  configuredModel,
  'gemini-2.5-flash',
  'gemini-1.5-flash',
  'gemini-2.5-pro'
]));

let aiClient: GoogleGenAI | null = null;
if (apiKey) {
  try {
    aiClient = new GoogleGenAI({ apiKey });
  } catch (err: any) {
    console.warn('[Gemini AI] Failed to initialize Google Gen AI client:', err.message);
  }
}

let quotaExhaustedUntil = 0;
let cachedSummary: { headline: string; executive_summary: string } | null = null;
let lastSummaryTime = 0;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes cache

export interface EnrichedSummary {
  headline: string;
  summary: string;
  why_it_matters: string;
  key_points: string[];
  status: 'CONFIRMED' | 'REPORTED' | 'UNVERIFIED' | 'CONTRADICTED';
}

function safeParseJson<T>(text: string): T | null {
  try {
    const cleanText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleanText) as T;
  } catch (e) {
    return null;
  }
}

async function callGeminiWithTimeout<T>(apiCall: () => Promise<T>, timeoutMs: number = 15000): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('AI_TIMEOUT: Gemini API request timed out after 15 seconds')), timeoutMs);
  });

  try {
    const result = await Promise.race([apiCall(), timeoutPromise]);
    clearTimeout(timer!);
    return result;
  } catch (error) {
    clearTimeout(timer!);
    throw error;
  }
}

/**
 * Executes a Gemini request with automatic multi-model fallback if a model is deprecated or 404'd
 */
async function generateContentWithFallback(prompt: string, config: any = { responseMimeType: 'application/json' }) {
  if (!aiClient) return null;

  let lastError: any = null;

  for (const model of MODEL_CANDIDATES) {
    try {
      const response = await callGeminiWithTimeout(async () => {
        return await aiClient!.models.generateContent({
          model,
          contents: prompt,
          config
        });
      }, 15000);

      if (response && response.text) {
        return response.text;
      }
    } catch (err: any) {
      lastError = err;
      const isNotFound = err.message?.includes('404') || err.message?.includes('NOT_FOUND') || err.message?.includes('no longer available');
      if (isNotFound) {
        console.warn(`[Gemini AI] Model "${model}" is unavailable/deprecated. Trying next candidate in fallback chain...`);
        continue;
      }
      if (err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED')) {
        quotaExhaustedUntil = Date.now() + 60 * 60 * 1000;
        throw err;
      }
    }
  }

  throw lastError || new Error('All candidate Gemini models failed.');
}

export async function enrichClusterWithGemini(
  clusterTitle: string,
  rawArticles: Array<{ title: string; description: string; source_name: string; source_type: string }>
): Promise<EnrichedSummary | null> {
  if (!aiClient || Date.now() < quotaExhaustedUntil) {
    return null;
  }

  const prompt = `
You are an expert AI news analyst for AI Intelligence Radar.
Analyze the following cluster of news articles covering a recent AI event.

Source Articles:
${rawArticles.map((a, i) => `[Article ${i+1}] Source: ${a.source_name} (${a.source_type})\nTitle: ${a.title}\nContent: ${a.description}`).join('\n\n')}

Your Task:
Generate a strictly grounded intelligence summary in JSON format matching this schema:
{
  "headline": "Ultra concise headline (max 12 words)",
  "summary": "2-3 clear, factual sentences explaining exactly what happened.",
  "why_it_matters": "1 sharp sentence on technical or industry impact.",
  "key_points": ["Point 1", "Point 2", "Point 3"],
  "status": "CONFIRMED" | "REPORTED" | "UNVERIFIED" | "CONTRADICTED"
}

Rules:
1. NEVER invent facts or hallucinate details not mentioned in the source articles.
2. If any sources disagree, set status to "CONTRADICTED".
3. Return ONLY valid JSON.
`;

  try {
    const text = await generateContentWithFallback(prompt);
    if (!text) return null;

    const parsed = safeParseJson<EnrichedSummary>(text);
    if (parsed && parsed.headline && parsed.summary && parsed.why_it_matters && Array.isArray(parsed.key_points)) {
      return parsed;
    }
  } catch (error: any) {
    console.warn('[Gemini AI] Cluster enrichment warning:', error.message);
  }

  return null;
}

export async function generateDailyLandscapeSummary(
  topClusters: Array<{ title: string; summary: string; category: string; source: string }>
): Promise<{ headline: string; executive_summary: string }> {
  const now = Date.now();
  if (cachedSummary && (now - lastSummaryTime < CACHE_TTL_MS)) {
    return cachedSummary;
  }

  const createFallback = () => {
    if (!topClusters || topClusters.length === 0) {
      return {
        headline: 'Continuous AI monitoring is active across primary research and tech feeds.',
        executive_summary: 'Ingestion engine is tracking releases from OpenAI, Anthropic, Google DeepMind, and open-source model repositories.'
      };
    }
    const lead = topClusters[0];
    return {
      headline: `${lead.title} leads today's top AI developments.`,
      executive_summary: topClusters.slice(0, 4).map(c => `[${c.category}] ${c.title}: ${c.summary}`).join(' ')
    };
  };

  if (!aiClient || now < quotaExhaustedUntil) {
    const fb = cachedSummary || createFallback();
    cachedSummary = fb;
    lastSummaryTime = now;
    return fb;
  }

  const prompt = `
Summarize today's top AI developments into an executive brief.

Top Developments Today:
${topClusters.map((c, i) => `${i+1}. [${c.category}] ${c.title} — ${c.summary} (via ${c.source})`).join('\n')}

Generate a JSON object with:
{
  "headline": "1-sentence overarching summary of today's AI landscape",
  "executive_summary": "3-4 cohesive sentences highlighting the major themes, model releases, and breakthroughs of the day."
}
`;

  try {
    const text = await generateContentWithFallback(prompt);
    if (text) {
      const parsed = safeParseJson<{ headline: string; executive_summary: string }>(text);
      if (parsed && parsed.headline && parsed.executive_summary) {
        cachedSummary = parsed;
        lastSummaryTime = now;
        return parsed;
      }
    }
  } catch (error: any) {
    console.warn('[Gemini AI] Daily summary warning:', error.message);
    logSystemError('GEMINI_SERVICE', 'SUMMARY_FAILED', error.message);
  }

  const fb = cachedSummary || createFallback();
  cachedSummary = fb;
  lastSummaryTime = now;
  return fb;
}
