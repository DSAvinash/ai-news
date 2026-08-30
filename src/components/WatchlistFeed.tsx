import React, { useEffect, useState } from 'react';
import { StoryCluster } from '../types';

interface WatchlistFeedProps {
  onSelectCluster: (cluster: StoryCluster) => void;
}

export const WatchlistFeed: React.FC<WatchlistFeedProps> = ({ onSelectCluster }) => {
  const [watchlist, setWatchlist] = useState<StoryCluster[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWatchlist = () => {
    setLoading(true);
    fetch('/api/watchlist')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setWatchlist(data.data);
        } else {
          setWatchlist([]);
        }
      })
      .catch((err) => {
        console.error('[Watchlist] Error fetching:', err);
        setWatchlist([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchWatchlist();
  }, []);

  const handleRemove = async (e: React.MouseEvent, clusterId: number) => {
    e.stopPropagation();
    setWatchlist((prev) => prev.filter((item) => item.id !== clusterId));
    await fetch(`/api/watchlist/${clusterId}`, { method: 'DELETE' });
  };

  const formatTimeAgo = (isoString?: string) => {
    if (!isoString) return 'Recently';
    const diffMins = Math.max(1, Math.floor((Date.now() - new Date(isoString).getTime()) / 60000));
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  return (
    <div className="space-y-stack-lg animate-fadeIn">
      <div className="flex justify-between items-center border-b border-outline-variant pb-stack-md">
        <div>
          <h2 className="text-headline-md font-bold text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-600 filled-icon">bookmark</span>
            Saved Watchlist
          </h2>
          <p className="text-body-sm text-on-surface-variant">
            Bookmark important AI developments and research signals to inspect anytime.
          </p>
        </div>
        <span className="text-metadata-sm text-on-surface-variant font-mono-label bg-surface-container-low px-3 py-1 rounded border border-outline-variant">
          {watchlist.length} Saved Stories
        </span>
      </div>

      {loading ? (
        <div className="py-20 text-center text-on-surface-variant text-body-sm flex flex-col items-center justify-center gap-2">
          <span className="material-symbols-outlined text-secondary text-3xl animate-spin">sync</span>
          <span>Loading saved watchlist stories...</span>
        </div>
      ) : watchlist.length === 0 ? (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-16 text-center text-on-surface-variant">
          <span className="material-symbols-outlined text-5xl mb-3 text-amber-500/60">bookmark_border</span>
          <h3 className="text-headline-sm font-bold text-primary mb-1">Your Watchlist is Empty</h3>
          <p className="text-body-sm text-on-surface-variant max-w-md mx-auto">
            Click the "Save" button on any story card or detail view to bookmark it here for quick access.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-stack-lg">
          {watchlist.map((cluster) => (
            <div
              key={cluster.id}
              onClick={() => onSelectCluster(cluster)}
              className="cursor-pointer bg-surface-container-lowest border border-amber-200/80 hover:border-secondary rounded-lg p-container-margin transition-all shadow-sm flex flex-col justify-between group relative"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-stack-sm">
                  <span className="px-2 py-1 bg-amber-500/10 text-amber-800 rounded text-mono-label uppercase tracking-wider font-semibold">
                    {cluster.category}
                  </span>
                  <button
                    onClick={(e) => handleRemove(e, cluster.id)}
                    title="Remove from Watchlist"
                    className="text-on-surface-variant hover:text-red-600 transition-colors p-1 rounded-full hover:bg-red-50"
                  >
                    <span className="material-symbols-outlined text-[18px]">bookmark_remove</span>
                  </button>
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
                  <span className="text-mono-label bg-surface-container-low px-1.5 py-0.5 rounded border border-outline-variant">
                    Radar {cluster.radar_score}
                  </span>
                  <span className="text-metadata-sm text-on-surface-variant">
                    Saved {formatTimeAgo(cluster.saved_at)}
                  </span>
                </div>

                <span className="text-secondary font-semibold group-hover:underline flex items-center gap-0.5">
                  View Detail <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
