import React from 'react';
import { Sparkles } from 'lucide-react';

interface TodaySummaryProps {
  summary: {
    headline: string;
    executive_summary: string;
  } | null;
}

export const TodaySummary: React.FC<TodaySummaryProps> = ({ summary }) => {
  if (!summary) return null;

  return (
    <div className="glass-card rounded-2xl p-5 md:p-6 mb-6 border border-sky-500/20 bg-gradient-to-r from-sky-950/20 via-slate-900/40 to-indigo-950/20 shadow-xl">
      <div className="flex items-center gap-2 mb-2">
        <span className="p-1 rounded-md bg-sky-500/20 text-sky-300">
          <Sparkles className="w-4 h-4" />
        </span>
        <span className="text-xs font-bold uppercase tracking-wider text-sky-400">TODAY IN AI</span>
      </div>

      <h2 className="text-lg md:text-xl font-bold text-white mb-2 leading-snug">
        {summary.headline}
      </h2>

      <p className="text-sm text-slate-300 leading-relaxed max-w-4xl">
        {summary.executive_summary}
      </p>
    </div>
  );
};
