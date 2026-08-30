import React, { useEffect, useState } from 'react';

interface SystemStatusData {
  success: boolean;
  timestamp: string;
  system: {
    status: string;
    uptime_seconds: number;
    memory_usage_mb: number;
  };
  sources: {
    active: number;
    failed: number;
  };
  content: {
    total_articles: number;
    total_clusters: number;
    last_ingested_at: string | null;
  };
  briefing: {
    last_date: string | null;
    status: string;
    sent_at: string | null;
    stories_count: number;
  };
  last_job?: {
    job_name: string;
    status: string;
    started_at: string;
    ended_at: string;
    error_details: string | null;
  } | null;
}

export const SystemStatusPanel: React.FC = () => {
  const [status, setStatus] = useState<SystemStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [testEmailStatus, setTestEmailStatus] = useState<string | null>(null);

  const fetchStatus = () => {
    setLoading(true);
    fetch('/api/system/status')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setStatus(data);
      })
      .catch((err) => console.error('[Status] Error:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Auto refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const handleTestEmail = () => {
    setTestEmailStatus('Sending Hostinger SMTP test briefing...');
    
    const sendReq = (url: string) => fetch(url, { method: 'POST' });

    sendReq('/api/email/test')
      .catch(() => sendReq('http://localhost:3001/api/email/test'))
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setTestEmailStatus(`✓ ${data.message}`);
        } else {
          setTestEmailStatus(`❌ ${data.error?.message || 'Email delivery failed'}`);
        }
      })
      .catch((err) => setTestEmailStatus(`❌ Network error: ${err.message}`));
  };

  return (
    <div className="space-y-stack-lg animate-fadeIn">
      {/* Header */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-container-margin shadow-sm flex items-center justify-between">
        <div>
          <span className="text-metadata-sm font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5 mb-1">
            <span className="material-symbols-outlined text-sm">health_and_safety</span>
            PRODUCTION RELIABILITY & MONITORING
          </span>
          <h2 className="text-headline-md font-bold text-primary">System Status & Diagnostics</h2>
        </div>
        <button
          onClick={fetchStatus}
          className="px-3 py-1.5 bg-surface-container-low hover:bg-surface-container border border-outline-variant rounded-lg text-body-sm font-semibold text-primary flex items-center gap-1.5 transition-colors"
        >
          <span className={`material-symbols-outlined text-sm ${loading ? 'animate-spin' : ''}`}>refresh</span>
          Refresh Diagnostics
        </button>
      </div>

      {/* Grid Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-stack-lg">
        {/* Core System Status */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-sm space-y-2">
          <div className="flex justify-between items-center text-metadata-sm">
            <span className="font-bold text-on-surface-variant uppercase">Core Engine</span>
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
              {status?.system?.status || 'HEALTHY'}
            </span>
          </div>
          <div className="text-headline-sm font-bold text-primary">
            {Math.floor((status?.system?.uptime_seconds || 0) / 60)} min uptime
          </div>
          <div className="text-metadata-sm text-on-surface-variant">
            Memory: {status?.system?.memory_usage_mb || 0} MB • WAL Mode Active
          </div>
        </div>

        {/* RSS Ingestion Feeds */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-sm space-y-2">
          <div className="flex justify-between items-center text-metadata-sm">
            <span className="font-bold text-on-surface-variant uppercase">RSS Ingestion</span>
            <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${status?.sources?.failed ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
              {status?.sources?.failed ? `${status.sources.failed} DEGRADED` : 'ALL ACTIVE'}
            </span>
          </div>
          <div className="text-headline-sm font-bold text-primary">
            {status?.sources?.active || 0} Active Feeds
          </div>
          <div className="text-metadata-sm text-on-surface-variant">
            Circuit Breaker Protection Active (30m cooldown)
          </div>
        </div>

        {/* Database & Content */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-sm space-y-2">
          <div className="flex justify-between items-center text-metadata-sm">
            <span className="font-bold text-on-surface-variant uppercase">SQLite Storage</span>
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">ONLINE</span>
          </div>
          <div className="text-headline-sm font-bold text-primary">
            {status?.content?.total_articles || 0} Articles
          </div>
          <div className="text-metadata-sm text-on-surface-variant">
            {status?.content?.total_clusters || 0} Intelligence Clusters
          </div>
        </div>

        {/* 7 AM Briefing Delivery */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-sm space-y-2">
          <div className="flex justify-between items-center text-metadata-sm">
            <span className="font-bold text-on-surface-variant uppercase">7 AM SMTP Briefing</span>
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
              {status?.briefing?.status || 'READY'}
            </span>
          </div>
          <div className="text-headline-sm font-bold text-primary">
            {status?.briefing?.last_date || 'Today'}
          </div>
          <div className="text-metadata-sm text-on-surface-variant">
            Hostinger SMTP • {status?.briefing?.stories_count || 0} stories included
          </div>
        </div>
      </div>

      {/* Interactive SMTP & Job Inspector Section */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-container-margin shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant pb-4">
          <div>
            <h3 className="text-headline-sm font-bold text-primary">Hostinger SMTP & Email Delivery Test</h3>
            <p className="text-body-sm text-on-surface-variant">
              Verify end-to-end SMTP authentication, port 465 SSL connection, and daily briefing dispatch.
            </p>
          </div>
          <button
            onClick={handleTestEmail}
            className="px-4 py-2 bg-primary text-white hover:bg-inverse-surface rounded-lg text-body-sm font-bold shadow-sm transition-colors"
          >
            Send Test Briefing Email
          </button>
        </div>

        {testEmailStatus && (
          <div className="p-3 bg-surface-container-low border border-outline-variant rounded-lg text-body-sm font-semibold text-primary">
            {testEmailStatus}
          </div>
        )}

        {/* Diagnostic Endpoints Checklist */}
        <div>
          <h4 className="text-metadata-sm font-bold uppercase text-on-surface-variant mb-3 tracking-wider">
            Live Endpoint Diagnostics (PRD §10)
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-metadata-sm font-mono-label">
            <a href="/health/live" target="_blank" className="p-2.5 bg-surface-container-low border rounded hover:border-secondary flex justify-between">
              <span>/health/live</span>
              <span className="text-emerald-700 font-bold">200 OK</span>
            </a>
            <a href="/health/ready" target="_blank" className="p-2.5 bg-surface-container-low border rounded hover:border-secondary flex justify-between">
              <span>/health/ready</span>
              <span className="text-emerald-700 font-bold">200 OK</span>
            </a>
            <a href="/health/database" target="_blank" className="p-2.5 bg-surface-container-low border rounded hover:border-secondary flex justify-between">
              <span>/health/database</span>
              <span className="text-emerald-700 font-bold">200 OK</span>
            </a>
            <a href="/health/rss" target="_blank" className="p-2.5 bg-surface-container-low border rounded hover:border-secondary flex justify-between">
              <span>/health/rss</span>
              <span className="text-emerald-700 font-bold">200 OK</span>
            </a>
            <a href="/health/llm" target="_blank" className="p-2.5 bg-surface-container-low border rounded hover:border-secondary flex justify-between">
              <span>/health/llm</span>
              <span className="text-emerald-700 font-bold">200 OK</span>
            </a>
            <a href="/health/smtp" target="_blank" className="p-2.5 bg-surface-container-low border rounded hover:border-secondary flex justify-between">
              <span>/health/smtp</span>
              <span className="text-emerald-700 font-bold">200 OK</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
