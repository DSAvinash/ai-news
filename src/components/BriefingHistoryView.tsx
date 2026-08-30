import React, { useEffect, useState } from 'react';
import { StoryCluster } from '../types';

interface BriefingHistoryViewProps {
  onSelectCluster: (cluster: StoryCluster) => void;
}

export const BriefingHistoryView: React.FC<BriefingHistoryViewProps> = ({ onSelectCluster }) => {
  const [briefings, setBriefings] = useState<any[]>([]);
  const [selectedBriefing, setSelectedBriefing] = useState<any>(null);
  const [briefingItems, setBriefingItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = () => {
    setLoading(true);
    fetch('/api/briefings/history')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setBriefings(data.data);
          if (data.data.length > 0) {
            loadBriefingDetail(data.data[0].id);
          }
        }
      })
      .catch((err) => console.error('[BriefingHistory] Error fetching:', err))
      .finally(() => setLoading(false));
  };

  const loadBriefingDetail = (id: number) => {
    fetch(`/api/briefings/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setSelectedBriefing(data.data.briefing);
          setBriefingItems(data.data.items);
        }
      });
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  return (
    <div className="space-y-stack-lg animate-fadeIn">
      <div className="border-b border-outline-variant pb-stack-md flex justify-between items-center">
        <div>
          <h2 className="text-headline-md font-bold text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">history_edu</span>
            Daily Briefing Delivery History
          </h2>
          <p className="text-body-sm text-on-surface-variant">
            Auditable archive of delivered 7:00 AM daily AI briefings and incremental story items.
          </p>
        </div>
        <span className="text-metadata-sm font-mono-label bg-surface-container-low px-3 py-1 rounded border border-outline-variant text-on-surface-variant">
          {briefings.length} Delivered Briefings
        </span>
      </div>

      {loading ? (
        <div className="py-20 text-center text-on-surface-variant text-body-sm flex flex-col items-center justify-center gap-2">
          <span className="material-symbols-outlined text-secondary text-3xl animate-spin">radar</span>
          <span>Loading delivery history archive...</span>
        </div>
      ) : briefings.length === 0 ? (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-16 text-center text-on-surface-variant">
          <span className="material-symbols-outlined text-5xl mb-3 text-outline">history</span>
          <h3 className="text-headline-sm font-bold text-primary mb-1">No Delivery Records Yet</h3>
          <p className="text-body-sm text-on-surface-variant max-w-md mx-auto">
            Briefings will be archived here automatically after successful 7:00 AM SMTP delivery.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-stack-lg">
          {/* Left Column: Past Briefings List */}
          <div className="space-y-stack-md">
            <h3 className="text-headline-sm font-bold text-primary">Delivered Briefings</h3>
            <div className="space-y-3">
              {briefings.map((b) => {
                const isSelected = selectedBriefing?.id === b.id;
                return (
                  <div
                    key={b.id}
                    onClick={() => loadBriefingDetail(b.id)}
                    className={`cursor-pointer p-stack-md rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-surface-container-lowest border-secondary ring-2 ring-secondary/20 shadow-sm'
                        : 'bg-surface-container-lowest border-outline-variant hover:border-secondary'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-body-sm font-bold text-primary">{b.briefing_date}</span>
                      <span
                        className={`text-metadata-sm px-2 py-0.5 rounded font-bold uppercase ${
                          b.status === 'QUIET_MORNING'
                            ? 'bg-slate-100 text-slate-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {b.status}
                      </span>
                    </div>
                    <p className="text-metadata-sm text-on-surface-variant line-clamp-2 mb-2">{b.summary}</p>
                    <div className="flex justify-between items-center text-metadata-sm font-mono-label text-on-surface-variant pt-2 border-t border-outline-variant">
                      <span>{b.delivered_stories_count || b.stories_selected} Stories</span>
                      <span className="text-secondary font-semibold">Inspect Briefing →</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right 2 Columns: Selected Briefing Content */}
          {selectedBriefing && (
            <div className="xl:col-span-2 space-y-stack-md">
              <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-container-margin shadow-sm">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-mono-label text-secondary uppercase font-bold">
                    BRIEFING DATE: {selectedBriefing.briefing_date}
                  </span>
                  <span className="text-metadata-sm text-on-surface-variant font-mono-label">
                    Idempotency Key: {selectedBriefing.idempotency_key}
                  </span>
                </div>
                <h3 className="text-headline-md font-bold text-primary mb-2">
                  {selectedBriefing.status === 'QUIET_MORNING' ? 'Quiet Morning Report' : 'What Changed Since Your Last Briefing'}
                </h3>
                <p className="text-body-sm text-on-surface-variant leading-relaxed p-stack-md bg-surface-container-low border border-outline-variant rounded">
                  {selectedBriefing.summary}
                </p>
              </div>

              {briefingItems.length > 0 && (
                <div>
                  <h4 className="text-headline-sm font-bold text-primary mb-stack-md">Delivered Stories ({briefingItems.length})</h4>
                  <div className="space-y-stack-md">
                    {briefingItems.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => onSelectCluster({ id: item.cluster_id, cluster_title: item.cluster_title, summary: item.summary, category: item.category } as any)}
                        className="cursor-pointer bg-surface-container-lowest border border-outline-variant hover:border-secondary rounded-lg p-container-margin transition-all shadow-sm group"
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="px-2 py-0.5 bg-secondary/10 text-secondary rounded text-mono-label uppercase font-bold">
                            #{item.rank} • {item.category}
                          </span>
                          <span className="text-metadata-sm text-on-surface-variant font-mono-label">
                            Importance: {item.importance_score}
                          </span>
                        </div>
                        <h5 className="text-headline-sm font-bold text-primary group-hover:text-secondary transition-colors mb-1">
                          {item.cluster_title}
                        </h5>
                        <p className="text-body-sm text-on-surface-variant line-clamp-2 mb-2">{item.summary}</p>
                        <div className="text-metadata-sm text-secondary font-semibold flex items-center gap-0.5 pt-2 border-t border-outline-variant">
                          Source: {item.primary_source_name || 'Primary Source'} <span className="material-symbols-outlined text-sm">chevron_right</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
