import React from 'react';
import { DashboardStats } from '../types';
import { Layers, Flame, Radio, ShieldCheck } from 'lucide-react';

interface MetricsBarProps {
  stats: DashboardStats;
}

export const MetricsBar: React.FC<MetricsBarProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
      <div className="glass-card rounded-xl p-3 border border-slate-800/80 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
          <Layers className="w-4 h-4" />
        </div>
        <div>
          <div className="text-xs text-slate-400">Analyzed Today</div>
          <div className="text-base font-bold text-slate-100 font-mono">{stats.articles_analyzed_today || 0}</div>
        </div>
      </div>

      <div className="glass-card rounded-xl p-3 border border-slate-800/80 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div>
          <div className="text-xs text-slate-400">Key Developments</div>
          <div className="text-base font-bold text-slate-100 font-mono">{stats.important_developments || 0}</div>
        </div>
      </div>

      <div className="glass-card rounded-xl p-3 border border-slate-800/80 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
          <Flame className="w-4 h-4" />
        </div>
        <div>
          <div className="text-xs text-slate-400">Breaking News</div>
          <div className="text-base font-bold text-rose-400 font-mono">{stats.breaking_count || 0}</div>
        </div>
      </div>

      <div className="glass-card rounded-xl p-3 border border-slate-800/80 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
          <Radio className="w-4 h-4 animate-pulse" />
        </div>
        <div>
          <div className="text-xs text-slate-400">Monitored Feeds</div>
          <div className="text-base font-bold text-emerald-400 font-mono">{stats.sources_monitored || 0}</div>
        </div>
      </div>
    </div>
  );
};
