import React, { useEffect, useState, useCallback } from 'react';

interface SourceReport {
  id?: number;
  source_name?: string;
  sourceName?: string;
  source_url?: string;
  sourceUrl?: string;
  status: 'HEALTHY' | 'PARTIAL' | 'FAILED' | 'SKIPPED';
  resources_found?: number;
  resourcesFound?: number;
  new_count?: number;
  newCount?: number;
  updated_count?: number;
  updatedCount?: number;
  error_count?: number;
  errorCount?: number;
  error_message?: string;
  errorMessage?: string;
  response_time_ms?: number;
  responseTimeMs?: number;
}

interface SyncRunDetails {
  sync_id: number;
  sync_type: string;
  status: string;
  started_at: string;
  completed_at: string;
  duration_ms: number;
  metrics: {
    discovered: number;
    checked: number;
    new: number;
    updated: number;
    unchanged: number;
    unavailable: number;
    verification_failed: number;
    duplicates: number;
    errors: number;
  };
  source_reports: SourceReport[];
  what_changed: {
    new_resources: Array<{ id: number; title: string; difficulty: string; duration: string; url: string }>;
    updated_resources: Array<{ id: number; title: string; changes: Array<{ field: string; oldVal: string; newVal: string }> }>;
    unavailable_resources: Array<{ id: number; title: string; reason: string }>;
  };
}

interface GoogleAdminSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncCompleted?: () => void;
}

export const GoogleAdminSyncModal: React.FC<GoogleAdminSyncModalProps> = ({
  isOpen,
  onClose,
  onSyncCompleted
}) => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<number>(0);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [activeSyncId, setActiveSyncId] = useState<number | null>(null);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [selectedRunResult, setSelectedRunResult] = useState<SyncRunDetails | null>(null);
  const [activeTab, setActiveTab] = useState<'control' | 'changes' | 'history'>('control');

  const fetchHistory = useCallback(() => {
    setLoading(true);
    fetch('/api/google-skills/admin/sync-history')
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setHistory(json.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const fetchActiveStatus = useCallback(() => {
    fetch('/api/google-skills/admin/sync/status')
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) {
          if (json.data.is_running && json.data.active_job) {
            setSyncing(true);
            setActiveSyncId(json.data.active_job.sync_id);
            setSyncProgress(json.data.active_job.progress || 10);
            setCurrentStep(json.data.active_job.current_step || 'Synchronizing catalog...');
          }
        }
      })
      .catch(console.error);
  }, []);

  const fetchRunResults = (syncId: number) => {
    fetch(`/api/google-skills/admin/sync/${syncId}/results`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) {
          setSelectedRunResult(json.data);
          setActiveTab('changes');
        }
      })
      .catch(console.error);
  };

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
      fetchActiveStatus();
    }
  }, [isOpen, fetchHistory, fetchActiveStatus]);

  if (!isOpen) return null;

  const handleStartSync = async (type: 'INCREMENTAL' | 'FULL') => {
    setSyncing(true);
    setSyncProgress(15);
    setCurrentStep(type === 'FULL' ? 'Starting full catalog re-verification...' : 'Starting incremental catalog synchronization...');
    setSyncMessage(null);

    try {
      const endpoint = type === 'FULL' ? '/api/google-skills/admin/sync/full' : '/api/google-skills/admin/sync';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggered_by: 'ADMIN' })
      });
      const json = await res.json();

      if (json.success) {
        setSyncProgress(100);
        setCurrentStep('Catalog synchronization completed.');
        setActiveSyncId(json.sync_id);
        setSyncMessage({
          type: 'success',
          text: `✓ Catalog synchronized in ${((json.duration_ms || 0) / 1000).toFixed(1)}s: +${json.new_count} New, ↻${json.updated_count} Updated, ✓${json.unchanged_count} Unchanged.`
        });
        fetchHistory();
        if (json.sync_id) {
          fetchRunResults(json.sync_id);
        }
        if (onSyncCompleted) onSyncCompleted();
      } else {
        setSyncMessage({
          type: 'error',
          text: `Sync error: ${json.error || 'Check server logs'}`
        });
      }
    } catch (e: any) {
      setSyncMessage({ type: 'error', text: `Sync network failure: ${e.message}` });
    } finally {
      setSyncing(false);
    }
  };

  const handleCancelSync = async () => {
    if (!activeSyncId) return;
    try {
      await fetch(`/api/google-skills/admin/sync/${activeSyncId}/cancel`, { method: 'POST' });
      setSyncMessage({ type: 'warning', text: `Cancellation requested for Sync #${activeSyncId}` });
      setSyncing(false);
    } catch (e: any) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn select-none">
      <div
        className="bg-surface-container-lowest border border-outline-variant rounded-2xl w-full max-w-4xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between bg-surface-container-low">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <span className="material-symbols-outlined text-2xl">sync_saved_locally</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-on-surface flex items-center gap-2">
                Google Skills Catalog Refresh & Sync Engine
                <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-secondary/15 text-secondary border border-secondary/30">
                  v2.0 Production
                </span>
              </h2>
              <p className="text-xs text-on-surface-variant">
                Official Google learning resources synchronization, change detection, and version diffing.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
            title="Close"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-outline-variant bg-surface-container-low/50 text-xs">
          <button
            onClick={() => setActiveTab('control')}
            className={`pb-2.5 px-3 font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'control'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-base">tune</span>
            Sync Control & Sources
          </button>

          <button
            onClick={() => setActiveTab('changes')}
            className={`pb-2.5 px-3 font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'changes'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-base">difference</span>
            What Changed? {selectedRunResult ? `(#${selectedRunResult.sync_id})` : ''}
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`pb-2.5 px-3 font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-base">history</span>
            Audit History ({history.length})
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Active Sync Progress Banner */}
          {syncing && (
            <div className="p-4 rounded-2xl bg-primary/10 border border-primary/30 space-y-3 animate-pulse">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-primary flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary animate-ping" />
                  Synchronizing Google Skills Catalog...
                </span>
                <span className="text-xs font-mono font-bold text-primary">{syncProgress}%</span>
              </div>

              <div className="w-full h-2 rounded-full bg-primary/20 overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300 ease-out"
                  style={{ width: `${syncProgress}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-on-surface-variant">
                <span className="truncate">{currentStep}</span>
                <button
                  onClick={handleCancelSync}
                  className="text-rose-500 hover:text-rose-600 font-bold ml-2 shrink-0"
                >
                  Cancel Sync
                </button>
              </div>
            </div>
          )}

          {/* Sync Notifications */}
          {syncMessage && !syncing && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 border ${
                syncMessage.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  : syncMessage.type === 'error'
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
              }`}
            >
              <span className="material-symbols-outlined text-base shrink-0">
                {syncMessage.type === 'success' ? 'check_circle' : syncMessage.type === 'error' ? 'error' : 'warning'}
              </span>
              <span className="font-semibold">{syncMessage.text}</span>
            </div>
          )}

          {/* TAB 1: SYNC CONTROL & APPROVED SOURCES */}
          {activeTab === 'control' && (
            <div className="space-y-5">
              {/* Action Buttons Box */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-bold text-primary">
                      <span className="material-symbols-outlined text-base">autorenew</span>
                      Incremental Catalog Sync (Recommended)
                    </div>
                    <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                      Checks official Google feeds for newly released badges and updated courses without re-verifying unchanged records.
                    </p>
                  </div>
                  <button
                    onClick={() => handleStartSync('INCREMENTAL')}
                    disabled={syncing}
                    className="w-full py-2.5 px-4 bg-primary text-on-primary rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-50 shadow-sm"
                  >
                    <span className={`material-symbols-outlined text-sm ${syncing ? 'animate-spin' : ''}`}>
                      sync
                    </span>
                    {syncing ? 'Syncing...' : 'Sync Catalog Now'}
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-bold text-secondary">
                      <span className="material-symbols-outlined text-base">verified</span>
                      Force Full Re-Verification
                    </div>
                    <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                      Deep re-verification of all catalog URLs, SHA-256 fingerprint recalculation, and failure tolerance audits.
                    </p>
                  </div>
                  <button
                    onClick={() => handleStartSync('FULL')}
                    disabled={syncing}
                    className="w-full py-2.5 px-4 bg-surface-container-high hover:bg-surface-container text-on-surface border border-outline-variant rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-sm">restart_alt</span>
                    Force Full Sync
                  </button>
                </div>
              </div>

              {/* Approved Official Sources List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Approved Official Google Sources (Whitelisted)
                  </span>
                  <span className="text-xs text-emerald-500 font-bold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    SSRF & HTTPS Enforced
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/70 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-primary">school</span>
                        skills.google
                      </div>
                      <div className="text-[11px] text-on-surface-variant mt-0.5">Google Skills & Boost Paths</div>
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      HEALTHY
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/70 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-secondary">cloud</span>
                        cloud.google.com & DeepMind
                      </div>
                      <div className="text-[11px] text-on-surface-variant mt-0.5">Vertex AI & Model Training Labs</div>
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      HEALTHY
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: WHAT CHANGED? DIFF INSPECTOR */}
          {activeTab === 'changes' && (
            <div className="space-y-5">
              {selectedRunResult ? (
                <>
                  {/* Summary Metrics Chips */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                      <div className="text-[10px] font-bold text-emerald-500 uppercase">New Released</div>
                      <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                        +{selectedRunResult.metrics.new}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                      <div className="text-[10px] font-bold text-amber-500 uppercase">Updated</div>
                      <div className="text-lg font-black text-amber-600 dark:text-amber-400 mt-0.5">
                        ↻{selectedRunResult.metrics.updated}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant">
                      <div className="text-[10px] font-bold text-on-surface-variant uppercase">Unchanged</div>
                      <div className="text-lg font-black text-on-surface mt-0.5">
                        ✓{selectedRunResult.metrics.unchanged}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30">
                      <div className="text-[10px] font-bold text-rose-500 uppercase">Unavailable</div>
                      <div className="text-lg font-black text-rose-600 dark:text-rose-400 mt-0.5">
                        −{selectedRunResult.metrics.unavailable}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant">
                      <div className="text-[10px] font-bold text-on-surface-variant uppercase">Duration</div>
                      <div className="text-lg font-black text-primary mt-0.5">
                        {((selectedRunResult.duration_ms || 0) / 1000).toFixed(1)}s
                      </div>
                    </div>
                  </div>

                  {/* Detailed Changes Breakdown */}
                  <div className="space-y-4">
                    {/* New Resources */}
                    {selectedRunResult.what_changed.new_resources.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-xs font-bold text-emerald-500 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm">fiber_new</span>
                          Newly Discovered Google Skills ({selectedRunResult.what_changed.new_resources.length})
                        </span>
                        <div className="space-y-1.5">
                          {selectedRunResult.what_changed.new_resources.map((item) => (
                            <div
                              key={item.id}
                              className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/60 flex items-center justify-between text-xs"
                            >
                              <div>
                                <span className="font-bold text-on-surface">{item.title}</span>
                                <span className="text-[11px] text-on-surface-variant ml-2">
                                  {item.difficulty} • {item.duration}
                                </span>
                              </div>
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline text-[11px] font-semibold"
                              >
                                View ↗
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Updated Resources */}
                    {selectedRunResult.what_changed.updated_resources.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-xs font-bold text-amber-500 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm">edit_note</span>
                          Modified Metadata & Prerequisites ({selectedRunResult.what_changed.updated_resources.length})
                        </span>
                        <div className="space-y-1.5">
                          {selectedRunResult.what_changed.updated_resources.map((item) => (
                            <div
                              key={item.id}
                              className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/60 text-xs space-y-1"
                            >
                              <span className="font-bold text-on-surface">{item.title}</span>
                              <div className="text-[11px] text-on-surface-variant space-y-0.5">
                                {item.changes.map((c, i) => (
                                  <div key={i} className="flex items-center gap-1.5">
                                    <span className="font-semibold text-amber-500 capitalize">{c.field.toLowerCase()}:</span>
                                    <span className="line-through opacity-70">{c.oldVal}</span>
                                    <span>→</span>
                                    <span className="font-bold text-on-surface">{c.newVal}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Source Breakdown Reports */}
                    {selectedRunResult.source_reports && selectedRunResult.source_reports.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-outline-variant">
                        <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                          Source-Level Response & Health
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {selectedRunResult.source_reports.map((src, i) => (
                            <div
                              key={i}
                              className="p-2.5 rounded-xl bg-surface-container-low border border-outline-variant/60 text-xs flex items-center justify-between"
                            >
                              <div>
                                <span className="font-bold text-on-surface">{src.source_name || src.sourceName}</span>
                                <div className="text-[11px] text-on-surface-variant">
                                  {src.resources_found || src.resourcesFound || 0} items in {src.response_time_ms || src.responseTimeMs || 0}ms
                                </div>
                              </div>
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                {src.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="py-12 text-center text-xs text-on-surface-variant">
                  Select a sync run from the Audit History tab to inspect detailed diffs and changes.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: AUDIT HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              {loading ? (
                <div className="py-12 text-center text-xs text-on-surface-variant">Loading audit logs...</div>
              ) : history.length === 0 ? (
                <div className="py-12 text-center text-xs text-on-surface-variant">No sync runs recorded yet.</div>
              ) : (
                <div className="space-y-2">
                  {history.map((run) => (
                    <div
                      key={run.id}
                      onClick={() => fetchRunResults(run.id)}
                      className="p-3 rounded-xl bg-surface-container-low hover:bg-surface-container border border-outline-variant/60 cursor-pointer transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-on-surface">Sync Run #{run.id}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              run.status === 'COMPLETED'
                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                                : run.status === 'PARTIAL'
                                ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                                : 'bg-rose-500/10 text-rose-500 border-rose-500/30'
                            }`}
                          >
                            {run.status}
                          </span>
                          <span className="text-[10px] text-on-surface-variant">
                            {run.sync_type || 'MANUAL'}
                          </span>
                        </div>
                        <div className="text-[11px] text-on-surface-variant mt-1">
                          {new Date(run.started_at).toLocaleString()} • Duration: {((run.duration_ms || 0) / 1000).toFixed(1)}s
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="text-emerald-500 font-bold">+{run.new_count || 0} New</span>
                          <span>•</span>
                          <span className="text-amber-500 font-bold">↻{run.updated_count || 0} Updated</span>
                          <span>•</span>
                          <span className="text-on-surface-variant font-bold">✓{run.resources_checked || 0} Total</span>
                        </div>
                        <span className="material-symbols-outlined text-sm text-on-surface-variant">chevron_right</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
