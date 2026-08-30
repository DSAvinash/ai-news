import React, { useEffect, useState } from 'react';

interface TopicsGridProps {
  onSelectTopic: (slug: string) => void;
}

export const TopicsGrid: React.FC<TopicsGridProps> = ({ onSelectTopic }) => {
  const [topics, setTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTopics = () => {
    setLoading(true);
    fetch('/api/topics')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setTopics(data.data);
      })
      .catch((err) => console.error('[TopicsGrid] Error fetching:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTopics();
  }, []);

  const handleToggleFollow = async (e: React.MouseEvent, slug: string, currentFollow: boolean) => {
    e.stopPropagation();
    setTopics((prev) =>
      prev.map((t) => (t.slug === slug ? { ...t, followed: !currentFollow } : t))
    );
    await fetch(`/api/topics/${slug}/follow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ followed: !currentFollow, notificationLevel: 'IMPORTANT' })
    });
  };

  const categories = Array.from(new Set(topics.map((t) => t.category)));

  return (
    <div className="space-y-stack-lg animate-fadeIn">
      <div className="border-b border-outline-variant pb-stack-md flex justify-between items-center">
        <div>
          <h2 className="text-headline-md font-bold text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">grid_view</span>
            Topic Intelligence Directory
          </h2>
          <p className="text-body-sm text-on-surface-variant">
            Explore dedicated intelligence channels across foundation models, agentic workflows, research, and governance.
          </p>
        </div>
        <span className="text-metadata-sm font-mono-label bg-surface-container-low px-3 py-1 rounded border border-outline-variant text-on-surface-variant">
          {topics.length} Active Channels
        </span>
      </div>

      {loading ? (
        <div className="py-24 text-center text-on-surface-variant text-body-sm flex flex-col items-center justify-center gap-2">
          <span className="material-symbols-outlined text-secondary text-3xl animate-spin">radar</span>
          <span>Loading topic intelligence directory...</span>
        </div>
      ) : (
        <div className="space-y-stack-lg">
          {categories.map((cat) => {
            const categoryTopics = topics.filter((t) => t.category === cat);
            return (
              <section key={cat}>
                <h3 className="text-headline-sm font-bold text-primary mb-stack-md uppercase tracking-wider text-xs font-mono-label border-l-2 border-secondary pl-2">
                  {cat}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-stack-md">
                  {categoryTopics.map((topic) => (
                    <div
                      key={topic.slug}
                      onClick={() => onSelectTopic(topic.slug)}
                      className="cursor-pointer bg-surface-container-lowest border border-outline-variant hover:border-secondary rounded-lg p-container-margin transition-all shadow-sm flex flex-col justify-between group"
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
                            <h4 className="text-headline-sm font-bold text-primary group-hover:text-secondary transition-colors">
                              {topic.name}
                            </h4>
                          </div>

                          <button
                            onClick={(e) => handleToggleFollow(e, topic.slug, topic.followed)}
                            title={topic.followed ? 'Following' : 'Follow topic'}
                            className={`p-1.5 rounded-full transition-colors ${
                              topic.followed
                                ? 'text-secondary bg-secondary/10 hover:bg-secondary/20'
                                : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-low'
                            }`}
                          >
                            <span className={`material-symbols-outlined text-lg ${topic.followed ? 'filled-icon' : ''}`}>
                              {topic.followed ? 'check_circle' : 'add_circle'}
                            </span>
                          </button>
                        </div>

                        <p className="text-body-sm text-on-surface-variant line-clamp-2 leading-relaxed mb-stack-md">
                          {topic.description}
                        </p>
                      </div>

                      <div className="pt-stack-sm border-t border-outline-variant flex items-center justify-between text-metadata-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-mono-label bg-surface-container-low px-1.5 py-0.5 rounded border border-outline-variant">
                            {topic.story_count || 0} stories
                          </span>
                          <span className="text-metadata-sm text-on-surface-variant">
                            Momentum: <strong className="text-primary">{topic.momentum_score || 70}</strong>
                          </span>
                        </div>

                        <span className="text-secondary font-semibold group-hover:underline flex items-center gap-0.5">
                          Inspect <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
