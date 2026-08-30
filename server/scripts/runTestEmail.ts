import { sendDailyBriefingEmail } from '../email/emailService.js';
import '../database/seedSources.js';

async function run() {
  console.log('[CLI Email] Triggering test daily briefing email...');
  const result = await sendDailyBriefingEmail();
  console.log('[CLI Email] Result:', result);
  process.exit(result.success ? 0 : 1);
}

run();
