import React, { useEffect, useState } from 'react';
import { StoryCluster } from '../types';
import { SkillItem, LearningResourceItem } from '../../server/skills/skillEngine';

interface SkillDetailViewProps {
  slug: string;
  onBack: () => void;
  onSelectCluster: (cluster: StoryCluster) => void;
}

export const SkillDetailView: React.FC<SkillDetailViewProps> = ({
  slug,
  onBack,
  onSelectCluster
}) => {
  const [data, setData] = useState<{
    skill: SkillItem;
    why_trending: any;
    related_intelligence: StoryCluster[];
    learning_resources: LearningResourceItem[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const fetchDetails = () => {
    setLoading(true);
    fetch(`/api/skills/${slug}`)
      .then(res => res.json())
      .then(resData => {
        if (resData.success && resData.data) {
          setData(resData.data);
        }
      })
      .catch(err => console.error('[SkillDetail] Error fetching:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDetails();
  }, [slug]);

  const handleToggleFollow = () => {
    if (!data) return;
    const endpoint = data.skill.followed ? '/api/user-skills/unfollow' : '/api/user-skills/follow';
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skill_id: data.skill.id })
    })
      .then(r => r.json())
      .then(res => {
        setActionMsg(res.message);
        setTimeout(() => setActionMsg(null), 3000);
        fetchDetails();
      });
  };

  const handleSaveResource = (resourceId: number) => {
    fetch('/api/my-learning/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resource_id: resourceId })
    })
      .then(r => r.json())
      .then(res => {
        setActionMsg(res.message);
        setTimeout(() => setActionMsg(null), 3000);
        fetchDetails();
      });
  };

  const getMomentumBadge = (status: string, score: number) => {
    switch (status) {
      case 'EXPLODING':
        return <span className="px-3 py-1 bg-red-100 text-red-800 border border-red-200 rounded-full font-bold text-xs">🔥 Exploding ({score}/100)</span>;
      case 'RISING':
        return <span className="px-3 py-1 bg-amber-100 text-amber-800 border border-amber-200 rounded-full font-bold text-xs">🚀 Rising ({score}/100)</span>;
      case 'GROWING':
        return <span className="px-3 py-1 bg-blue-100 text-blue-800 border border-blue-200 rounded-full font-bold text-xs">📈 Growing ({score}/100)</span>;
      default:
        return <span className="px-3 py-1 bg-slate-100 text-slate-800 border border-slate-200 rounded-full font-bold text-xs">→ Stable ({score}/100)</span>;
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-on-surface-variant text-body-sm flex flex-col items-center justify-center gap-2">
        <span className="material-symbols-outlined text-secondary text-4xl animate-spin">sync</span>
        <span>Loading skill intelligence & verified learning resources...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-12 text-center space-y-4">
        <h3 className="text-headline-sm font-bold text-primary">Skill Not Found</h3>
        <button onClick={onBack} className="px-4 py-2 bg-primary text-white font-bold rounded-lg">
          ← Back to Skill Radar
        </button>
      </div>
    );
  }

  const { skill, why_trending, related_intelligence, learning_resources } = data;

  return (
    <div className="space-y-stack-lg animate-fadeIn">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="px-3 py-1.5 bg-surface-container-low hover:bg-surface-container border border-outline-variant rounded-lg text-body-sm font-bold text-primary flex items-center gap-1.5 transition-colors"
      >
        <span className="material-symbols-outlined text-sm">arrow_back</span>
        Back to Skill Radar
      </button>

      {actionMsg && (
        <div className="px-4 py-2 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-body-sm font-bold animate-fadeIn">
          {actionMsg}
        </div>
      )}

      {/* 1. Skill Detail Header (PRD §14) */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-container-margin shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-metadata-sm font-bold uppercase tracking-wider text-secondary">{skill.category}</span>
              {getMomentumBadge(skill.trend_status, skill.momentum_score)}
            </div>
            <h1 className="text-headline-lg font-bold text-primary">{skill.name}</h1>
            <p className="text-body-md text-on-surface-variant max-w-3xl leading-relaxed">{skill.description}</p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-center">
            <button
              onClick={handleToggleFollow}
              className={`px-5 py-2.5 rounded-xl font-bold text-body-sm transition-all shadow-sm flex items-center gap-2 ${
                skill.followed
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-primary text-white hover:bg-inverse-surface'
              }`}
            >
              <span className="material-symbols-outlined text-lg">{skill.followed ? 'check' : 'bookmark_add'}</span>
              {skill.followed ? 'Following Skill' : '+ Follow Skill'}
            </button>
          </div>
        </div>
      </div>

      {/* 2. Why is this skill trending? Breakdown (PRD §15) */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-container-margin shadow-sm space-y-4">
        <h3 className="text-headline-sm font-bold text-primary border-b border-outline-variant pb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary">trending_up</span>
          Why is {skill.name} trending? (Intelligence Breakdown)
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          <div className="p-4 bg-surface-container-low border rounded-xl space-y-1">
            <div className="text-headline-sm font-bold text-primary">{why_trending.product_releases}</div>
            <div className="text-metadata-sm font-bold text-on-surface-variant uppercase">Product Releases</div>
          </div>
          <div className="p-4 bg-surface-container-low border rounded-xl space-y-1">
            <div className="text-headline-sm font-bold text-primary">{why_trending.frameworks}</div>
            <div className="text-metadata-sm font-bold text-on-surface-variant uppercase">New Frameworks</div>
          </div>
          <div className="p-4 bg-surface-container-low border rounded-xl space-y-1">
            <div className="text-headline-sm font-bold text-primary">{why_trending.research_papers}</div>
            <div className="text-metadata-sm font-bold text-on-surface-variant uppercase">Research Papers</div>
          </div>
          <div className="p-4 bg-surface-container-low border rounded-xl space-y-1">
            <div className="text-headline-sm font-bold text-primary">{why_trending.enterprise_announcements}</div>
            <div className="text-metadata-sm font-bold text-on-surface-variant uppercase">Enterprise Deals</div>
          </div>
          <div className="p-4 bg-surface-container-low border rounded-xl space-y-1">
            <div className="text-headline-sm font-bold text-primary">{why_trending.opensource_releases}</div>
            <div className="text-metadata-sm font-bold text-on-surface-variant uppercase">Open Source Drops</div>
          </div>
        </div>
      </div>

      {/* 3. Recommended Verified Learning Resources (Google Skills) (PRD §17, §18, §19, §58) */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-container-margin shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-outline-variant pb-3">
          <div>
            <h3 className="text-headline-sm font-bold text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">verified</span>
              Recommended Learning Resources (Google Skills & Official Providers)
            </h3>
            <p className="text-metadata-sm text-on-surface-variant">Verified official courses, hands-on labs, and learning paths</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {learning_resources.map(res => (
            <div key={res.id} className="p-5 bg-surface-container-low border border-outline-variant rounded-2xl space-y-3 flex flex-col justify-between hover:border-secondary transition-all group">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded font-bold text-xs flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">verified</span>
                    {res.provider} Official
                  </span>
                  <span className="text-metadata-sm font-bold text-on-surface-variant">{res.difficulty} • {res.duration}</span>
                </div>

                <h4 className="text-body-md font-bold text-primary group-hover:text-secondary transition-colors">
                  {res.title}
                </h4>

                <p className="text-body-sm text-on-surface-variant line-clamp-2 leading-relaxed">
                  {res.description}
                </p>

                {res.why_recommended && (
                  <div className="p-2.5 bg-surface-container border rounded-lg text-metadata-sm text-primary font-medium">
                    💡 <strong>Why Recommended:</strong> {res.why_recommended}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-outline-variant">
                <button
                  onClick={() => handleSaveResource(res.id)}
                  className={`px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                    res.saved ? 'bg-emerald-100 text-emerald-800' : 'bg-surface border text-primary hover:bg-outline-variant'
                  }`}
                >
                  {res.saved ? '✓ Saved to Queue' : '+ Save Resource'}
                </button>

                <a
                  href={res.official_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-primary text-white hover:bg-inverse-surface rounded-lg text-xs font-bold shadow-sm transition-colors flex items-center gap-1"
                >
                  Open Resource ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Related AI Intelligence Events (PRD §16) */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-container-margin shadow-sm space-y-4">
        <h3 className="text-headline-sm font-bold text-primary border-b border-outline-variant pb-3">
          Latest Intelligence Events for {skill.name} (PRD §16)
        </h3>

        {related_intelligence.length === 0 ? (
          <p className="text-body-sm text-on-surface-variant p-4">No recent intelligence events linked yet.</p>
        ) : (
          <div className="space-y-3">
            {related_intelligence.map(cluster => (
              <div
                key={cluster.id}
                onClick={() => onSelectCluster(cluster)}
                className="p-4 bg-surface-container-low border border-outline-variant rounded-xl cursor-pointer hover:border-secondary transition-all flex items-center justify-between gap-4 group"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold uppercase rounded">{cluster.category}</span>
                    <span className="text-metadata-sm text-on-surface-variant">{cluster.primary_source_name || 'Primary Outlet'}</span>
                  </div>
                  <h4 className="text-body-sm font-bold text-primary group-hover:text-secondary transition-colors">
                    {cluster.cluster_title}
                  </h4>
                </div>
                <span className="text-body-sm font-bold text-secondary flex items-center gap-1 shrink-0">
                  View Intelligence →
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
