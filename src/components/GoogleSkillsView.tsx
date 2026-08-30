import React, { useEffect, useState, useCallback } from 'react';
import { GoogleSkillDetailModal } from './GoogleSkillDetailModal';
import { UserProfileModal } from './UserProfileModal';
import { GoogleAdminSyncModal } from './GoogleAdminSyncModal';
import { SkillGapRadarModal } from './SkillGapRadarModal';

interface GoogleSkillItem {
  id: number;
  skill_id: string;
  title: string;
  description: string | null;
  provider: string;
  official_url: string;
  canonical_url: string;
  resource_type: string;
  difficulty: string;
  duration: string;
  thumbnail_url: string | null;
  published_at: string | null;
  first_seen_at: string;
  last_updated_at: string;
  status: string;
  industry_relevance_score: number;
  recommendation_score?: number;
  viewed: boolean;
  saved: boolean;
  is_new: boolean;
  is_updated: boolean;
  is_trending: boolean;
  why_learn_this?: string;
  mapped_skills?: { id: number; name: string; slug: string; momentum: number }[];
}

interface GoogleSkillStats {
  total_skills: number;
  verified_skills: number;
  new_skills: number;
  updated_skills: number;
  viewed_skills: number;
  saved_skills: number;
  unexplored_skills: number;
}

export const GoogleSkillsView: React.FC = () => {
  const [skills, setSkills] = useState<GoogleSkillItem[]>([]);
  const [recommendedSkills, setRecommendedSkills] = useState<GoogleSkillItem[]>([]);
  const [skillGaps, setSkillGaps] = useState<any[]>([]);
  const [stats, setStats] = useState<GoogleSkillStats | null>(null);

  const [activeTab, setActiveTab] = useState<
    'all' | 'recommended' | 'new' | 'updated' | 'trending' | 'gaps' | 'saved' | 'unexplored'
  >('recommended');

  const [search, setSearch] = useState('');
  const [difficulty, setDifficulty] = useState('All');
  const [resourceType, setResourceType] = useState('All');
  const [loading, setLoading] = useState(true);

  // Modals state
  const [selectedResourceId, setSelectedResourceId] = useState<number | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isGapRadarOpen, setIsGapRadarOpen] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/google-skills/stats?user_id=default_user');
      const data = await res.json();
      if (data.success) setStats(data.data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  const fetchRecommendations = useCallback(async () => {
    try {
      const res = await fetch('/api/google-skills/recommended?user_id=default_user');
      const data = await res.json();
      if (data.success) {
        setRecommendedSkills(data.data.recommended || []);
        setSkillGaps(data.data.skill_gaps || []);
      }
    } catch (err) {
      console.error('Failed to fetch recommendations:', err);
    }
  }, []);

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        filter: activeTab === 'recommended' || activeTab === 'gaps' ? 'all' : activeTab,
        search,
        difficulty: difficulty !== 'All' ? difficulty : '',
        resource_type: resourceType !== 'All' ? resourceType : '',
        limit: '40',
        offset: '0',
        user_id: 'default_user'
      });
      const res = await fetch(`/api/google-skills?${queryParams.toString()}`);
      const data = await res.json();
      if (data.success && data.data) {
        setSkills(data.data.skills);
      }
    } catch (err) {
      console.error('Failed to load Google skills:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, search, difficulty, resourceType]);

  useEffect(() => {
    fetchStats();
    fetchRecommendations();
  }, [fetchStats, fetchRecommendations]);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  const handleOpenGoogle = async (skill: GoogleSkillItem) => {
    try {
      const res = await fetch(`/api/google-skills/${skill.id}/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: 'default_user' })
      });
      const json = await res.json();
      if (json.success && json.verified_url) {
        window.open(json.verified_url, '_blank', 'noopener,noreferrer');
      }
    } catch (e) {
      console.error(e);
    }

    setSkills((prev) => prev.map((s) => (s.id === skill.id ? { ...s, viewed: true } : s)));
    setRecommendedSkills((prev) => prev.map((s) => (s.id === skill.id ? { ...s, viewed: true } : s)));
    fetchStats();
  };

  const handleToggleBookmark = async (skill: GoogleSkillItem) => {
    try {
      const res = await fetch(`/api/google-skills/${skill.id}/bookmark`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: 'default_user' })
      });
      const json = await res.json();
      if (json.success) {
        setSkills((prev) => prev.map((s) => (s.id === skill.id ? { ...s, saved: json.saved } : s)));
        setRecommendedSkills((prev) =>
          prev.map((s) => (s.id === skill.id ? { ...s, saved: json.saved } : s))
        );
        fetchStats();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Determine current display list
  const displaySkills = activeTab === 'recommended' ? recommendedSkills : skills;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-28">verified</span>
              <h1 className="text-2xl font-bold tracking-tight text-on-surface">
                Google Skills Intelligence & Learning Engine
              </h1>
            </div>
            <p className="text-sm text-on-surface-variant max-w-3xl leading-relaxed">
              Continuously discovers, validates, and synchronizes official Google learning resources (Google DeepMind, Vertex AI, Gemini). Maps real-time AI industry momentum to personal skill gaps and guided learning paths.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsGapRadarOpen(true)}
              className="px-3.5 py-2 bg-primary text-white hover:bg-primary/90 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-sm">radar</span>
              Skill Gap Radar
            </button>
            <button
              onClick={() => setIsProfileModalOpen(true)}
              className="px-3.5 py-2 bg-surface-container-high hover:bg-surface-container text-on-surface rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border border-outline-variant/60"
            >
              <span className="material-symbols-outlined text-sm text-primary">psychology</span>
              My Skill Profile
            </button>
            <button
              onClick={() => setIsAdminModalOpen(true)}
              className="px-3.5 py-2 bg-surface-container-high hover:bg-surface-container text-on-surface rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border border-outline-variant/60"
            >
              <span className="material-symbols-outlined text-sm text-primary">settings_suggest</span>
              Sync & Audit
            </button>
          </div>
        </div>

        {/* Live Metrics Chips (PRD §74) */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-outline-variant">
            <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/60">
              <div className="text-[11px] text-on-surface-variant font-medium">Verified Catalog</div>
              <div className="text-xl font-bold text-on-surface mt-0.5">{stats.verified_skills}</div>
            </div>
            <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/60">
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">fiber_new</span>
                New Releases
              </div>
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {stats.new_skills}
              </div>
            </div>
            <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/60">
              <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">history</span>
                Updated
              </div>
              <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                {stats.updated_skills}
              </div>
            </div>
            <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/60">
              <div className="text-[11px] text-primary font-medium">Opened / Viewed</div>
              <div className="text-xl font-bold text-primary mt-0.5">{stats.viewed_skills}</div>
            </div>
            <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/60">
              <div className="text-[11px] text-on-surface-variant font-medium">Saved Bookmarks</div>
              <div className="text-xl font-bold text-on-surface mt-0.5">{stats.saved_skills}</div>
            </div>
            <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/60">
              <div className="text-[11px] text-on-surface-variant font-medium">Unexplored</div>
              <div className="text-xl font-bold text-on-surface-variant mt-0.5">
                {stats.unexplored_skills}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Skill Gaps Banner (if in Gaps tab or Recommendations) */}
      {skillGaps.length > 0 && (activeTab === 'gaps' || activeTab === 'recommended') && (
        <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-base">target</span>
              <span className="text-xs font-bold text-primary uppercase tracking-wider">
                Detected AI Skill Gaps (High Industry Momentum)
              </span>
            </div>
            <button
              onClick={() => setIsProfileModalOpen(true)}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Update Skill Levels →
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {skillGaps.map((gap) => (
              <div
                key={gap.id}
                className="px-3 py-1.5 bg-surface-container-lowest border border-outline-variant rounded-xl flex items-center gap-2 text-xs"
              >
                <span className="font-semibold text-on-surface">{gap.name}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-primary/10 text-primary rounded">
                  Momentum: {gap.momentum_score}
                </span>
                <span className="text-[10px] text-on-surface-variant font-medium">
                  ({gap.current_level.toLowerCase()})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View Tabs (PRD §41) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-outline-variant">
        {[
          { id: 'recommended', label: '✨ Recommended For You', icon: 'auto_awesome' },
          { id: 'all', label: 'All Catalog', icon: 'apps' },
          { id: 'new', label: '🆕 New Releases', icon: 'fiber_new' },
          { id: 'updated', label: '🆙 Recently Updated', icon: 'history' },
          { id: 'trending', label: '🔥 Trending on Google', icon: 'local_fire_department' },
          { id: 'gaps', label: '🎯 Target Skill Gaps', icon: 'target' },
          { id: 'saved', label: '🔖 My Saved', icon: 'bookmark' },
          { id: 'unexplored', label: 'Unexplored', icon: 'explore' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-primary text-on-primary shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
            }`}
          >
            <span className="material-symbols-outlined text-sm">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Filter & Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
        {/* Search Input */}
        <div className="sm:col-span-6 relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-base">
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Google Skills, topics, Gemini, Vertex AI..."
            className="w-full pl-9 pr-4 py-2 bg-surface-container-low border border-outline-variant rounded-xl text-xs text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Difficulty Filter */}
        <div className="sm:col-span-3">
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-xl text-xs text-on-surface focus:outline-none"
          >
            <option value="All">All Difficulties</option>
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </select>
        </div>

        {/* Resource Type Filter */}
        <div className="sm:col-span-3">
          <select
            value={resourceType}
            onChange={(e) => setResourceType(e.target.value)}
            className="w-full px-3 py-2 bg-surface-container-low border border-outline-variant rounded-xl text-xs text-on-surface focus:outline-none"
          >
            <option value="All">All Types</option>
            <option value="COURSE">Course</option>
            <option value="LEARNING_PATH">Learning Path</option>
            <option value="HANDS_ON_LAB">Hands-On Lab</option>
            <option value="SKILL_BADGE">Skill Badge</option>
            <option value="CERTIFICATION">Certification</option>
            <option value="TUTORIAL">Tutorial</option>
          </select>
        </div>
      </div>

      {/* Grid of Resource Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="h-64 bg-surface-container-low border border-outline-variant/60 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      ) : displaySkills.length === 0 ? (
        <div className="text-center py-16 bg-surface-container-lowest border border-outline-variant rounded-2xl p-8 space-y-2">
          <span className="material-symbols-outlined text-48 text-on-surface-variant/40">
            search_off
          </span>
          <h3 className="text-sm font-semibold text-on-surface">No matching resources found</h3>
          <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
            Try adjusting your search criteria or switch to another filter tab.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {displaySkills.map((skill) => (
            <div
              key={skill.id}
              className="group bg-surface-container-lowest border border-outline-variant hover:border-primary/40 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between"
            >
              <div className="space-y-3">
                {/* Header: Provider & Badges */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-sm">verified</span>
                    <span className="text-[11px] font-bold text-primary uppercase tracking-wider">
                      {skill.provider}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {skill.is_new && (
                      <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold rounded-full border border-emerald-500/20">
                        NEW
                      </span>
                    )}
                    {skill.is_updated && (
                      <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold rounded-full border border-amber-500/20">
                        UPDATED
                      </span>
                    )}
                    {skill.viewed && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface-container-high text-on-surface-variant text-[10px] font-medium rounded-full">
                        <span className="material-symbols-outlined text-[12px] text-emerald-600">
                          check_circle
                        </span>
                        Opened
                      </span>
                    )}
                  </div>
                </div>

                {/* Title */}
                <h3 className="text-base font-bold text-on-surface group-hover:text-primary transition-colors leading-snug">
                  {skill.title}
                </h3>

                {/* Subtitle / Metadata Row */}
                <div className="flex items-center gap-2 text-[11px] text-on-surface-variant">
                  <span className="font-medium text-on-surface">{skill.resource_type}</span>
                  <span>•</span>
                  <span>{skill.difficulty}</span>
                  <span>•</span>
                  <span>⏱ {skill.duration}</span>
                </div>

                {/* Description */}
                <p className="text-xs text-on-surface-variant line-clamp-2 leading-relaxed">
                  {skill.description}
                </p>

                {/* Mapped Skills Pills */}
                {skill.mapped_skills && skill.mapped_skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {skill.mapped_skills.map((ms) => (
                      <span
                        key={ms.id}
                        className="px-2 py-0.5 bg-surface-container-high text-on-surface text-[10px] font-medium rounded-md"
                      >
                        {ms.name} ({ms.momentum})
                      </span>
                    ))}
                  </div>
                )}

                {/* "Why learn this?" Insight preview */}
                {skill.why_learn_this && (
                  <div className="p-2.5 bg-primary/5 border border-primary/15 rounded-xl text-[11px] text-on-surface-variant flex items-start gap-1.5">
                    <span className="material-symbols-outlined text-xs text-primary mt-0.5">
                      lightbulb
                    </span>
                    <span className="line-clamp-2">{skill.why_learn_this}</span>
                  </div>
                )}
              </div>

              {/* Action Footer */}
              <div className="pt-4 mt-4 border-t border-outline-variant/60 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggleBookmark(skill)}
                    title={skill.saved ? 'Remove Bookmark' : 'Save Resource'}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                      skill.saved
                        ? 'text-primary bg-primary/10'
                        : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">
                      {skill.saved ? 'bookmark_added' : 'bookmark_add'}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedResourceId(skill.id);
                      setIsDetailModalOpen(true);
                    }}
                    className="px-2.5 py-1.5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container text-xs font-semibold rounded-lg transition-colors"
                  >
                    Details
                  </button>
                </div>

                <button
                  onClick={() => handleOpenGoogle(skill)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-on-primary hover:bg-inverse-surface text-xs font-semibold rounded-lg transition-all shadow-xs"
                >
                  <span>Open Google</span>
                  <span className="material-symbols-outlined text-xs">open_in_new</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Resource Detail Deep-Dive Modal */}
      <GoogleSkillDetailModal
        resourceId={selectedResourceId}
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedResourceId(null);
        }}
        onBookmarkToggled={(id, saved) => {
          setSkills((prev) => prev.map((s) => (s.id === id ? { ...s, saved } : s)));
          setRecommendedSkills((prev) => prev.map((s) => (s.id === id ? { ...s, saved } : s)));
          fetchStats();
        }}
      />

      {/* User Skill Profile Modal */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onProfileUpdated={() => {
          fetchRecommendations();
          fetchCatalog();
        }}
      />

      {/* Admin Catalog Sync & Health Modal */}
      <GoogleAdminSyncModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        onSyncCompleted={() => {
          fetchStats();
          fetchRecommendations();
          fetchCatalog();
        }}
      />

      {/* Skill Gap Radar Modal */}
      <SkillGapRadarModal
        isOpen={isGapRadarOpen}
        onClose={() => {
          setIsGapRadarOpen(false);
          fetchRecommendations();
          fetchCatalog();
        }}
      />
    </div>
  );
};
