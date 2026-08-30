import React, { useEffect, useState } from 'react';

export const NewsPipelineAdmin: React.FC = () => {
  const [pipelineStats, setPipelineStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [testResult, setTestResult] = useState<any>(null);
  const [dryRun, setDryRun] = useState(false);
  const [testing, setTesting] = useState(false);

  const fetchPipelineData = () => {
    setLoading(true);
    fetch('/api/admin/pipeline')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setPipelineStats(data.data);
      })
      .catch((err) => console.error('[PipelineAdmin] Error loading:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPipelineData();
  }, []);

  const handleRunTestBriefing = async () => {
    setTesting(true);
    setTestResult(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const endpoint = (dryRun || previewOnly) ? '/api/test-email' : '/api/email/test';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun, previewOnly }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      let data: any = {};
      try {
        data = await res.json();
      } catch (e) {}

      if (res.ok && data.success) {
        setTestResult(data);
      } else {
        const errMsg = data.error?.message || data.message || `Server responded with status ${res.status}`;
        setTestResult({ success: false, message: `Email test failed: ${errMsg}` });
      }
      fetchPipelineData();
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        setTestResult({ success: false, message: 'Email test failed: Request timed out after 15 seconds.' });
      } else {
        setTestResult({ success: false, message: 'Email test failed: Unable to reach backend server. Please verify the application is running.' });
      }
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-stack-lg animate-fadeIn">
      <div className="border-b border-outline-variant pb-stack-md flex justify-between items-center">
        <div>
          <h2 className="text-headline-md font-bold text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">insights</span>
            News Pipeline & Freshness Debugger
          </h2>
          <p className="text-body-sm text-on-surface-variant">
            3-Layer Deduplication (Article, Content, Event), Repetition Penalties, and Audit Log.
          </p>
        </div>
        <button
          onClick={fetchPipelineData}
          className="px-3 py-1.5 border border-outline-variant bg-surface hover:bg-surface-container-low rounded text-metadata-sm font-medium transition-colors flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-[16px]">refresh</span> Refresh Audit
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-on-surface-variant text-body-sm flex flex-col items-center justify-center gap-2">
          <span className="material-symbols-outlined text-secondary text-3xl animate-spin">radar</span>
          <span>Auditing news pipeline delivery state...</span>
        </div>
      ) : (
        <div className="space-y-stack-lg">
          {/* Pipeline Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-stack-md">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-container-margin shadow-sm">
              <div className="text-metadata-sm text-on-surface-variant font-mono-label mb-1">Articles Scanned</div>
              <div className="text-display-sm font-bold text-primary">{pipelineStats?.articles_scanned || 0}</div>
              <div className="text-metadata-sm text-green-700 mt-1 font-medium">Level 1 Normalization Active</div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-container-margin shadow-sm">
              <div className="text-metadata-sm text-on-surface-variant font-mono-label mb-1">Events Clustered</div>
              <div className="text-display-sm font-bold text-secondary">{pipelineStats?.events_clustered || 0}</div>
              <div className="text-metadata-sm text-secondary mt-1 font-medium">Level 2 Content Clustering</div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-container-margin shadow-sm">
              <div className="text-metadata-sm text-on-surface-variant font-mono-label mb-1">Delivered Events</div>
              <div className="text-display-sm font-bold text-amber-600">{pipelineStats?.delivered_events_count || 0}</div>
              <div className="text-metadata-sm text-amber-700 mt-1 font-medium">Level 3 Repetition Penalty</div>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-container-margin shadow-sm">
              <div className="text-metadata-sm text-on-surface-variant font-mono-label mb-1">Early Signals</div>
              <div className="text-display-sm font-bold text-purple-600">{pipelineStats?.early_signals_count || 0}</div>
              <div className="text-metadata-sm text-purple-700 mt-1 font-medium">Unconfirmed Watching</div>
            </div>
          </div>

          {/* Test Briefing Trigger & Dry Run Controls */}
          <div className="bg-surface-container-lowest border border-secondary/30 rounded-lg p-container-margin shadow-sm space-y-stack-md">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-headline-sm font-bold text-primary flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">science</span>
                  Manual Briefing Test & Dry-Run Mode
                </h3>
                <p className="text-body-sm text-on-surface-variant">
                  Evaluate the Freshness Engine and test email delivery without altering persistent delivery records.
                </p>
              </div>

              <label className="flex items-center gap-2 cursor-pointer bg-surface-container-low px-3 py-1.5 rounded border border-outline-variant select-none">
                <input
                  type="checkbox"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                  className="rounded text-secondary focus:ring-secondary"
                />
                <span className="text-body-sm font-bold text-primary">Dry Run Mode (Do not alter DB state)</span>
              </label>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleRunTestBriefing}
                disabled={testing}
                className="px-4 py-2 bg-primary text-white hover:bg-inverse-surface rounded-lg text-body-sm font-bold transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                <span className={`material-symbols-outlined text-sm ${testing ? 'animate-spin' : ''}`}>
                  {testing ? 'sync' : 'forward_to_inbox'}
                </span>
                {testing ? 'Evaluating Freshness Engine...' : 'Generate & Send Test Briefing'}
              </button>

              <a
                href="/api/latest-briefing-html"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-surface-container-low border border-outline-variant hover:bg-surface-container text-primary rounded-lg text-body-sm font-semibold transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">visibility</span>
                Preview HTML Briefing ↗
              </a>
            </div>

            {testResult && (
              <div
                className={`p-stack-md rounded-lg text-body-sm font-medium border ${
                  testResult.success
                    ? 'bg-green-50 text-green-900 border-green-200'
                    : 'bg-red-50 text-red-900 border-red-200'
                }`}
              >
                <div className="font-bold flex items-center gap-1 mb-1">
                  <span className="material-symbols-outlined text-sm">
                    {testResult.success ? 'check_circle' : 'error'}
                  </span>
                  {testResult.success ? 'Briefing Result' : 'Error'}
                </div>
                <div>{testResult.message}</div>
              </div>
            )}
          </div>

          {/* Last Briefing Status Card */}
          {pipelineStats?.last_briefing && (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-container-margin shadow-sm">
              <h3 className="text-headline-sm font-bold text-primary mb-stack-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">history</span>
                Last Daily Briefing Execution
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-stack-md text-body-sm text-on-surface-variant pt-2 border-t border-outline-variant">
                <div>
                  <span className="text-metadata-sm uppercase font-mono-label block">Status</span>
                  <span className="font-bold text-primary px-2 py-0.5 rounded bg-green-100 text-green-800 text-xs inline-block mt-0.5">
                    {pipelineStats.last_briefing.status}
                  </span>
                </div>
                <div>
                  <span className="text-metadata-sm uppercase font-mono-label block">Generated At</span>
                  <span className="font-semibold text-primary">{pipelineStats.last_briefing.generated_at}</span>
                </div>
                <div>
                  <span className="text-metadata-sm uppercase font-mono-label block">Idempotency Key</span>
                  <span className="font-mono-label text-xs text-primary">{pipelineStats.last_briefing.idempotency_key}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
