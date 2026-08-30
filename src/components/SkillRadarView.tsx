import React, { useEffect, useState, useCallback } from 'react';
import { SkillItem, LearningResourceItem } from '../../server/skills/skillEngine';
import { SkillGapRadarModal } from './SkillGapRadarModal';

interface SkillRadarViewProps {
  onSelectSkill: (slug: string) => void;
}

export const SkillRadarView: React.FC<SkillRadarViewProps> = ({ onSelectSkill }) => {
  const [heroSkill, setHeroSkill] = useState<SkillItem | null>(null);
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [resources, setResources] = useState<LearningResourceItem[]>([]);
  const [mySaved, setMySaved] = useState<any[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [isGapModalOpen, setIsGapModalOpen] = useState(false);

  const fetchSkillData = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/skills/recommendations').then(r => r.json()),
      fetch('/api/skills').then(r => r.json()),
      fetch('/api/my-learning').then(r => r.json())
    ])
      .then(([recRes, skillsRes, myRes]) => {
        if (recRes.success && recRes.data) {
          setHeroSkill(recRes.data.hero_skill);
          setResources(recRes.data.recommended_resources || []);
        }
        if (skillsRes.success && Array.isArray(skillsRes.data)) {
          setSkills(skillsRes.data);
        }
        if (myRes.success && Array.isArray(myRes.data)) {
          setMySaved(myRes.data);
        }
      })
      .catch(err => console.error('[SkillRadar] Error fetching:', err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchSkillData();
  }, [fetchSkillData]);

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
        fetchSkillData();
      });
  };

  const getMomentumBadge = (status: string, score: number) => {
    switch (status) {
      case 'EXPLODING':
        return <span className="px-2.5 py-0.5 bg-red-100 text-red-800 border border-red-200 rounded-full font-bold text-xs">🔥 Exploding ({score}/100)</span>;
      case 'RISING':
        return <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 rounded-full font-bold text-xs">🚀 Rising ({score}/100)</span>;
      case 'GROWING':
        return <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 border border-blue-200 rounded-full font-bold text-xs">📈 Growing ({score}/100)</span>;
      default:
        return <span className="px-2.5 py-0.5 bg-slate-100 text-slate-800 border border-slate-200 rounded-full font-bold text-xs">→ Stable ({score}/100)</span>;
    }
  };

  const filteredSkills = categoryFilter === 'All' ? skills : skills.filter(s => s.category === categoryFilter);

  return (
    <div className="space-y-stack-lg animate-fadeIn">
      {/* Header (PRD §6) */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-container-margin shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-metadata-sm font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5 mb-1">
            <span className="material-symbols-outlined text-sm">school</span>
            INTELLIGENCE-DRIVEN SKILL & LEARNING RADAR
          </span>
          <h1 className="text-headline-md font-bold text-primary">AI Skill Radar</h1>
          <p className="text-body-sm text-on-surface-variant">
            Discover which AI skills are rising, why they're important, and what to learn next.
          </p>
        </div>
        <button
          onClick={() => setIsGapModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-primary text-white hover:bg-primary/90 font-bold text-xs flex items-center gap-2 shadow-sm transition-all hover:shadow"
        >
          <span className="material-symbols-outlined text-base">radar</span>
          Assess My Skill Gaps (Radar)
        </button>
      </div>

      {actionMsg && (
        <div className="px-4 py-2 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-body-sm font-bold animate-fadeIn">
          {actionMsg}
        </div>
      )}

      {/* 1. TOP SECTION — LEARN NEXT HERO CARD (PRD §7) */}
      {heroSkill && (
        <div className="bg-gradient-to-br from-primary to-inverse-surface text-white rounded-2xl p-6 shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 z-10 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider text-white">
                🎯 WHAT SHOULD YOU LEARN NEXT?
              </span>
              <span className="px-2.5 py-0.5 bg-red-500/80 text-white rounded-full text-xs font-bold">
                🔥 Momentum {heroSkill.momentum_score}/100
              </span>
            </div>

            <h2 className="text-headline-lg font-bold">{heroSkill.name}</h2>
            <p className="text-body-md text-white/80 leading-relaxed">
              {heroSkill.description}
            </p>

            <div className="flex items-center gap-4 text-xs font-semibold text-white/90">
              <span>⚡ {heroSkill.intelligence_count} major developments</span>
              <span>•</span>
              <span>🚀 {heroSkill.release_count} significant releases</span>
            </div>
          </div>

          <div className="z-10 shrink-0">
            <button
              onClick={() => onSelectSkill(heroSkill.slug)}
              className="px-6 py-3 bg-white text-primary hover:bg-white/90 rounded-xl font-bold text-body-sm shadow-lg transition-all flex items-center gap-2"
            >
              Explore Skill & Verified Resources →
            </button>
          </div>
        </div>
      )}

      {/* 2. DYNAMIC SKILL MOMENTUM LIST (PRD §8 & §10) */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-container-margin shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-outline-variant pb-3">
          <div>
            <h3 className="text-headline-sm font-bold text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">analytics</span>
              Skill Momentum Index (PRD §8)
            </h3>
            <p className="text-metadata-sm text-on-surface-variant">
              Calculated dynamically from news volume, research papers, and model releases
            </p>
          </div>

          {/* Category Filter */}
          <div className="flex overflow-x-auto gap-1.5 no-scrollbar">
            {['All', 'AI Agents', 'Generative AI', 'Large Language Models', 'AI Coding', 'Multimodal AI', 'RAG'].map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  categoryFilter === cat ? 'bg-primary text-white' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Skill Cards Grid (PRD §12) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSkills.map(skill => (
            <div
              key={skill.id}
              onClick={() => onSelectSkill(skill.slug)}
              className="p-5 bg-surface-container-low border border-outline-variant rounded-2xl cursor-pointer hover:border-secondary transition-all space-y-3 flex flex-col justify-between group shadow-sm"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-metadata-sm font-bold text-on-surface-variant uppercase">{skill.category}</span>
                  {getMomentumBadge(skill.trend_status, skill.momentum_score)}
                </div>

                <h4 className="text-body-md font-bold text-primary group-hover:text-secondary transition-colors">
                  {skill.name}
                </h4>

                <p className="text-body-sm text-on-surface-variant line-clamp-2 leading-relaxed">
                  {skill.description}
                </p>

                <div className="text-metadata-sm text-on-surface-variant font-medium">
                  {skill.intelligence_count} intelligence events detected
                </div>
              </div>

              <div className="pt-2 border-t border-outline-variant flex items-center justify-between text-body-sm font-bold text-secondary">
                <span>Explore Skill</span>
                <span>→</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. RECOMMENDED LEARNING RESOURCES (Google Skills) (PRD §17 & §18) */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-container-margin shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-outline-variant pb-3">
          <div>
            <h3 className="text-headline-sm font-bold text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600">verified</span>
              Top Verified Learning Resources (Google Skills)
            </h3>
            <p className="text-metadata-sm text-on-surface-variant">Verified official courses, labs, and skill badges</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {resources.map(res => (
            <div key={res.id} className="p-4 bg-surface-container-low border border-outline-variant rounded-xl space-y-2.5 flex flex-col justify-between hover:border-secondary transition-all group">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-[10px]">
                    ✓ {res.provider} Official
                  </span>
                  <span className="text-metadata-sm font-bold text-on-surface-variant">{res.difficulty}</span>
                </div>

                <h4 className="text-body-sm font-bold text-primary group-hover:text-secondary transition-colors line-clamp-2">
                  {res.title}
                </h4>

                <p className="text-metadata-sm text-on-surface-variant line-clamp-2">
                  {res.description}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-outline-variant">
                <button
                  onClick={() => handleSaveResource(res.id)}
                  className="px-2.5 py-1 bg-surface border border-outline-variant rounded text-[11px] font-bold text-primary hover:bg-outline-variant transition-colors"
                >
                  + Save Resource
                </button>
                <a
                  href={res.official_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 bg-primary text-white hover:bg-inverse-surface rounded text-xs font-bold transition-colors flex items-center gap-1"
                >
                  Open Resource ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. MY SAVED LEARNING QUEUE (PRD §29 & §30) */}
      {mySaved.length > 0 && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-container-margin shadow-sm space-y-4">
          <h3 className="text-headline-sm font-bold text-primary border-b border-outline-variant pb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">bookmark</span>
            My Saved Learning Queue ({mySaved.length})
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {mySaved.map(item => (
              <div key={item.resource_id} className="p-3 bg-surface-container-low border rounded-xl flex items-center justify-between gap-3">
                <div>
                  <h5 className="text-body-sm font-bold text-primary line-clamp-1">{item.title}</h5>
                  <span className="text-metadata-sm text-on-surface-variant">{item.provider} • {item.difficulty}</span>
                </div>
                <a
                  href={item.official_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 bg-primary text-white rounded text-xs font-bold"
                >
                  Open ↗
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Skill Gap Interactive Radar Modal */}
      <SkillGapRadarModal
        isOpen={isGapModalOpen}
        onClose={() => {
          setIsGapModalOpen(false);
          fetchSkillData();
        }}
      />
    </div>
  );
};
