import React from 'react';
import { EarlySignal } from '../types';
import { Zap, ExternalLink, HelpCircle } from 'lucide-react';

interface EarlySignalsBannerProps {
  signals: EarlySignal[];
  onSelectSignal?: (signal: EarlySignal) => void;
}

export const EarlySignalsBanner: React.FC<EarlySignalsBannerProps> = ({ signals }) => {
  if (!signals || signals.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-4 h-4 text-amber-400 fill-amber-400/20" />
        <h3 className="text-sm font-bold tracking-wide uppercase text-amber-400">⚡ EARLY SIGNALS (WATCHING)</h3>
        <span className="text-xs text-slate-500 hidden sm:inline-block">— Research, repos & community signals prior to official confirmation</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {signals.map((signal) => (
          <div
            key={signal.id}
            className="glass-card rounded-xl p-3.5 border border-amber-500/20 bg-amber-950/10 hover:border-amber-500/40 transition-all"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {signal.signal_type}
              </span>
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <HelpCircle className="w-3 h-3 text-amber-400/80" /> Confidence: {signal.confidence}
              </span>
            </div>

            <h4 className="text-sm font-semibold text-slate-100 mb-1 line-clamp-2 hover:text-amber-300">
              {signal.title}
            </h4>

            <p className="text-xs text-slate-400 line-clamp-2 mb-3">
              {signal.summary}
            </p>

            <div className="flex items-center justify-between text-[11px] pt-2 border-t border-amber-500/10">
              <span className="text-slate-400">Source: <strong className="text-slate-300">{signal.source_name}</strong></span>
              <a
                href={signal.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 hover:underline flex items-center gap-1 font-medium"
              >
                Inspect <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
