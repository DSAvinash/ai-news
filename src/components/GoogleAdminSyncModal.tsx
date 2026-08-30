import React, { useEffect, useState } from 'react';

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
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const fetchHistory = () => {
    setLoading(true);
    fetch('/api/google-skills/admin/sync-history')
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setHistory(json.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isOpen) fetchHistory();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRunSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch('/api/google-skills/admin/sync', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setSyncMessage(`Sync completed: ${json.resources_checked} checked, ${json.new_count} new, ${json.updated_count} updated.`);
        fetchHistory();
        if (onSyncCompleted) onSyncCompleted();
      } else {
        setSyncMessage(`Sync failed: ${json.error || 'Check server logs'}`);
      }
    } catch (e: any) {
      setSyncMessage(`Sync error: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between bg-surface-container-low">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">admin_panel_settings</span>
            <h2 className="text-base font-bold text-on-surface">
              Google Skills Catalog Management & Sync Audit
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-surface-container-low rounded-xl border border-outline-variant/60">
            <div>
              <div className="text-sm font-bold text-on-surface">Asynchronous Ingestion Scheduler</div>
              <div className="text-xs text-on-surface-variant mt-0.5">
                Automated 6-hour cron cycle across official domains: skills.google, cloud.google.com, deepmind.google
              </div>
            </div>
            <button
              onClick={handleRunSync}
              disabled={syncing}
              className="px-4 py-2 bg-primary text-on-primary rounded-lg text-xs font-semibold flex items-center justify-center gap-2 hover:bg-inverse-surface transition-all disabled:opacity-50 shadow-sm"
            >
              <span className={`material-symbols-outlined text-sm ${syncing ? 'animate-spin' : ''}`}>
                sync
              </span>
              {syncing ? 'Running Sync...' : 'Trigger Sync Now'}
            </button>
          </div>

          {syncMessage && (
            <div className="p-3 bg-secondary-container text-on-secondary-container text-xs rounded-lg flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">info</span>
              <span>{syncMessage}</span>
            </div>
          )}

          {/* Audit Runs Table */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-on-surface uppercase tracking-wider">
              Recent Sync Audit Runs (PRD §50 & §63)
            </div>

            {loading ? (
              <div className="space-y-2 py-4">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-12 bg-surface-container-low rounded-lg animate-pulse" />
                ))}
              </div>
            ) : history.length === 0 ? (
              <div className="text-xs text-on-surface-variant py-4 text-center">No sync history recorded yet.</div>
            ) : (
              <div className="border border-outline-variant rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-surface-container-high text-on-surface font-semibold">
                    <tr>
                      <th className="p-3">Started At</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Checked</th>
                      <th className="p-3">New</th>
                      <th className="p-3">Updated</th>
                      <th className="p-3">Duplicates</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {history.map((run) => (
                      <tr key={run.id} className="hover:bg-surface-container-low">
                        <td className="p-3 text-on-surface-variant">
                          {new Date(run.started_at).toLocaleString()}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              run.status === 'COMPLETED'
                                ? 'bg-emerald-500/10 text-emerald-600'
                                : run.status === 'PARTIAL'
                                ? 'bg-amber-500/10 text-amber-600'
                                : 'bg-red-500/10 text-red-600'
                            }`}
                          >
                            {run.status}
                          </span>
                        </td>
                        <td className="p-3 font-medium text-on-surface">{run.resources_checked}</td>
                        <td className="p-3 text-emerald-600 font-bold">+{run.new_count}</td>
                        <td className="p-3 text-amber-600 font-bold">~{run.updated_count}</td>
                        <td className="p-3 text-on-surface-variant">{run.duplicate_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-outline-variant bg-surface-container-low flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-surface-container-high hover:bg-surface-container text-on-surface rounded-lg text-sm font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
