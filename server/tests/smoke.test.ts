// server/tests/smoke.test.ts
import { db } from '../database/db.js';
import { getPersonalizedRecommendations, getUserSkillProfile, analyzeUserSkillGaps } from '../skills/googleSkillsEngine.js';
import { getSkillRecommendations, recalculateSkillMomentum } from '../skills/skillEngine.js';
import { calculateTopicMomentum } from '../ingestion/topicEngine.js';
import { validateOfficialGoogleUrl } from '../integrations/google/validator.js';
import { canonicalizeUrl, computeContentHash } from '../integrations/google/normalizer.js';
import { getStreamMetrics } from '../notifications/eventStream.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

async function runSuite() {
  console.log('\n========================================');
  console.log('🧪 AI Intelligence Radar — Production Smoke Test Suite');
  console.log('========================================\n');

  // 1. Database & Schema Health
  console.log('📦 1. Database & Schema Integrity:');
  const tableCheck = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name IN (
      'story_clusters', 'articles', 'skills', 'learning_resources', 'topics',
      'google_skills_catalog', 'google_skill_mappings', 'user_skills', 'notifications'
    )
  `).all() as any[];
  assert(tableCheck.length === 9, 'Core Database Tables Exist', `Found ${tableCheck.length}/9 tables`);

  const userSkillsCols = db.prepare('PRAGMA table_info(user_skills)').all() as any[];
  const hasProficiency = userSkillsCols.some(c => c.name === 'proficiency_level');
  assert(hasProficiency, 'user_skills table has proficiency_level column');

  // 2. Google Skills Recommendation Engine
  console.log('\n🎯 2. Google Skills Engine & Personalization:');
  const userProfile = getUserSkillProfile('default_user');
  assert(Boolean(userProfile && Array.isArray(userProfile.skills)), 'User skill profile retrieved');

  const recs = getPersonalizedRecommendations('default_user', { limit: 5 });
  assert(Array.isArray(recs) && recs.length > 0, 'Personalized recommendations generated', `Count: ${recs.length}`);
  if (recs.length > 0) {
    assert(typeof recs[0].recommendation_score === 'number', 'Recommendation has calculated score');
    assert(Array.isArray(recs[0].recommendation_reasons), 'Recommendation includes explainability reasons');
  }

  // Gap Analysis Verification
  const gaps = analyzeUserSkillGaps('default_user');
  assert(Array.isArray(gaps), 'User skill gaps computed', `Gaps count: ${gaps.length}`);

  // 3. Skill Radar & Topic Engine
  console.log('\n📊 3. Skill Radar & Topic Engines:');
  recalculateSkillMomentum(true);
  const skillRecs = getSkillRecommendations('default_user');
  assert(Boolean(skillRecs.hero_skill), 'Skill radar identified hero skill');

  const topicMomentum = calculateTopicMomentum(1);
  assert(typeof topicMomentum === 'number' && topicMomentum >= 0, 'Topic momentum calculated without error');

  // 4. Security & SSRF URL Validator
  console.log('\n🛡️ 4. Security & SSRF Protections:');
  const validUrl = validateOfficialGoogleUrl('https://skills.google/paths?pathslistid=ai');
  assert(validUrl.valid === true, 'Allowed official Google domain accepted');

  const blockedLocalhost = validateOfficialGoogleUrl('https://localhost/admin');
  assert(blockedLocalhost.valid === false, 'Blocked localhost SSRF attempt');

  const blockedIp = validateOfficialGoogleUrl('https://169.254.169.254/latest/meta-data/');
  assert(blockedIp.valid === false, 'Blocked cloud metadata endpoint SSRF attempt');

  const blockedHttp = validateOfficialGoogleUrl('http://skills.google/paths');
  assert(blockedHttp.valid === false, 'Blocked insecure HTTP protocol');

  // 5. Normalizer & Fingerprinting
  console.log('\n🔒 5. URL Normalization & Content Hashing:');
  const canon = canonicalizeUrl('https://skills.google/paths?utm_source=twitter&pathslistid=ai#top');
  assert(!canon.includes('utm_source'), 'Tracking parameters stripped in canonical URL');

  const hash1 = computeContentHash({ canonical_url: canon, title: 'AI Course' });
  const hash2 = computeContentHash({ canonical_url: canon, title: 'AI Course' });
  assert(hash1 === hash2, 'Content fingerprinting is deterministic');

  // 6. Real-Time Event Stream Broker
  console.log('\n📡 6. Real-Time Event Stream Broker:');
  const streamMetrics = getStreamMetrics();
  assert(streamMetrics.status === 'OPERATIONAL', 'SSE Stream Broker is operational');
  assert(typeof streamMetrics.active_subscribers === 'number', 'Subscriber counter active');

  console.log('\n========================================');
  console.log(`🏁 Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('[Test Runner Fatal]:', err);
  process.exit(1);
});
