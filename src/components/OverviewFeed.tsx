import React, { useState } from 'react';
import { StoryCluster, EarlySignal } from '../types';
import { ShareModal } from './ShareModal';

interface OverviewFeedProps {
  clusters: StoryCluster[];
  earlySignals: EarlySignal[];
  todaySummary: { headline: string; executive_summary: string } | null;
  onSelectCluster: (cluster: StoryCluster) => void;
  category: string;
  setCategory: (cat: string) => void;
  loading: boolean;
}

const CATEGORIES = [
  'All',
  'MODEL RELEASE',
  'RESEARCH',
  'AI AGENTS',
  'AI CODING',
  'OPEN SOURCE',
  'AI HARDWARE',
  'ROBOTICS',
  'SAFETY',
  'AI REGULATION',
  'FUNDING',
  'GENERATIVE AI',
  'PRODUCT'
];

export const OverviewFeed: React.FC<OverviewFeedProps> = ({
  clusters,
  earlySignals,
  todaySummary,
  onSelectCluster,
  category,
  setCategory,
  loading
}) => {
  const formatTimeAgo = (isoString?: string) => {
    if (!isoString) return 'Just now';
    const diffMins = Math.max(1, Math.floor((Date.now() - new Date(isoString).getTime()) / 60000));
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  const [activeShareItem, setActiveShareItem] = useState<StoryCluster | null>(null);

  const safeClusters = Array.isArray(clusters) ? clusters : [];
  const safeSignals = Array.isArray(earlySignals) ? earlySignals : [];
  const breaking = safeClusters.filter((c) => Boolean(c.breaking)).slice(0, 2);

  return (
    <div className="space-y-stack-lg animate-fadeIn">
      {activeShareItem && (
        <ShareModal
          isOpen={!!activeShareItem}
          onClose={() => setActiveShareItem(null)}
          title={activeShareItem.cluster_title}
          summary={activeShareItem.summary}
          url={activeShareItem.primary_source_url || window.location.href}
        />
      )}
      {/* Today Summary Banner */}
      {todaySummary && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-container-margin shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-secondary text-sm">sparkles</span>
            <span className="text-metadata-sm font-bold uppercase tracking-wider text-secondary">TODAY IN AI</span>
          </div>
          <h2 className="text-headline-md font-bold text-primary mb-2">
            {todaySummary.headline}
          </h2>
          <p className="text-body-sm text-on-surface-variant leading-relaxed">
            {todaySummary.executive_summary}
          </p>
        </div>
      )}

      {/* Breaking Developments Banner */}
      {breaking.length > 0 && (
        <section>
          <h3 className="text-headline-sm font-bold text-primary mb-stack-md flex items-center gap-2">
            <span className="material-symbols-outlined text-red-600">bolt</span> Breaking Developments
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-stack-md">
            {breaking.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectCluster(item)}
                className="cursor-pointer bg-surface-container-lowest border border-red-200 hover:border-secondary rounded-lg p-container-margin transition-all shadow-sm group"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded text-mono-label font-bold uppercase">
                    BREAKING
                  </span>
                  <span className="text-metadata-sm text-on-surface-variant">Radar Score: {item.radar_score}</span>
                </div>
                <h4 className="text-headline-sm font-bold text-primary group-hover:text-secondary transition-colors mb-2">
                  {item.cluster_title}
                </h4>
                <p className="text-body-sm text-on-surface-variant line-clamp-2 mb-3">
                  {item.summary}
                </p>
                <div className="flex items-center justify-between text-metadata-sm text-on-surface-variant pt-2 border-t border-outline-variant">
                  <span>Primary: <strong className="text-primary">{item.primary_source_name || 'Primary Source'}</strong></span>
                  <span className="text-secondary font-semibold group-hover:underline flex items-center gap-1">
                    View Details <span className="material-symbols-outlined text-sm">chevron_right</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Category Pills Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-outline-variant">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-body-sm font-medium transition-colors whitespace-nowrap ${
              category === cat
                ? 'bg-primary text-on-primary font-bold shadow-sm'
                : 'bg-surface-container-low text-on-surface-variant hover:text-primary hover:bg-surface-container'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Early Signals Stream */}
      {safeSignals.length > 0 && (
        <section className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-container-margin">
          <h3 className="text-headline-sm font-bold text-amber-900 mb-stack-md flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-600">offline_bolt</span> ⚡ Early Signals Watching List
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-stack-md">
            {safeSignals.slice(0, 3).map((sig) => (
              <div key={sig.id} className="bg-surface-container-lowest border border-amber-200 rounded p-stack-md">
                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-mono-label font-bold uppercase mb-2 inline-block">
                  {sig.signal_type}
                </span>
                <h5 className="text-body-sm font-bold text-primary mb-1 line-clamp-1">{sig.title}</h5>
                <p className="text-metadata-sm text-on-surface-variant line-clamp-2 mb-2">{sig.summary}</p>
                <div className="text-metadata-sm text-on-surface-variant flex justify-between items-center">
                  <span>Source: {sig.source_name}</span>
                  <a href={sig.source_url} target="_blank" rel="noopener noreferrer" className="text-secondary font-semibold hover:underline">
                    Inspect ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Main Intel Cluster Feed Grid */}
      <section>
        <div className="flex justify-between items-center mb-stack-md">
          <h3 className="text-headline-sm font-bold text-primary">All Intelligence Clusters</h3>
          <span className="text-metadata-sm text-on-surface-variant font-mono-label">
            Showing {safeClusters.length} stories
          </span>
        </div>

        {loading ? (
          <div className="py-20 text-center text-on-surface-variant text-body-sm flex flex-col items-center justify-center gap-2">
            <span className="material-symbols-outlined text-secondary text-3xl animate-spin">radar</span>
            <span>Polling sources & deduplicating AI intelligence...</span>
          </div>
        ) : safeClusters.length === 0 ? (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-12 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl mb-2 text-outline">search_off</span>
            <p className="font-semibold text-primary">No story clusters found for "{category}".</p>
            <button
              onClick={() => setCategory('All')}
              className="mt-3 px-4 py-1.5 bg-primary text-on-primary rounded text-xs font-bold"
            >
              Show All Categories
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-stack-lg">
            {safeClusters.map((cluster) => (
              <div
                key={cluster.id}
                onClick={() => onSelectCluster(cluster)}
                className="cursor-pointer bg-surface-container-lowest border border-outline-variant hover:border-secondary rounded-lg p-container-margin transition-all shadow-sm flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-stack-sm">
                    <span className="px-2 py-1 bg-secondary/10 text-secondary rounded text-mono-label uppercase tracking-wider font-semibold">
                      {cluster.category}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-metadata-sm text-on-surface-variant">
                        {formatTimeAgo(cluster.last_updated_at)}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveShareItem(cluster);
                        }}
                        title="Share story"
                        className="text-on-surface-variant hover:text-secondary p-1 rounded hover:bg-surface-container-low transition-colors"
                      >
                        <span className="material-symbols-outlined text-[16px]">share</span>
                      </button>
                    </div>
                  </div>

                  <h4 className="text-headline-sm font-bold text-primary group-hover:text-secondary transition-colors mb-stack-sm leading-snug line-clamp-2">
                    {cluster.cluster_title}
                  </h4>

                  <p className="text-body-sm text-on-surface-variant line-clamp-3 leading-relaxed mb-stack-md">
                    {cluster.summary}
                  </p>
                </div>

                <div className="pt-stack-sm border-t border-outline-variant flex items-center justify-between text-metadata-sm">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-green-700 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-600"></span> {cluster.status || 'Confirmed'}
                    </span>
                    <span className="text-mono-label bg-surface-container-low px-1.5 py-0.5 rounded border border-outline-variant">
                      Radar {cluster.radar_score}
                    </span>
                  </div>

                  <span className="text-secondary font-semibold group-hover:underline flex items-center gap-0.5">
                    {cluster.primary_source_name || 'Primary Source'} <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
