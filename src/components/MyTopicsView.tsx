import React, { useEffect, useState } from 'react';

interface MyTopicsViewProps {
  onSelectTopic: (slug: string) => void;
}

export const MyTopicsView: React.FC<MyTopicsViewProps> = ({ onSelectTopic }) => {
  const [followedTopics, setFollowedTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFollowedTopics = () => {
    setLoading(true);
    fetch('/api/user/topics')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setFollowedTopics(data.data);
      })
      .catch((err) => console.error('[MyTopics] Error loading:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchFollowedTopics();
  }, []);

  const handleUnfollow = async (e: React.MouseEvent, slug: string) => {
    e.stopPropagation();
    setFollowedTopics((prev) => prev.filter((t) => t.slug !== slug));
    await fetch(`/api/topics/${slug}/follow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ followed: false })
    });
  };

  return (
    <div className="space-y-stack-lg animate-fadeIn">
      <div className="border-b border-outline-variant pb-stack-md flex justify-between items-center">
        <div>
          <h2 className="text-headline-md font-bold text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary filled-icon">check_circle</span>
            My Followed Topics
          </h2>
          <p className="text-body-sm text-on-surface-variant">
            Your personalized intelligence feed channels. Tailored updates included in your 7 AM daily email briefing.
          </p>
        </div>
        <span className="text-metadata-sm font-mono-label bg-surface-container-low px-3 py-1 rounded border border-outline-variant text-on-surface-variant">
          {followedTopics.length} Followed Channels
        </span>
      </div>

      {loading ? (
        <div className="py-24 text-center text-on-surface-variant text-body-sm flex flex-col items-center justify-center gap-2">
          <span className="material-symbols-outlined text-secondary text-3xl animate-spin">sync</span>
          <span>Loading followed topics...</span>
        </div>
      ) : followedTopics.length === 0 ? (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-16 text-center text-on-surface-variant">
          <span className="material-symbols-outlined text-5xl mb-3 text-secondary/40">grid_view</span>
          <h3 className="text-headline-sm font-bold text-primary mb-1">No Topics Followed Yet</h3>
          <p className="text-body-sm text-on-surface-variant max-w-md mx-auto mb-4">
            Follow topics in the directory to build your personalized intelligence channels and custom email digests.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-stack-lg">
          {followedTopics.map((topic) => (
            <div
              key={topic.slug}
              onClick={() => onSelectTopic(topic.slug)}
              className="cursor-pointer bg-surface-container-lowest border border-secondary/30 hover:border-secondary rounded-lg p-container-margin transition-all shadow-sm flex flex-col justify-between group relative"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-stack-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-lg text-white flex items-center justify-center font-bold text-sm shadow-sm"
                      style={{ backgroundColor: topic.color || '#4b41e1' }}
                    >
                      <span className="material-symbols-outlined text-sm">{topic.icon || 'grid_view'}</span>
                    </div>
                    <div>
                      <h4 className="text-headline-sm font-bold text-primary group-hover:text-secondary transition-colors">
                        {topic.name}
                      </h4>
                      <span className="text-metadata-sm text-on-surface-variant font-mono-label">
                        Notif: {topic.notification_level || 'IMPORTANT'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => handleUnfollow(e, topic.slug)}
                    title="Unfollow topic"
                    className="text-on-surface-variant hover:text-red-600 transition-colors p-1 rounded-full hover:bg-red-50"
                  >
                    <span className="material-symbols-outlined text-lg">do_not_disturb_on</span>
                  </button>
                </div>

                <p className="text-body-sm text-on-surface-variant line-clamp-2 leading-relaxed mb-stack-md">
                  {topic.description}
                </p>

                {topic.latest_story && (
                  <div className="p-stack-md bg-surface-container-low rounded border border-outline-variant mb-stack-md">
                    <div className="text-metadata-sm font-bold uppercase text-secondary mb-1">Latest Development</div>
                    <div className="text-body-sm font-bold text-primary line-clamp-1">{topic.latest_story.cluster_title}</div>
                    <div className="text-metadata-sm text-on-surface-variant line-clamp-2 mt-0.5">{topic.latest_story.summary}</div>
                  </div>
                )}
              </div>

              <div className="pt-stack-sm border-t border-outline-variant flex items-center justify-between text-metadata-sm">
                <div className="flex items-center gap-2">
                  <span className="text-mono-label bg-surface-container-low px-1.5 py-0.5 rounded border border-outline-variant">
                    {topic.story_count || 0} stories
                  </span>
                  <span className="text-metadata-sm text-on-surface-variant">
                    Momentum: <strong className="text-primary">{topic.momentum_score || 75}</strong>
                  </span>
                </div>

                <span className="text-secondary font-semibold group-hover:underline flex items-center gap-0.5">
                  Open Channel <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
