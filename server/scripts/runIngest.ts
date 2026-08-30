import { fetchAllActiveSources } from '../ingestion/rssParser.js';
import { processArticlesIntoClusters } from '../ingestion/clustering.js';
import '../database/seedSources.js';

async function run() {
  console.log('[CLI Ingest] Triggering manual RSS ingestion pipeline...');
  const articles = await fetchAllActiveSources();
  console.log(`[CLI Ingest] Processing ${articles.length} articles into story clusters...`);
  processArticlesIntoClusters(articles);
  console.log('[CLI Ingest] Ingestion complete.');
  process.exit(0);
}

run();
