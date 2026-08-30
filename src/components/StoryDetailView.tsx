import React, { useEffect, useState } from 'react';
import { StoryCluster } from '../types';
import { ShareModal } from './ShareModal';

interface StoryDetailViewProps {
  cluster: StoryCluster;
  onBack: () => void;
  allClusters?: StoryCluster[];
  onSelectCluster?: (cluster: StoryCluster) => void;
}

export const StoryDetailView: React.FC<StoryDetailViewProps> = ({
  cluster,
  onBack,
  allClusters = [],
  onSelectCluster
}) => {
  const [details, setDetails] = useState<StoryCluster | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/news/${cluster.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setDetails(data.data);
        else setDetails(cluster);
      })
      .catch(() => setDetails(cluster));
  }, [cluster]);

  const data = details || cluster;

  const formatTimeAgo = (isoString?: string) => {
    if (!isoString) return '18 min ago';
    const diffMins = Math.max(1, Math.floor((Date.now() - new Date(isoString).getTime()) / 60000));
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
    return `${Math.floor(diffMins / 1440)} days ago`;
  };

  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    fetch('/api/watchlist')
      .then((res) => res.json())
      .then((resData) => {
        if (resData.success && Array.isArray(resData.data)) {
          setIsSaved(resData.data.some((item: any) => item.id === cluster.id));
        }
      })
      .catch(() => {});
  }, [cluster.id]);

  const handleToggleSave = async () => {
    if (isSaved) {
      setIsSaved(false);
      await fetch(`/api/watchlist/${data.id}`, { method: 'DELETE' });
    } else {
      setIsSaved(true);
      await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clusterId: data.id })
      });
    }
  };

  const related = allClusters.filter((c) => c.id !== data.id).slice(0, 3);

  return (
    <div className="space-y-stack-lg animate-fadeIn">
      {/* Breadcrumb & Actions */}
      <div className="flex justify-between items-center mb-stack-lg">
        <div className="flex items-center gap-2 text-metadata-sm font-metadata-sm text-on-surface-variant">
          <button onClick={onBack} className="hover:text-secondary transition-colors">
            Intelligence
          </button>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <button onClick={onBack} className="hover:text-secondary transition-colors">
            Signals
          </button>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-primary font-medium">{data.category}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={onBack} className="px-3 py-1.5 border border-outline-variant rounded bg-surface hover:bg-surface-container-low text-metadata-sm font-medium transition-colors flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">arrow_back</span> Back to Overview
          </button>
          <button
            onClick={handleToggleSave}
            className={`px-3 py-1.5 border rounded text-metadata-sm font-medium transition-colors flex items-center gap-1 ${
              isSaved
                ? 'bg-amber-500/10 border-amber-300 text-amber-900 font-bold'
                : 'border-outline-variant bg-surface hover:bg-surface-container-low'
            }`}
          >
            <span className={`material-symbols-outlined text-[16px] ${isSaved ? 'filled-icon text-amber-600' : ''}`}>
              bookmark
            </span>
            {isSaved ? 'Saved to Watchlist' : 'Save'}
          </button>
          <button
            onClick={() => setIsShareOpen(true)}
            className="px-3 py-1.5 border border-outline-variant rounded bg-surface hover:bg-surface-container-low text-metadata-sm font-medium transition-colors flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">share</span> Share
          </button>
        </div>
      </div>

      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        title={data.cluster_title}
        summary={data.summary}
        url={data.primary_source_url || window.location.href}
      />

      {/* Header Section */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-container-margin mb-stack-lg shadow-sm">
        <div className="flex items-center gap-3 mb-stack-sm">
          <span className="px-2 py-1 bg-secondary/10 text-secondary rounded text-mono-label uppercase tracking-wider font-semibold">
            {data.category}
          </span>
          <span className="flex items-center gap-1 text-metadata-sm font-metadata-sm text-on-surface-variant">
            <span className="w-2 h-2 rounded-full bg-green-500"></span> {data.status || 'Confirmed'}
          </span>
        </div>

        <h1 className="text-display-sm font-display-sm text-primary mb-stack-md leading-tight">
          {data.cluster_title}
        </h1>

        <div className="flex flex-wrap items-center gap-6 text-metadata-sm font-metadata-sm text-on-surface-variant border-t border-outline-variant pt-stack-sm mt-stack-md">
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">schedule</span> Published: {formatTimeAgo(data.first_seen_at)}
          </div>
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">radar</span> Radar Score: <span className="text-primary font-semibold text-body-sm">{data.radar_score}</span>/100
          </div>
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">update</span> Last Updated: {formatTimeAgo(data.last_updated_at)}
          </div>
        </div>
      </div>

      {/* Bento Grid Layout for Main Content */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-stack-lg mb-stack-lg">
        {/* Left Column (Wider) */}
        <div className="xl:col-span-2 space-y-stack-lg">
          {/* Executive Summary */}
          <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-container-margin shadow-sm">
            <h3 className="text-headline-sm font-headline-sm text-primary mb-stack-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">subject</span> Executive Summary
            </h3>
            <p className="text-body-md font-body-md text-on-surface-variant leading-relaxed">
              {data.summary}
            </p>
          </section>

          {/* Why It Matters */}
          <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-container-margin shadow-sm">
            <h3 className="text-headline-sm font-headline-sm text-primary mb-stack-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">lightbulb</span> Why It Matters
            </h3>
            <p className="text-body-md font-body-md text-on-surface-variant leading-relaxed mb-stack-md">
              {data.why_it_matters || 'The introduction of robust reasoning shifts the paradigm from simple pattern matching to genuine cognitive-like processing in commercial LLMs.'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-stack-md">
              <div className="p-stack-md bg-surface-container-low rounded border border-outline-variant">
                <h4 className="text-metadata-lg font-metadata-lg text-primary mb-1 uppercase tracking-wider">Market Impact</h4>
                <p className="text-body-sm text-on-surface-variant">Likely to force competitors to accelerate reasoning-focused model releases. Anticipated increase in enterprise adoption for automated coding and QA.</p>
              </div>
              <div className="p-stack-md bg-surface-container-low rounded border border-outline-variant">
                <h4 className="text-metadata-lg font-metadata-lg text-primary mb-1 uppercase tracking-wider">Technical Impact</h4>
                <p className="text-body-sm text-on-surface-variant">Reduces reliance on complex prompt engineering chains (like Chain-of-Thought) as the model internalizes these processes.</p>
              </div>
            </div>
          </section>

          {/* Claim Analysis */}
          <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-container-margin shadow-sm">
            <h3 className="text-headline-sm font-headline-sm text-primary mb-stack-md flex items-center gap-2">
              <span class="material-symbols-outlined text-secondary">rule</span> Claim Analysis
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-stack-md">
              {/* What We Know */}
              <div className="border border-outline-variant rounded overflow-hidden">
                <div className="bg-surface-container-low px-stack-md py-stack-sm border-b border-outline-variant flex items-center gap-2">
                  <span className="material-symbols-outlined text-green-600 text-[18px]">verified</span>
                  <span className="text-metadata-lg font-bold text-primary">WHAT WE KNOW</span>
                </div>
                <ul className="p-stack-md space-y-stack-sm text-body-sm font-body-sm text-on-surface-variant">
                  {data.key_points && data.key_points.length > 0 ? (
                    data.key_points.map((pt, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0"></div>
                        <span>{pt}</span>
                      </li>
                    ))
                  ) : (
                    <>
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0"></div>
                        <span>Direct primary source announcement confirmed by {data.primary_source_name || 'Primary Feed'}.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0"></div>
                        <span>High confidence verification score ({data.confidence_score}%).</span>
                      </li>
                    </>
                  )}
                </ul>
              </div>

              {/* What Is Reported */}
              <div className="border border-outline-variant rounded overflow-hidden">
                <div className="bg-surface-container-low px-stack-md py-stack-sm border-b border-outline-variant flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-500 text-[18px]">help</span>
                  <span className="text-metadata-lg font-bold text-primary">WHAT IS REPORTED (Unverified)</span>
                </div>
                <ul className="p-stack-md space-y-stack-sm text-body-sm font-body-sm text-on-surface-variant">
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0"></div>
                    <span>Inference costs are reportedly undergoing optimization for broader API release.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0"></div>
                    <span>Independent benchmarking labs testing agentic framework integrations.</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* What Changed / Comparison */}
          <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-container-margin shadow-sm">
            <h3 className="text-headline-sm font-headline-sm text-primary mb-stack-md flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">difference</span> What Changed?
            </h3>
            <div className="grid grid-cols-2 divide-x divide-outline-variant border border-outline-variant rounded bg-surface">
              <div className="p-stack-md">
                <div className="text-metadata-sm text-on-surface-variant uppercase tracking-wider mb-2">Previous State</div>
                <div className="text-body-sm text-primary font-medium">Prompt-dependent reasoning</div>
                <div className="text-body-sm text-on-surface-variant mt-1">Users required complex CoT prompts to force step-by-step logic.</div>
              </div>
              <div className="p-stack-md bg-secondary/5">
                <div className="text-metadata-sm text-secondary uppercase tracking-wider font-semibold mb-2">Current State</div>
                <div className="text-body-sm text-primary font-medium">Native internalization</div>
                <div className="text-body-sm text-on-surface-variant mt-1">Model handles reasoning chains implicitly before generating output.</div>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column (Sidebar) */}
        <div className="space-y-stack-lg">
          {/* Timeline */}
          <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-container-margin shadow-sm">
            <h3 className="text-headline-sm font-headline-sm text-primary mb-stack-md flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">timeline</span> Event Timeline
            </h3>
            <div className="relative border-l border-outline-variant ml-3 space-y-6">
              <div className="relative pl-6">
                <div className="absolute w-3 h-3 bg-secondary rounded-full -left-[6.5px] top-1 ring-4 ring-surface-container-lowest"></div>
                <div className="text-metadata-sm text-on-surface-variant font-mono-label mb-1">Today</div>
                <div className="text-body-sm font-medium text-primary">Official Announcement</div>
                <div className="text-body-sm text-on-surface-variant mt-0.5">Published by {data.primary_source_name || 'Primary Source'}.</div>
              </div>
              <div className="relative pl-6">
                <div className="absolute w-2 h-2 bg-outline rounded-full -left-[4.5px] top-1.5 ring-4 ring-surface-container-lowest"></div>
                <div className="text-metadata-sm text-on-surface-variant font-mono-label mb-1">Recent Hours</div>
                <div className="text-body-sm font-medium text-primary">Radar Detection</div>
                <div className="text-body-sm text-on-surface-variant mt-0.5">Ingest pipeline clustered multi-feed signals.</div>
              </div>
            </div>
          </section>

          {/* Sources */}
          <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-container-margin shadow-sm">
            <h3 className="text-headline-sm font-headline-sm text-primary mb-stack-md flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">link</span> Sources
            </h3>
            <ul className="space-y-3">
              <li className="p-3 border border-outline-variant rounded bg-surface hover:bg-surface-container-low transition-colors group">
                <div className="flex justify-between items-start mb-1">
                  <div className="font-medium text-body-sm text-primary">{data.primary_source_name || 'Primary Source'}</div>
                  <span className="text-metadata-sm px-1.5 py-0.5 bg-green-100 text-green-800 rounded font-medium">Primary</span>
                </div>
                <div className="text-metadata-sm text-on-surface-variant mb-2">High Reliability • Official Release</div>
                {data.primary_source_url && (
                  <a
                    className="text-secondary text-metadata-sm font-medium flex items-center gap-1 group-hover:underline"
                    href={data.primary_source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Read original <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                  </a>
                )}
              </li>

              {data.supporting_sources && data.supporting_sources.slice(0, 3).map((art) => (
                <li key={art.id} className="p-3 border border-outline-variant rounded bg-surface hover:bg-surface-container-low transition-colors group">
                  <div className="flex justify-between items-start mb-1">
                    <div className="font-medium text-body-sm text-primary">{art.source_name || 'Secondary Source'}</div>
                    <span className="text-metadata-sm px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded font-medium">Secondary</span>
                  </div>
                  <div className="text-metadata-sm text-on-surface-variant mb-2">{art.title}</div>
                  <a
                    className="text-secondary text-metadata-sm font-medium flex items-center gap-1 group-hover:underline"
                    href={art.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Read coverage <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {/* Related Intelligence */}
      {related.length > 0 && (
        <section className="mb-stack-lg">
          <h3 className="text-headline-sm font-headline-sm text-primary mb-stack-md flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">hub</span> Related Intelligence
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-stack-md">
            {related.map((rel) => (
              <div
                key={rel.id}
                onClick={() => onSelectCluster && onSelectCluster(rel)}
                className="cursor-pointer block bg-surface-container-lowest border border-outline-variant rounded-lg p-stack-md hover:border-secondary transition-colors group"
              >
                <div className="text-metadata-sm text-on-surface-variant mb-2 font-mono-label">
                  {rel.category} • Radar {rel.radar_score}
                </div>
                <h4 className="text-body-md font-medium text-primary group-hover:text-secondary transition-colors line-clamp-2">
                  {rel.cluster_title}
                </h4>
                <div className="mt-3 flex items-center gap-2 text-metadata-sm text-on-surface-variant">
                  <span className="material-symbols-outlined text-[14px]">radar</span> Score: {rel.radar_score}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
