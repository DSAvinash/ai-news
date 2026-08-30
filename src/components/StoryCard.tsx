import React from 'react';
import { StoryCluster } from '../types';
import { ExternalLink, ShieldCheck, Layers, ChevronRight } from 'lucide-react';

interface StoryCardProps {
  cluster: StoryCluster;
  onSelect: (cluster: StoryCluster) => void;
}

export const StoryCard: React.FC<StoryCardProps> = ({ cluster, onSelect }) => {
  const formatTimeAgo = (isoString: string) => {
    if (!isoString) return '';
    const diffMins = Math.max(1, Math.floor((Date.now() - new Date(isoString).getTime()) / 60000));
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  const getConfidenceBadge = (confidence: number, status: string) => {
    if (status === 'CONFIRMED' || confidence >= 90) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Confirmed
        </span>
      );
    }
    if (status === 'REPORTED' || confidence >= 65) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-400">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span> Reported
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Unconfirmed
      </span>
    );
  };

  return (
    <div
      onClick={() => onSelect(cluster)}
      className="glass-card cursor-pointer rounded-2xl p-4 md:p-5 border border-slate-800/80 hover:border-sky-500/40 flex flex-col justify-between group transition-all"
    >
      <div>
        {/* Header: Category & Time */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-800/90 text-slate-300 border border-slate-700/60">
            {cluster.category}
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            {formatTimeAgo(cluster.last_updated_at)}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-base font-bold text-slate-100 group-hover:text-sky-300 transition-colors leading-snug mb-2 line-clamp-2">
          {cluster.cluster_title}
        </h3>

        {/* Summary */}
        <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed mb-3">
          {cluster.summary}
        </p>

        {/* Why It Matters */}
        {cluster.why_it_matters && (
          <div className="bg-slate-900/80 rounded-lg p-2.5 mb-3 border border-slate-800/60 text-xs text-slate-400">
            <strong className="text-slate-200">Why it matters:</strong> {cluster.why_it_matters}
          </div>
        )}
      </div>

      {/* Footer Details */}
      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs mt-auto">
        <div className="flex items-center gap-2">
          {getConfidenceBadge(cluster.confidence_score, cluster.status)}
          
          <span className="text-[10px] text-slate-500 font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
            Radar {cluster.radar_score}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {cluster.supporting_count && cluster.supporting_count > 1 && (
            <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
              <Layers className="w-3 h-3 text-slate-500" /> +{cluster.supporting_count - 1} reports
            </span>
          )}

          <a
            href={cluster.primary_source_url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-xs font-semibold text-sky-400 hover:text-sky-300 hover:underline flex items-center gap-1"
          >
            {cluster.primary_source_name || 'Read source'} <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};
