import React, { useEffect, useState } from 'react';

interface GoogleSkillDetailModalProps {
  resourceId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onBookmarkToggled?: (resourceId: number, saved: boolean) => void;
}

export const GoogleSkillDetailModal: React.FC<GoogleSkillDetailModalProps> = ({
  resourceId,
  isOpen,
  onClose,
  onBookmarkToggled
}) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && resourceId) {
      setLoading(true);
      setFeedbackSent(null);
      fetch(`/api/google-skills/${resourceId}?user_id=default_user`)
        .then((res) => res.json())
        .then((json) => {
          if (json.success) setData(json.data);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [isOpen, resourceId]);

  if (!isOpen || !resourceId) return null;

  const handleOpenGoogle = async () => {
    try {
      const res = await fetch(`/api/google-skills/${resourceId}/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: 'default_user' })
      });
      const json = await res.json();
      if (json.success && json.verified_url) {
        window.open(json.verified_url, '_blank', 'noopener,noreferrer');
      }
    } catch (e) {
      console.error('Error opening Google resource:', e);
    }
  };

  const handleToggleBookmark = async () => {
    try {
      const res = await fetch(`/api/google-skills/${resourceId}/bookmark`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: 'default_user' })
      });
      const json = await res.json();
      if (json.success) {
        setData((prev: any) => ({ ...prev, saved: json.saved }));
        if (onBookmarkToggled) onBookmarkToggled(resourceId, json.saved);
      }
    } catch (e) {
      console.error('Error toggling bookmark:', e);
    }
  };

  const handleFeedback = async (helpful: boolean) => {
    try {
      await fetch(`/api/google-skills/${resourceId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: 'default_user', helpful })
      });
      setFeedbackSent(helpful ? 'POSITIVE' : 'NEGATIVE');
    } catch (e) {
      console.error('Error sending feedback:', e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between bg-surface-container-low">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">verified</span>
            <span className="text-xs font-bold text-primary uppercase tracking-wider">
              {data?.provider || 'Google Skills Intelligence'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading || !data ? (
            <div className="space-y-4 py-8">
              <div className="h-8 bg-surface-container-low rounded-md animate-pulse w-3/4" />
              <div className="h-20 bg-surface-container-low rounded-md animate-pulse" />
              <div className="h-32 bg-surface-container-low rounded-md animate-pulse" />
            </div>
          ) : (
            <>
              {/* Title & Metadata Pills */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full border border-primary/20">
                    {data.resource_type || 'Course'}
                  </span>
                  <span className="px-2.5 py-1 bg-surface-container-high text-on-surface text-xs font-medium rounded-full">
                    {data.difficulty || 'Beginner'}
                  </span>
                  <span className="px-2.5 py-1 bg-surface-container-high text-on-surface text-xs font-medium rounded-full">
                    ⏱ {data.duration || '2 hours'}
                  </span>
                  {data.industry_relevance_score && (
                    <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-full border border-emerald-500/20">
                      ⚡ Industry Relevance: {data.industry_relevance_score}/100
                    </span>
                  )}
                </div>

                <h2 className="text-xl md:text-2xl font-bold text-on-surface leading-tight">
                  {data.title}
                </h2>

                <p className="text-sm text-on-surface-variant leading-relaxed">
                  {data.description || 'Comprehensive learning path provided by official Google learning platforms.'}
                </p>
              </div>

              {/* Mapped Skills & Taxonomy */}
              {data.mapped_skills && data.mapped_skills.length > 0 && (
                <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/60 space-y-2">
                  <div className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-primary">hub</span>
                    Connected AI Skill Radar
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {data.mapped_skills.map((sk: any) => (
                      <span
                        key={sk.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-surface-container-lowest text-on-surface text-xs font-medium rounded-lg border border-outline-variant"
                      >
                        <span>{sk.name}</span>
                        <span className="text-[10px] font-bold text-primary px-1.5 py-0.2 bg-primary/10 rounded">
                          {sk.momentum}/100
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* "What Changed?" Version Diff Log (PRD §20 & §23) */}
              {data.changes && data.changes.length > 0 && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-2">
                  <div className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">history</span>
                    What Changed Recently?
                  </div>
                  <div className="space-y-1.5 pt-1">
                    {data.changes.map((ch: any, idx: number) => (
                      <div key={idx} className="text-xs text-on-surface-variant flex items-start gap-2">
                        <span className="font-semibold text-amber-600">~</span>
                        <span>
                          <strong className="text-on-surface capitalize">{ch.change_type.toLowerCase()}:</strong>{' '}
                          {ch.new_value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Prerequisites Tree */}
              {data.prerequisites && data.prerequisites.length > 0 && (
                <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/60 space-y-2">
                  <div className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-primary">account_tree</span>
                    Prerequisites & Foundational Skills
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {data.prerequisites.map((p: any) => (
                      <span
                        key={p.id}
                        className="px-2.5 py-1 bg-surface-container-high text-on-surface-variant text-xs rounded-md"
                      >
                        ✓ {p.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Related AI Story Clusters */}
              {data.related_clusters && data.related_clusters.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-primary">newspaper</span>
                    Related Industry Intelligence
                  </div>
                  <div className="space-y-2">
                    {data.related_clusters.map((cluster: any) => (
                      <div
                        key={cluster.id}
                        className="p-3 bg-surface-container-low rounded-lg border border-outline-variant/50 hover:border-primary/40 transition-colors"
                      >
                        <div className="text-xs font-semibold text-on-surface">{cluster.cluster_title}</div>
                        <div className="text-[11px] text-on-surface-variant line-clamp-1 mt-0.5">
                          {cluster.summary}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Feedback Section (PRD §42 & §52) */}
              <div className="pt-2 border-t border-outline-variant/60 flex items-center justify-between">
                <span className="text-xs text-on-surface-variant">Is this recommendation helpful?</span>
                <div className="flex items-center gap-2">
                  {feedbackSent ? (
                    <span className="text-xs text-emerald-600 font-medium">✓ Feedback recorded</span>
                  ) : (
                    <>
                      <button
                        onClick={() => handleFeedback(true)}
                        className="px-2.5 py-1 bg-surface-container-high hover:bg-surface-container text-xs font-medium rounded-lg text-on-surface flex items-center gap-1 transition-colors"
                      >
                        <span>👍</span> Helpful
                      </button>
                      <button
                        onClick={() => handleFeedback(false)}
                        className="px-2.5 py-1 bg-surface-container-high hover:bg-surface-container text-xs font-medium rounded-lg text-on-surface flex items-center gap-1 transition-colors"
                      >
                        <span>👎</span> Not Relevant
                      </button>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-outline-variant bg-surface-container-low flex items-center justify-between gap-4">
          <button
            onClick={handleToggleBookmark}
            className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-all ${
              data?.saved
                ? 'bg-primary/15 text-primary border border-primary/30'
                : 'bg-surface-container-high text-on-surface hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-sm">
              {data?.saved ? 'bookmark_added' : 'bookmark_add'}
            </span>
            {data?.saved ? 'Saved in My Learning' : 'Save Resource'}
          </button>

          <button
            onClick={handleOpenGoogle}
            className="px-5 py-2 bg-primary text-on-primary rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-inverse-surface transition-all shadow-sm"
          >
            <span>Open Official Google Resource</span>
            <span className="material-symbols-outlined text-sm">open_in_new</span>
          </button>
        </div>
      </div>
    </div>
  );
};
