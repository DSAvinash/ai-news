import React, { useEffect, useState } from 'react';
import { StoryCluster, Article } from '../types';
import { X, ExternalLink, ShieldCheck, Layers, Clock, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

interface StoryDetailModalProps {
  cluster: StoryCluster | null;
  onClose: () => void;
}

export const StoryDetailModal: React.FC<StoryDetailModalProps> = ({ cluster, onClose }) => {
  const [details, setDetails] = useState<StoryCluster | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!cluster) {
      setDetails(null);
      return;
    }

    setLoading(true);
    fetch(`/api/news/${cluster.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setDetails(data.data);
        } else {
          setDetails(cluster);
        }
      })
      .catch(() => setDetails(cluster))
      .finally(() => setLoading(false));
  }, [cluster]);

  if (!cluster) return null;

  const data = details || cluster;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div
        className="glass-panel rounded-3xl border border-slate-700/80 w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Category & Status Header */}
        <div className="flex items-center gap-2 mb-3">
          <span className="px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/30">
            {data.category}
          </span>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" /> Verification Status: {data.status}
          </span>

          <span className="text-xs text-slate-400 font-mono ml-auto">
            Radar Score: <strong className="text-sky-400">{data.radar_score}/100</strong>
          </span>
        </div>

        {/* Title */}
        <h2 className="text-xl md:text-2xl font-bold text-white mb-4 leading-snug">
          {data.cluster_title}
        </h2>

        {/* Summary Box */}
        <div className="bg-slate-900/90 rounded-xl p-4 mb-5 border border-slate-800">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">INTELLIGENCE SUMMARY</h3>
          <p className="text-sm text-slate-200 leading-relaxed mb-3">
            {data.summary}
          </p>

          {data.why_it_matters && (
            <div className="bg-sky-950/30 border-l-2 border-sky-500 p-3 rounded-r-lg text-xs text-sky-200">
              <strong>Why it matters:</strong> {data.why_it_matters}
            </div>
          )}
        </div>

        {/* Key Bullet Points */}
        {data.key_points && data.key_points.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-sky-400" /> KEY DEVELOPMENTS
            </h3>
            <ul className="space-y-2">
              {data.key_points.map((pt, idx) => (
                <li key={idx} className="text-xs text-slate-300 flex items-start gap-2 bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 mt-1.5 flex-shrink-0" />
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Source Hierarchy Transparency Box */}
        <div className="bg-slate-900/60 rounded-xl p-4 mb-6 border border-slate-800">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> SOURCE TRANSPARENCY & CONFIDENCE
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-400">
            <div>
              <span className="block text-[11px] text-slate-500">Primary Source</span>
              <strong className="text-slate-200">{data.primary_source_name || 'Primary Feed'}</strong>
            </div>

            <div>
              <span className="block text-[11px] text-slate-500">Credibility Tier</span>
              <strong className="text-emerald-400">{(data.credibility_score * 100).toFixed(0)}% Trust</strong>
            </div>

            <div>
              <span className="block text-[11px] text-slate-500">Confidence Score</span>
              <strong className="text-sky-400">{data.confidence_score}% Verified</strong>
            </div>

            <div>
              <span className="block text-[11px] text-slate-500">Supporting Coverage</span>
              <strong className="text-slate-200">{data.supporting_sources?.length || 1} Outlets</strong>
            </div>
          </div>
        </div>

        {/* Supporting Outlets List */}
        {data.supporting_sources && data.supporting_sources.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-slate-400" /> SUPPORTING & INDEPENDENT REPORTS
            </h3>

            <div className="space-y-2">
              {data.supporting_sources.map((art) => (
                <div
                  key={art.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-colors gap-2 text-xs"
                >
                  <div>
                    <div className="font-semibold text-slate-100 mb-0.5">{art.title}</div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2">
                      <span>Source: <strong className="text-slate-300">{art.source_name}</strong></span>
                      <span>•</span>
                      <span>Published: {new Date(art.published_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>

                  <a
                    href={art.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 font-semibold border border-sky-500/30 flex items-center gap-1 self-start sm:self-center flex-shrink-0"
                  >
                    Read original <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Primary Action Button */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
          >
            Close
          </button>
          {data.primary_source_url && (
            <a
              href={data.primary_source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-lg shadow-sky-500/20"
            >
              Open Primary Announcement <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
