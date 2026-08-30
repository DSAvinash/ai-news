import React, { useEffect, useState } from 'react';
import { StoryCluster } from '../types';

interface TopicDetailViewProps {
  slug: string;
  onBack: () => void;
  onSelectCluster: (cluster: StoryCluster) => void;
  onSelectTopic?: (slug: string) => void;
}

export const TopicDetailView: React.FC<TopicDetailViewProps> = ({
  slug,
  onBack,
  onSelectCluster,
  onSelectTopic
}) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [notificationLevel, setNotificationLevel] = useState('IMPORTANT');

  const fetchTopicData = () => {
    setLoading(true);
    fetch(`/api/topics/${slug}`)
      .then((res) => res.json())
      .then((resData) => {
        if (resData.success) {
          setData(resData.data);
          setIsFollowing(resData.data.topic.followed);
          setNotificationLevel(resData.data.topic.notification_level || 'IMPORTANT');
        }
      })
      .catch((err) => console.error('[TopicDetail] Error loading:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTopicData();
  }, [slug]);

  const handleToggleFollow = async () => {
    const nextFollowState = !isFollowing;
    setIsFollowing(nextFollowState);
    await fetch(`/api/topics/${slug}/follow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ followed: nextFollowState, notificationLevel })
    });
  };

  const handleChangeNotificationLevel = async (level: string) => {
    setNotificationLevel(level);
    await fetch(`/api/topics/${slug}/follow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ followed: isFollowing, notificationLevel: level })
    });
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-on-surface-variant flex flex-col items-center justify-center gap-3">
        <span className="material-symbols-outlined text-secondary text-4xl animate-spin">radar</span>
        <span className="text-body-sm font-medium">Aggregating topic intelligence for {slug}...</span>
      </div>
    );
  }

  if (!data || !data.topic) {
    return (
      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-12 text-center">
        <p className="text-body-md font-bold text-primary mb-3">Topic not found.</p>
        <button onClick={onBack} className="px-4 py-2 bg-primary text-white rounded text-xs font-bold">
          Return to Overview
        </button>
      </div>
    );
  }

  const { topic, summary, metrics, clusters, early_signals, what_changed, companies_to_watch, models_and_products, related_topics } = data;

  return (
    <div className="space-y-stack-lg animate-fadeIn">
      {/* Breadcrumb & Navigation */}
      <div className="flex justify-between items-center mb-stack-sm">
        <div className="flex items-center gap-2 text-metadata-sm text-on-surface-variant">
          <button onClick={onBack} className="hover:text-secondary transition-colors">
            Topics
          </button>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-metadata-sm font-mono-label uppercase text-secondary">{topic.category}</span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-primary font-semibold">{topic.name}</span>
        </div>

        <button onClick={onBack} className="px-3 py-1.5 border border-outline-variant rounded bg-surface hover:bg-surface-container-low text-metadata-sm font-medium transition-colors flex items-center gap-1">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span> Back to Directory
        </button>
      </div>

      {/* Topic Header Card */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-container-margin shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-stack-md">
          <div className="flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-xl text-white flex items-center justify-center shrink-0 shadow-sm"
              style={{ backgroundColor: topic.color || '#4b41e1' }}
            >
              <span className="material-symbols-outlined text-2xl">{topic.icon || 'grid_view'}</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-mono-label px-2 py-0.5 rounded bg-surface-container-low border border-outline-variant uppercase text-secondary font-bold">
                  {topic.category}
                </span>
                <span className="text-metadata-sm text-on-surface-variant flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span> Monitoring {metrics.sources_count || 31} sources
                </span>
              </div>
              <h1 className="text-display-sm font-bold text-primary mt-1">{topic.name}</h1>
              <p className="text-body-sm text-on-surface-variant max-w-2xl mt-1">{topic.description}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-outline-variant">
            <button
              onClick={handleToggleFollow}
              className={`px-4 py-2 rounded-lg text-body-sm font-bold transition-all flex items-center justify-center gap-2 shadow-sm ${
                isFollowing
                  ? 'bg-secondary text-white hover:bg-primary'
                  : 'bg-surface-container-low text-primary border border-outline-variant hover:bg-surface-container'
              }`}
            >
              <span className={`material-symbols-outlined text-sm ${isFollowing ? 'filled-icon' : ''}`}>
                {isFollowing ? 'check_circle' : 'add_circle'}
              </span>
              {isFollowing ? 'Following Topic' : 'Follow Topic'}
            </button>

            {isFollowing && (
              <select
                value={notificationLevel}
                onChange={(e) => handleChangeNotificationLevel(e.target.value)}
                className="px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg text-body-sm text-primary font-medium focus:ring-2 focus:ring-secondary focus:outline-none"
              >
                <option value="OFF">Notification: Off</option>
                <option value="DAILY">Notification: Daily Briefing</option>
                <option value="IMPORTANT">Notification: Important Only</option>
                <option value="BREAKING">Notification: Breaking Only</option>
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Topic Intelligence Summary */}
      {summary && (
        <section className="bg-surface-container-lowest border border-secondary/30 rounded-lg p-container-margin shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-secondary"></div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-sm">sparkles</span>
              <span className="text-metadata-sm font-bold uppercase tracking-wider text-secondary">
                {topic.name.toUpperCase()} — INTELLIGENCE SUMMARY
              </span>
            </div>
            <span className="text-metadata-sm text-on-surface-variant">Cached • Updated recently</span>
          </div>
          <h2 className="text-headline-sm font-bold text-primary mb-2">{summary.headline}</h2>
          <p className="text-body-sm text-on-surface-variant leading-relaxed">{summary.summary}</p>
        </section>
      )}

      {/* Lightweight Intelligence Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-stack-sm text-center">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-stack-md shadow-sm">
          <div className="text-display-sm font-bold text-primary">{metrics.stories_today}</div>
          <div className="text-metadata-sm text-on-surface-variant font-mono-label">Stories Today</div>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-stack-md shadow-sm">
          <div className="text-display-sm font-bold text-secondary">{metrics.high_signal_count}</div>
          <div className="text-metadata-sm text-on-surface-variant font-mono-label">High-Signal</div>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-stack-md shadow-sm">
          <div className="text-display-sm font-bold text-red-600">{metrics.breaking_count}</div>
          <div className="text-metadata-sm text-on-surface-variant font-mono-label">Breaking</div>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-stack-md shadow-sm">
          <div className="text-display-sm font-bold text-amber-600">{metrics.early_signals_count}</div>
          <div className="text-metadata-sm text-on-surface-variant font-mono-label">Early Signals</div>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-stack-md shadow-sm col-span-2 sm:col-span-1">
          <div className="text-display-sm font-bold text-primary">{topic.momentum_score || 75}</div>
          <div className="text-metadata-sm text-on-surface-variant font-mono-label">Radar Momentum</div>
        </div>
      </div>

      {/* Main Bento Grid for Topic Details */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-stack-lg">
        {/* Left 2 Columns */}
        <div className="xl:col-span-2 space-y-stack-lg">
          {/* Top Signals */}
          <section>
            <h3 className="text-headline-sm font-bold text-primary mb-stack-md flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">star</span> Top Signals
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-stack-md">
              {clusters.slice(0, 6).map((cluster: any) => (
                <div
                  key={cluster.id}
                  onClick={() => onSelectCluster(cluster)}
                  className="cursor-pointer bg-surface-container-lowest border border-outline-variant hover:border-secondary rounded-lg p-container-margin transition-all shadow-sm flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-stack-sm">
                      <span className="px-2 py-0.5 bg-secondary/10 text-secondary rounded text-mono-label uppercase font-bold">
                        {cluster.category}
                      </span>
                      <span className="text-metadata-sm text-on-surface-variant">Radar {cluster.radar_score}</span>
                    </div>

                    <h4 className="text-body-md font-bold text-primary group-hover:text-secondary transition-colors mb-2 line-clamp-2">
                      {cluster.cluster_title}
                    </h4>

                    <p className="text-body-sm text-on-surface-variant line-clamp-2 mb-3">
                      {cluster.summary}
                    </p>
                  </div>

                  <div className="pt-stack-sm border-t border-outline-variant flex items-center justify-between text-metadata-sm text-on-surface-variant">
                    <span>{cluster.primary_source_name || 'Primary Source'}</span>
                    <span className="text-secondary font-semibold group-hover:underline flex items-center gap-0.5">
                      Read Signal <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* What Changed? */}
          {what_changed && (
            <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-container-margin shadow-sm">
              <h3 className="text-headline-sm font-bold text-primary mb-stack-md flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">difference</span> What Changed?
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-stack-md mb-stack-md">
                <div className="p-stack-md bg-surface border border-outline-variant rounded">
                  <div className="text-metadata-sm text-on-surface-variant uppercase font-mono-label mb-1">Previous 24 Hours</div>
                  <div className="text-headline-sm font-bold text-primary">{what_changed.previous_24h_count} significant developments</div>
                </div>
                <div className="p-stack-md bg-secondary/5 border border-secondary/20 rounded">
                  <div className="text-metadata-sm text-secondary uppercase font-mono-label font-bold mb-1">Latest 24 Hours</div>
                  <div className="text-headline-sm font-bold text-primary">{what_changed.latest_24h_count} significant developments</div>
                </div>
              </div>
              <p className="text-body-sm text-on-surface-variant leading-relaxed">
                <strong>Activity Trend ({what_changed.trend}):</strong> {what_changed.explanation}
              </p>
            </section>
          )}
        </div>

        {/* Right Column Sidebar */}
        <div className="space-y-stack-lg">
          {/* Companies & Products to Watch */}
          <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-container-margin shadow-sm">
            <h3 className="text-headline-sm font-bold text-primary mb-stack-md flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">domain</span> Companies to Watch
            </h3>
            {companies_to_watch.length === 0 ? (
              <p className="text-body-sm text-on-surface-variant">General enterprise & community sources active.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {companies_to_watch.map((comp: string) => (
                  <span key={comp} className="px-3 py-1 bg-surface-container-low border border-outline-variant rounded text-body-sm font-semibold text-primary">
                    {comp}
                  </span>
                ))}
              </div>
            )}

            {models_and_products.length > 0 && (
              <div className="mt-stack-md pt-stack-md border-t border-outline-variant">
                <h4 className="text-metadata-lg font-bold text-primary uppercase mb-2">Models & Products</h4>
                <div className="flex flex-wrap gap-2">
                  {models_and_products.map((mod: string) => (
                    <span key={mod} className="px-2.5 py-1 bg-secondary/10 text-secondary border border-secondary/20 rounded text-metadata-sm font-mono-label font-semibold">
                      {mod}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Early Signals */}
          {early_signals.length > 0 && (
            <section className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-container-margin shadow-sm">
              <h3 className="text-headline-sm font-bold text-amber-900 mb-stack-md flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600">offline_bolt</span> Early Signals
              </h3>
              <div className="space-y-3">
                {early_signals.map((sig: any) => (
                  <div key={sig.id} className="p-3 bg-surface-container-lowest border border-amber-200 rounded">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-metadata-sm font-bold text-amber-800 uppercase">{sig.signal_type}</span>
                      <span className="text-metadata-sm px-1.5 py-0.5 bg-amber-100 text-amber-900 rounded font-bold">NOT CONFIRMED</span>
                    </div>
                    <h5 className="text-body-sm font-bold text-primary mb-1">{sig.title}</h5>
                    <p className="text-metadata-sm text-on-surface-variant line-clamp-2">{sig.summary}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Related Topics */}
          {related_topics && related_topics.length > 0 && (
            <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-container-margin shadow-sm">
              <h3 className="text-headline-sm font-bold text-primary mb-stack-md flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">hub</span> Related Topics
              </h3>
              <div className="flex flex-wrap gap-2">
                {related_topics.map((rel: any) => (
                  <button
                    key={rel.slug}
                    onClick={() => onSelectTopic && onSelectTopic(rel.slug)}
                    className="px-3 py-1.5 bg-surface-container-low hover:bg-surface-container border border-outline-variant rounded-lg text-body-sm font-medium text-primary transition-colors flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-xs text-secondary">{rel.icon || 'grid_view'}</span>
                    {rel.name}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
