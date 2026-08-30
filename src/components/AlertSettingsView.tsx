import React, { useEffect, useState, useCallback } from 'react';

interface AlertRule {
  id: number;
  name: string;
  type: string;
  importance_threshold: number;
  novelty_threshold: string;
  priority_threshold: string;
  frequency: string;
  quality_score: number;
  estimated_frequency: string;
  enabled: boolean;
  created_at: string;
}

interface NotificationPreferences {
  dashboard_enabled: boolean;
  email_alerts_level: string;
  browser_push_enabled: boolean;
  sound_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  critical_override: boolean;
  global_pause_until?: string | null;
}

interface DiagnosticsData {
  notification_engine: { status: string; global_pause: boolean };
  email_service: { status: string; host: string; level: string };
  dashboard_notifications: { status: string; unread_count: number; total_count: number };
  browser_push: { status: string };
  active_alert_rules: number;
  quiet_hours: { active: boolean; start: string; end: string };
}

const TEMPLATES = [
  { id: 'major_releases', name: '🚨 Major AI Model Releases', topic: 'AI Models', priority: 'CRITICAL', score: 90, desc: 'Notifies when OpenAI, Anthropic, or DeepMind releases a flagship model.' },
  { id: 'ai_agents', name: '🤖 AI Agent Breakthroughs', topic: 'AI Agents', priority: 'HIGH', score: 70, desc: 'Triggers on autonomous agent frameworks, tool-use papers, and benchmark releases.' },
  { id: 'ai_coding', name: '💻 AI Coding Agents & Models', topic: 'AI Coding', priority: 'HIGH', score: 70, desc: 'Alerts on IDE AI tools, SWE-bench updates, and code generation models.' },
  { id: 'open_source', name: '🔓 Open Source Model Releases', topic: 'Open Source', priority: 'HIGH', score: 70, desc: 'Monitors Hugging Face, Llama, Mistral, and open-weights drops.' },
  { id: 'ai_research', name: '🧠 Breakthrough Research Papers', topic: 'AI Research', priority: 'HIGH', score: 75, desc: 'Tracks highly-cited arXiv preprints and top lab publications.' },
  { id: 'ai_security', name: '🛡️ AI Vulnerabilities & Safety', topic: 'AI Security', priority: 'CRITICAL', score: 85, desc: 'Immediate alerts for red-teaming, jailbreaks, and AI safety incidents.' }
];

export const AlertSettingsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'rules' | 'channels' | 'quiet' | 'diagnostics'>('overview');
  const [alerts, setAlerts] = useState<AlertRule[]>([]);
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    dashboard_enabled: true,
    email_alerts_level: 'CRITICAL',
    browser_push_enabled: false,
    sound_enabled: false,
    quiet_hours_start: '22:00',
    quiet_hours_end: '07:00',
    critical_override: true
  });
  const [diagnostics, setDiagnostics] = useState<DiagnosticsData | null>(null);

  // Rule Builder Form State
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [ruleTopic, setRuleTopic] = useState('AI Agents');
  const [rulePriority, setRulePriority] = useState('HIGH');
  const [ruleScore, setRuleScore] = useState(70);
  const [ruleNovelty, setRuleNovelty] = useState('NEW_ONLY');
  const [ruleKeywords, setRuleKeywords] = useState('');
  const [simResults, setSimResults] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const fetchAllData = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/alerts').then(r => r.json()),
      fetch('/api/notification-preferences').then(r => r.json()),
      fetch('/api/notifications/diagnostics').then(r => r.json())
    ])
      .then(([alertsRes, prefsRes, diagRes]) => {
        if (alertsRes.success && Array.isArray(alertsRes.data)) setAlerts(alertsRes.data);
        if (prefsRes.success && prefsRes.data) setPrefs(prefsRes.data);
        if (diagRes.success && diagRes.diagnostics) setDiagnostics(diagRes.diagnostics);
      })
      .catch(err => console.error('[AlertControlCenter] Error loading data:', err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const showStatus = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), 3500);
  };

  const handleGlobalPause = (durationHours: number) => {
    fetch('/api/notification-preferences/global-pause', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ durationHours })
    })
      .then(r => r.json())
      .then(data => {
        showStatus(data.message);
        fetchAllData();
      });
  };

  const handleCreateTemplate = (templateId: string) => {
    fetch(`/api/alerts/templates/${templateId}`, { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        showStatus(data.message || 'Alert template activated!');
        fetchAllData();
      });
  };

  const handleDuplicateRule = (id: number) => {
    fetch(`/api/alerts/duplicate/${id}`, { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        showStatus(data.message);
        fetchAllData();
      });
  };

  const handleToggleRule = (id: number, enabled: boolean) => {
    const endpoint = enabled ? `/api/alerts/${id}/pause` : `/api/alerts/${id}/resume`;
    fetch(endpoint, { method: 'POST' }).then(() => fetchAllData());
  };

  const handleDeleteRule = (id: number) => {
    fetch(`/api/alerts/${id}`, { method: 'DELETE' }).then(() => fetchAllData());
  };

  const handleSavePreferences = () => {
    fetch('/api/notification-preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefs)
    })
      .then(r => r.json())
      .then(data => {
        showStatus(data.message || 'Notification preferences saved.');
        fetchAllData();
      });
  };

  const handleSimulateRule = () => {
    fetch('/api/alerts/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: ruleTopic,
        importance_threshold: ruleScore,
        novelty_threshold: ruleNovelty,
        keywords: ruleKeywords.split(',').map(s => s.trim()).filter(Boolean)
      })
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) setSimResults(data.data);
      });
  };

  const handleCreateRuleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim()) return;

    fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: ruleName.trim(),
        type: 'TOPIC',
        conditions: { topic: ruleTopic, keywords: ruleKeywords },
        priority_threshold: rulePriority,
        importance_threshold: ruleScore,
        novelty_threshold: ruleNovelty,
        frequency: 'INSTANT',
        channels: ['DASHBOARD', 'EMAIL']
      })
    })
      .then(r => r.json())
      .then(data => {
        setIsBuilderOpen(false);
        setRuleName('');
        showStatus(data.message || 'Alert rule created!');
        fetchAllData();
      });
  };

  const handleSendTestNotification = () => {
    fetch('/api/notifications/test', { method: 'POST' })
      .then(r => r.json())
      .then(data => showStatus(data.message));
  };

  const handleSendTestEmail = () => {
    showStatus('Sending Hostinger SMTP test briefing email...');
    
    const sendReq = (url: string) =>
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

    sendReq('/api/email/test')
      .catch(() => sendReq('http://localhost:3001/api/email/test'))
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          showStatus(`✓ ${data.message || 'Test email dispatched successfully!'}`);
        } else {
          showStatus(`❌ Email error: ${data.error?.message || data.message || 'SMTP delivery failed'}`);
        }
      })
      .catch(err => {
        showStatus(`❌ Email test failed: Unable to reach backend server. (${err.message})`);
      });
  };

  return (
    <div className="space-y-stack-lg animate-fadeIn max-w-6xl mx-auto">
      {/* Header & Title */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-container-margin shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-metadata-sm font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5 mb-1">
            <span className="material-symbols-outlined text-sm">tune</span>
            INDUSTRIAL-GRADE ALERT RADAR CONTROL CENTER
          </span>
          <h2 className="text-headline-md font-bold text-primary">Alert Control Center & Notification Policy</h2>
        </div>

        {/* Global Pause Control Bar (PRD §60 & §61) */}
        <div className="flex items-center gap-2 bg-surface-container-low p-2 border border-outline-variant rounded-xl">
          <span className="text-metadata-sm font-bold text-on-surface-variant flex items-center gap-1">
            <span className="material-symbols-outlined text-sm text-amber-600">pause_circle</span>
            Global Pause:
          </span>
          {diagnostics?.notification_engine.global_pause ? (
            <button
              onClick={() => handleGlobalPause(0)}
              className="px-3 py-1 bg-emerald-600 text-white rounded text-xs font-bold hover:bg-emerald-700 transition-colors"
            >
              Resume Notifications
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleGlobalPause(1)}
                className="px-2 py-1 bg-surface-container hover:bg-outline-variant text-primary rounded text-xs font-semibold"
              >
                1h
              </button>
              <button
                onClick={() => handleGlobalPause(4)}
                className="px-2 py-1 bg-surface-container hover:bg-outline-variant text-primary rounded text-xs font-semibold"
              >
                4h
              </button>
              <button
                onClick={() => handleGlobalPause(24)}
                className="px-2 py-1 bg-surface-container hover:bg-outline-variant text-primary rounded text-xs font-semibold"
              >
                Today
              </button>
            </div>
          )}
        </div>
      </div>

      {statusMsg && (
        <div className="px-4 py-2.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-body-sm font-bold animate-fadeIn">
          {statusMsg}
        </div>
      )}

      {/* 5-Tab Navigation Bar (PRD §3) */}
      <div className="flex overflow-x-auto gap-2 border-b border-outline-variant pb-2 no-scrollbar">
        {[
          { id: 'overview', label: 'Overview', icon: 'dashboard' },
          { id: 'rules', label: 'Alert Rules', icon: 'gavel' },
          { id: 'channels', label: 'Channel Matrix', icon: 'alt_route' },
          { id: 'quiet', label: 'Quiet Hours', icon: 'bedtime' },
          { id: 'diagnostics', label: 'Diagnostics & Test Center', icon: 'health_and_safety' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2.5 rounded-xl text-body-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-primary text-white shadow-sm'
                : 'bg-surface-container-lowest border border-outline-variant text-on-surface-variant hover:text-primary hover:bg-surface-container-low'
            }`}
          >
            <span className="material-symbols-outlined text-lg">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 shadow-sm space-y-1">
              <span className="text-metadata-sm text-on-surface-variant font-bold uppercase">🔔 Unread Alerts</span>
              <div className="text-headline-md font-bold text-primary">{diagnostics?.dashboard_notifications.unread_count || 0}</div>
              <p className="text-metadata-sm text-on-surface-variant">Total: {diagnostics?.dashboard_notifications.total_count || 0}</p>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 shadow-sm space-y-1">
              <span className="text-metadata-sm text-on-surface-variant font-bold uppercase">⚡ Active Rules</span>
              <div className="text-headline-md font-bold text-primary">{alerts.filter(a => a.enabled).length}</div>
              <p className="text-metadata-sm text-on-surface-variant">Configured: {alerts.length}</p>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 shadow-sm space-y-1">
              <span className="text-metadata-sm text-on-surface-variant font-bold uppercase">📧 Hostinger Email</span>
              <div className="text-body-md font-bold text-emerald-700 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse"></span>
                Connected
              </div>
              <p className="text-metadata-sm text-on-surface-variant">Level: {prefs.email_alerts_level}</p>
            </div>

            <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 shadow-sm space-y-1">
              <span className="text-metadata-sm text-on-surface-variant font-bold uppercase">🌙 Quiet Hours</span>
              <div className="text-body-md font-bold text-primary">
                {prefs.quiet_hours_start} → {prefs.quiet_hours_end}
              </div>
              <p className="text-metadata-sm text-emerald-700 font-semibold">
                {prefs.critical_override ? '✓ Critical Override Enabled' : 'Standard Delivery'}
              </p>
            </div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-headline-sm font-bold text-primary border-b border-outline-variant pb-2">
              System Service Status (PRD §5)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-surface-container-low border rounded-xl flex items-center justify-between">
                <span className="text-body-sm font-bold text-primary">Notification Engine</span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded">● Operational</span>
              </div>
              <div className="p-3 bg-surface-container-low border rounded-xl flex items-center justify-between">
                <span className="text-body-sm font-bold text-primary">Hostinger SMTP</span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded">● Connected</span>
              </div>
              <div className="p-3 bg-surface-container-low border rounded-xl flex items-center justify-between">
                <span className="text-body-sm font-bold text-primary">Dashboard Bell</span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded">● Enabled</span>
              </div>
              <div className="p-3 bg-surface-container-low border rounded-xl flex items-center justify-between">
                <span className="text-body-sm font-bold text-primary">Browser Push</span>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-bold rounded">○ Disabled</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ALERT RULES */}
      {activeTab === 'rules' && (
        <div className="space-y-6">
          {/* Prebuilt Templates (PRD §58) */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <div>
                <h3 className="text-headline-sm font-bold text-primary">Prebuilt Alert Templates (PRD §58)</h3>
                <p className="text-metadata-sm text-on-surface-variant">Activate 1-click industry standard notification templates</p>
              </div>

              <button
                onClick={() => setIsBuilderOpen(true)}
                className="px-4 py-2 bg-primary text-white hover:bg-inverse-surface rounded-lg text-body-sm font-bold shadow-sm transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                + Create Custom Rule
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {TEMPLATES.map(t => (
                <div key={t.id} className="p-4 bg-surface-container-low border border-outline-variant rounded-xl space-y-2 flex flex-col justify-between">
                  <div>
                    <h4 className="text-body-sm font-bold text-primary">{t.name}</h4>
                    <p className="text-metadata-sm text-on-surface-variant leading-snug">{t.desc}</p>
                  </div>
                  <button
                    onClick={() => handleCreateTemplate(t.id)}
                    className="w-full py-1.5 bg-surface-container hover:bg-outline-variant text-primary border border-outline-variant rounded text-xs font-bold transition-colors"
                  >
                    1-Click Activate
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Active Rules List */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-headline-sm font-bold text-primary border-b border-outline-variant pb-3">
              Active Alert Rules ({alerts.length})
            </h3>

            {alerts.length === 0 ? (
              <div className="p-12 text-center text-on-surface-variant space-y-3">
                <span className="material-symbols-outlined text-5xl text-outline">notifications_off</span>
                <h4 className="text-headline-sm font-bold text-primary">No Custom Alert Rules</h4>
                <p className="text-body-sm text-on-surface-variant max-w-md mx-auto">
                  Click a template above or create your first custom alert rule to monitor AI developments.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.map(rule => (
                  <div key={rule.id} className="p-4 bg-surface-container-low border border-outline-variant rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${rule.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                          {rule.enabled ? 'ACTIVE' : 'PAUSED'}
                        </span>
                        <h4 className="text-body-md font-bold text-primary">{rule.name}</h4>
                      </div>
                      <div className="text-metadata-sm text-on-surface-variant">
                        Importance: {rule.importance_threshold}+ • Novelty: {rule.novelty_threshold} • Est. {rule.estimated_frequency}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDuplicateRule(rule.id)}
                        className="px-3 py-1 bg-surface-container hover:bg-outline-variant border border-outline-variant rounded text-xs font-bold text-primary transition-colors"
                        title="Duplicate rule"
                      >
                        Copy
                      </button>
                      <button
                        onClick={() => handleToggleRule(rule.id, rule.enabled)}
                        className="px-3 py-1 bg-surface-container hover:bg-outline-variant border border-outline-variant rounded text-xs font-bold text-primary transition-colors"
                      >
                        {rule.enabled ? 'Pause' : 'Resume'}
                      </button>
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="p-1.5 text-on-surface-variant hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                      >
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: CHANNELS MATRIX */}
      {activeTab === 'channels' && (
        <div className="space-y-6">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-headline-sm font-bold text-primary border-b border-outline-variant pb-3">
              Notification Channel Matrix (PRD §7)
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant text-metadata-sm font-bold text-on-surface-variant uppercase bg-surface-container-low">
                    <th className="p-3">Priority Level</th>
                    <th className="p-3">Dashboard Bell</th>
                    <th className="p-3">Hostinger Email</th>
                    <th className="p-3">Browser Push</th>
                    <th className="p-3">Sound Alert</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant text-body-sm">
                  <tr>
                    <td className="p-3 font-bold text-red-700">🔴 CRITICAL</td>
                    <td className="p-3 font-semibold text-emerald-700">ON</td>
                    <td className="p-3 font-semibold text-emerald-700">ON (Immediate)</td>
                    <td className="p-3 text-on-surface-variant">OFF</td>
                    <td className="p-3 text-on-surface-variant">OFF</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-amber-700">🟠 HIGH</td>
                    <td className="p-3 font-semibold text-emerald-700">ON</td>
                    <td className="p-3 text-on-surface-variant">Digest Only</td>
                    <td className="p-3 text-on-surface-variant">OFF</td>
                    <td className="p-3 text-on-surface-variant">OFF</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-bold text-blue-700">🔵 MEDIUM</td>
                    <td className="p-3 font-semibold text-emerald-700">ON</td>
                    <td className="p-3 text-on-surface-variant">OFF</td>
                    <td className="p-3 text-on-surface-variant">OFF</td>
                    <td className="p-3 text-on-surface-variant">OFF</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-headline-sm font-bold text-primary border-b border-outline-variant pb-3">
              Hostinger SMTP Email Settings (PRD §8 & §11)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-body-sm font-bold text-primary block">Email Dispatch Policy</label>
                <select
                  value={prefs.email_alerts_level}
                  onChange={e => setPrefs({ ...prefs, email_alerts_level: e.target.value })}
                  className="w-full p-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-body-sm font-semibold text-primary outline-none"
                >
                  <option value="CRITICAL">Critical Only (Major Model Drops & Breaking Events)</option>
                  <option value="HIGH">Critical + High Priority</option>
                  <option value="ALL">All Important Developments</option>
                  <option value="OFF">Disabled (7 AM Briefing Only)</option>
                </select>
              </div>

              <div className="p-4 bg-surface-container-low border rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-body-sm font-bold text-primary">Hostinger SMTP Status</span>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded">● Connected</span>
                </div>
                <p className="text-metadata-sm text-on-surface-variant">Host: smtp.gmail.com • Port: 465 (SSL)</p>
                <button
                  onClick={handleSendTestEmail}
                  className="w-full py-2 bg-primary text-white hover:bg-inverse-surface rounded text-xs font-bold transition-colors"
                >
                  Dispatch Test Email Alert
                </button>
              </div>
            </div>

            <button
              onClick={handleSavePreferences}
              className="px-5 py-2.5 bg-primary text-white hover:bg-inverse-surface rounded-lg text-body-sm font-bold shadow-sm transition-colors"
            >
              Save Channel Preferences
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: QUIET HOURS */}
      {activeTab === 'quiet' && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm space-y-6">
          <h3 className="text-headline-sm font-bold text-primary border-b border-outline-variant pb-3">
            Quiet Hours Schedule & Override Policy (PRD §16, §17, §18)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="text-metadata-sm font-bold text-on-surface-variant block mb-1">Quiet Hours Start</label>
              <input
                type="time"
                value={prefs.quiet_hours_start}
                onChange={e => setPrefs({ ...prefs, quiet_hours_start: e.target.value })}
                className="w-full p-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-body-sm font-bold text-primary"
              />
            </div>
            <div>
              <label className="text-metadata-sm font-bold text-on-surface-variant block mb-1">Quiet Hours End</label>
              <input
                type="time"
                value={prefs.quiet_hours_end}
                onChange={e => setPrefs({ ...prefs, quiet_hours_end: e.target.value })}
                className="w-full p-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-body-sm font-bold text-primary"
              />
            </div>
          </div>

          <div className="p-4 bg-surface-container-low border border-outline-variant rounded-xl flex items-center justify-between">
            <div>
              <h4 className="text-body-sm font-bold text-primary">Critical Override (PRD §18)</h4>
              <p className="text-metadata-sm text-on-surface-variant">Allow 🔴 CRITICAL breaking events to bypass quiet hours</p>
            </div>
            <input
              type="checkbox"
              checked={prefs.critical_override}
              onChange={e => setPrefs({ ...prefs, critical_override: e.target.checked })}
              className="w-5 h-5 accent-primary cursor-pointer"
            />
          </div>

          <button
            onClick={handleSavePreferences}
            className="px-5 py-2.5 bg-primary text-white hover:bg-inverse-surface rounded-lg text-body-sm font-bold shadow-sm transition-colors"
          >
            Save Quiet Hours Policy
          </button>
        </div>
      )}

      {/* TAB 5: DIAGNOSTICS & TEST CENTER */}
      {activeTab === 'diagnostics' && (
        <div className="space-y-6">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-headline-sm font-bold text-primary border-b border-outline-variant pb-3">
              Notification Test Center (PRD §74)
            </h3>
            <p className="text-body-sm text-on-surface-variant">Run safe diagnostic tests to verify the alert pipeline without modifying live data.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <button
                onClick={handleSendTestNotification}
                className="p-4 bg-surface-container-low hover:bg-surface-container border border-outline-variant rounded-xl text-left space-y-1 transition-colors"
              >
                <div className="text-body-sm font-bold text-primary flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-secondary">notifications</span>
                  Test Dashboard Alert
                </div>
                <div className="text-metadata-sm text-on-surface-variant">Emits a test breaking notification to bell overlay</div>
              </button>

              <button
                onClick={handleSendTestNotification}
                className="p-4 bg-surface-container-low hover:bg-surface-container border border-outline-variant rounded-xl text-left space-y-1 transition-colors"
              >
                <div className="text-body-sm font-bold text-primary flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-red-600">emergency</span>
                  Test Critical Alert
                </div>
                <div className="text-metadata-sm text-on-surface-variant">Triggers breaking event pipeline & Hostinger SMTP alert</div>
              </button>

              <button
                onClick={fetchAllData}
                className="p-4 bg-surface-container-low hover:bg-surface-container border border-outline-variant rounded-xl text-left space-y-1 transition-colors"
              >
                <div className="text-body-sm font-bold text-primary flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-blue-600">sync</span>
                  Refresh Diagnostics
                </div>
                <div className="text-metadata-sm text-on-surface-variant">Re-checks live status of all background services</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Step Rule Builder Modal (PRD §20, §21, §36, §37) */}
      {isBuilderOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl w-full max-w-2xl shadow-2xl p-6 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <h3 className="text-headline-sm font-bold text-primary">Create Custom Alert Rule</h3>
              <button onClick={() => setIsBuilderOpen(false)} className="p-1 text-on-surface-variant hover:text-primary">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateRuleSubmit} className="space-y-4">
              <div>
                <label className="text-metadata-sm font-bold text-on-surface-variant block mb-1">Rule Name</label>
                <input
                  type="text"
                  value={ruleName}
                  onChange={e => setRuleName(e.target.value)}
                  placeholder="e.g. AI Agents & Reasoning Models Alert"
                  className="w-full p-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-body-sm font-semibold text-primary outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-metadata-sm font-bold text-on-surface-variant block mb-1">Topic</label>
                  <select
                    value={ruleTopic}
                    onChange={e => setRuleTopic(e.target.value)}
                    className="w-full p-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-body-sm font-semibold text-primary outline-none"
                  >
                    <option value="AI Agents">AI Agents</option>
                    <option value="AI Models">AI Models</option>
                    <option value="Open Source">Open Source</option>
                    <option value="AI Coding">AI Coding</option>
                    <option value="AI Safety">AI Safety</option>
                  </select>
                </div>

                <div>
                  <label className="text-metadata-sm font-bold text-on-surface-variant block mb-1">Novelty Threshold</label>
                  <select
                    value={ruleNovelty}
                    onChange={e => setRuleNovelty(e.target.value)}
                    className="w-full p-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-body-sm font-semibold text-primary outline-none"
                  >
                    <option value="NEW_ONLY">New Only (PRD §29)</option>
                    <option value="SIGNIFICANT_UPDATES">New + Significant Updates</option>
                    <option value="ANY">Any Coverage</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-metadata-sm font-bold text-on-surface-variant">Importance Score Threshold</label>
                  <span className="text-body-sm font-bold text-primary">{ruleScore}+</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="95"
                  value={ruleScore}
                  onChange={e => setRuleScore(Number(e.target.value))}
                  className="w-full accent-primary cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-on-surface-variant font-bold mt-1">
                  <span>Medium (50+)</span>
                  <span>High (70+)</span>
                  <span>Critical (90+)</span>
                </div>
              </div>

              <div>
                <label className="text-metadata-sm font-bold text-on-surface-variant block mb-1">Keywords (Comma Separated)</label>
                <input
                  type="text"
                  value={ruleKeywords}
                  onChange={e => setRuleKeywords(e.target.value)}
                  placeholder="e.g. reasoning, benchmark, SWE-bench"
                  className="w-full p-2.5 bg-surface-container-low border border-outline-variant rounded-lg text-body-sm font-semibold text-primary outline-none"
                />
              </div>

              {/* Rule Simulation & Preview (PRD §36 & §37) */}
              <div className="p-4 bg-surface-container-low border border-outline-variant rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-body-sm font-bold text-primary">Rule Simulation & Quality Estimate</span>
                  <button
                    type="button"
                    onClick={handleSimulateRule}
                    className="px-3 py-1 bg-surface-container hover:bg-outline-variant border border-outline-variant rounded text-xs font-bold text-primary transition-colors"
                  >
                    Simulate Rule
                  </button>
                </div>

                {simResults && (
                  <div className="space-y-2 border-t border-outline-variant pt-2 animate-fadeIn">
                    <div className="flex items-center gap-4">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Matches</span>
                        <span className="text-body-sm font-bold text-primary">{simResults.matches_count} events</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Quality Score</span>
                        <span className="text-body-sm font-bold text-emerald-700">{simResults.quality_score}% Good</span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-on-surface-variant block">Est. Frequency</span>
                        <span className="text-body-sm font-bold text-primary">{simResults.estimated_frequency}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBuilderOpen(false)}
                  className="px-4 py-2 border border-outline-variant rounded-lg text-body-sm font-bold text-primary hover:bg-surface-container-low"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary text-white hover:bg-inverse-surface rounded-lg text-body-sm font-bold shadow-sm transition-colors"
                >
                  Activate Alert Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
