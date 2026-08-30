import React, { useEffect, useState } from 'react';
import { MonitoredSource } from '../types';
import { Sliders, Plus, Mail, RefreshCw, CheckCircle, AlertTriangle, ShieldCheck, Database } from 'lucide-react';

export const AdminPanel: React.FC = () => {
  const [sources, setSources] = useState<MonitoredSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [ingesting, setIngesting] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [ingestStatus, setIngestStatus] = useState<string | null>(null);

  // New source form state
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [rssUrl, setRssUrl] = useState('');
  const [sourceType, setSourceType] = useState<'PRIMARY' | 'CREDIBLE_NEWS' | 'DISCOVERY' | 'COMMUNITY'>('PRIMARY');
  const [reliabilityScore, setReliabilityScore] = useState(0.85);

  const fetchSources = () => {
    setLoading(true);
    fetch('/api/sources')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setSources(data.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSources();
  }, []);

  const handleAddSource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !rssUrl) return;

    fetch('/api/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, url, rss_url: rssUrl, source_type: sourceType, reliability_score: reliabilityScore })
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setName('');
          setUrl('');
          setRssUrl('');
          fetchSources();
        }
      });
  };

  const handleTriggerIngest = () => {
    setIngesting(true);
    setIngestStatus('Ingesting feeds and clustering stories...');
    fetch('/api/ingest', { method: 'POST' })
      .then((res) => res.json())
      .then((data) => {
        setIngestStatus(data.message || 'Ingestion completed successfully.');
      })
      .catch((err) => setIngestStatus(`Ingestion failed: ${err.message}`))
      .finally(() => setIngesting(false));
  };

  const handleTestEmail = () => {
    setSendingEmail(true);
    setEmailStatus('Sending Hostinger SMTP test email...');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const sendReq = (url: string) =>
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal
      });

    sendReq('/api/email/test')
      .catch(() => sendReq('http://localhost:3001/api/email/test'))
      .then(async (res) => {
        clearTimeout(timeoutId);
        let data: any = {};
        try {
          data = await res.json();
        } catch (e) {}

        if (res.ok && data.success) {
          setEmailStatus(`✓ ${data.message || 'Test email sent successfully!'}`);
        } else {
          const errMsg = data.error?.message || data.message || `Server responded with status ${res.status}`;
          setEmailStatus(`Email test failed: ${errMsg}`);
        }
      })
      .catch((err: any) => {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          setEmailStatus('Email test failed: SMTP connection timed out after 15 seconds.');
        } else {
          setEmailStatus('Email test failed: Unable to reach backend server. Please verify the application is running.');
        }
      })
      .finally(() => setSendingEmail(false));
  };

  return (
    <div className="space-y-6">
      {/* System Quick Actions Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Ingestion Engine Controls */}
        <div className="glass-card rounded-2xl p-5 border border-slate-800">
          <div className="flex items-center gap-2 mb-3">
            <RefreshCw className="w-5 h-5 text-sky-400" />
            <h3 className="text-base font-bold text-white">Manual Ingestion Trigger</h3>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Immediately trigger all monitored RSS/Atom sources, deduplicate content, score items, and update clusters.
          </p>
          <button
            onClick={handleTriggerIngest}
            disabled={ingesting}
            className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-lg shadow-sky-500/20 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${ingesting ? 'animate-spin' : ''}`} />
            {ingesting ? 'Running Ingestion Pipeline...' : 'Run RSS Ingestion Now'}
          </button>
          {ingestStatus && (
            <div className="mt-3 text-xs text-sky-300 bg-sky-950/40 p-2.5 rounded-lg border border-sky-500/20 font-mono">
              {ingestStatus}
            </div>
          )}
        </div>

        {/* Hostinger SMTP Tester */}
        <div className="glass-card rounded-2xl p-5 border border-slate-800">
          <div className="flex items-center gap-2 mb-3">
            <Mail className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">Hostinger SMTP Daily Email Tester</h3>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Send an instant test AI Intelligence Briefing to your configured recipient via Hostinger SMTP.
          </p>
          <button
            onClick={handleTestEmail}
            disabled={sendingEmail}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
          >
            <Mail className={`w-4 h-4 ${sendingEmail ? 'animate-bounce' : ''}`} />
            {sendingEmail ? 'Sending SMTP Briefing...' : 'Send Test Briefing Email Now'}
          </button>
          {emailStatus && (
            <div className="mt-3 text-xs text-amber-300 bg-amber-950/40 p-2.5 rounded-lg border border-amber-500/20 font-mono flex flex-col gap-2">
              <span>{emailStatus}</span>
              <a
                href="/api/latest-briefing-html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-400 underline font-semibold flex items-center gap-1"
              >
                🔗 Preview Generated HTML Briefing in Browser →
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Add New Source Form */}
      <div className="glass-card rounded-2xl p-5 border border-slate-800">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-indigo-400" /> Add Monitored RSS Feed
        </h3>

        <form onSubmit={handleAddSource} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            placeholder="Source Name (e.g. OpenAI Newsroom)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-slate-900 text-xs text-slate-100 placeholder-slate-500 rounded-lg p-2.5 border border-slate-800 focus:outline-none focus:border-sky-500"
            required
          />

          <input
            type="url"
            placeholder="Official Website URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="bg-slate-900 text-xs text-slate-100 placeholder-slate-500 rounded-lg p-2.5 border border-slate-800 focus:outline-none focus:border-sky-500"
          />

          <input
            type="url"
            placeholder="RSS / Atom Feed URL"
            value={rssUrl}
            onChange={(e) => setRssUrl(e.target.value)}
            className="bg-slate-900 text-xs text-slate-100 placeholder-slate-500 rounded-lg p-2.5 border border-slate-800 focus:outline-none focus:border-sky-500"
            required
          />

          <select
            value={sourceType}
            onChange={(e: any) => setSourceType(e.target.value)}
            className="bg-slate-900 text-xs text-slate-100 rounded-lg p-2.5 border border-slate-800 focus:outline-none focus:border-sky-500"
          >
            <option value="PRIMARY">PRIMARY (1.00 Trust)</option>
            <option value="CREDIBLE_NEWS">CREDIBLE_NEWS (0.85 Trust)</option>
            <option value="DISCOVERY">DISCOVERY (0.70 Trust)</option>
            <option value="COMMUNITY">COMMUNITY (0.60 Trust)</option>
          </select>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Reliability Score:</span>
            <input
              type="number"
              step="0.05"
              min="0.10"
              max="1.00"
              value={reliabilityScore}
              onChange={(e) => setReliabilityScore(parseFloat(e.target.value))}
              className="w-20 bg-slate-900 text-xs text-slate-100 rounded-lg p-2 border border-slate-800 font-mono"
            />
          </div>

          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" /> Add Source
          </button>
        </form>
      </div>

      {/* Sources List Table */}
      <div className="glass-card rounded-2xl p-5 border border-slate-800">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <Database className="w-5 h-5 text-emerald-400" /> Monitored Sources ({sources.length})
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3">Source Name</th>
                <th className="p-3">Type</th>
                <th className="p-3">Reliability</th>
                <th className="p-3">Status</th>
                <th className="p-3">Last Checked</th>
                <th className="p-3">Errors</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {sources.map((src) => (
                <tr key={src.id} className="hover:bg-slate-900/40">
                  <td className="p-3 font-semibold text-slate-100">
                    <a href={src.url} target="_blank" rel="noopener noreferrer" className="hover:text-sky-400">
                      {src.name}
                    </a>
                    <div className="text-[10px] text-slate-500 truncate max-w-xs">{src.rss_url}</div>
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                      {src.source_type}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-emerald-400 font-bold">
                    {(src.reliability_score * 100).toFixed(0)}%
                  </td>
                  <td className="p-3">
                    {src.error_count === 0 ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                        <CheckCircle className="w-3.5 h-3.5" /> Healthy
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-400 font-semibold">
                        <AlertTriangle className="w-3.5 h-3.5" /> Warnings ({src.error_count})
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-slate-400 font-mono">
                    {src.last_checked ? new Date(src.last_checked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending'}
                  </td>
                  <td className="p-3 font-mono text-slate-400">{src.error_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
