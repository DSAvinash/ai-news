import React from 'react';
import { StoryCluster } from '../types';
import { Flame, ArrowRight } from 'lucide-react';

interface BreakingBannerProps {
  breakingClusters: StoryCluster[];
  onSelectCluster: (cluster: StoryCluster) => void;
}

export const BreakingBanner: React.FC<BreakingBannerProps> = ({ breakingClusters, onSelectCluster }) => {
  if (!breakingClusters || breakingClusters.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Flame className="w-4 h-4 text-rose-500 fill-rose-500/20 animate-bounce" />
        <h3 className="text-sm font-bold tracking-wide uppercase text-rose-400">BREAKING DEVELOPMENTS</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {breakingClusters.map((cluster) => (
          <div
            key={cluster.id}
            onClick={() => onSelectCluster(cluster)}
            className="glass-card cursor-pointer rounded-xl p-4 border border-rose-500/30 bg-rose-950/20 hover:border-rose-500/50 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-500 text-white animate-pulse">
                  BREAKING
                </span>
                <span className="text-[11px] text-slate-400 font-mono">Radar Score: {cluster.radar_score}</span>
              </div>

              <h4 className="text-base font-bold text-white mb-2 leading-snug hover:text-rose-200">
                {cluster.cluster_title}
              </h4>

              <p className="text-xs text-slate-300 line-clamp-2 mb-3">
                {cluster.summary}
              </p>
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-rose-500/20">
              <span className="text-slate-400">Primary: <strong className="text-slate-200">{cluster.primary_source_name || 'Verified Source'}</strong></span>
              <span className="text-rose-400 font-medium flex items-center gap-1 hover:underline">
                View Intelligence <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
