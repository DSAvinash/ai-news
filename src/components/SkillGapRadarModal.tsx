import React, { useEffect, useState, useCallback } from 'react';

interface RadarAxis {
  id: number;
  name: string;
  slug: string;
  category: string;
  user_proficiency: string;
  user_score: number;
  industry_momentum: number;
  gap_delta: number;
  trend_status: string;
  is_priority_gap: boolean;
}

interface GapAnalysisData {
  radar_axes: RadarAxis[];
  priority_gaps: RadarAxis[];
  total_gaps_count: number;
  average_user_readiness: number;
  average_industry_momentum: number;
  targeted_courses: any[];
}

interface SkillGapRadarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectResource?: (resourceId: number) => void;
}

export const SkillGapRadarModal: React.FC<SkillGapRadarModalProps> = ({
  isOpen,
  onClose,
  onSelectResource
}) => {
  const [data, setData] = useState<GapAnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeAxis, setActiveAxis] = useState<RadarAxis | null>(null);
  const [updatingSkillId, setUpdatingSkillId] = useState<number | null>(null);

  const fetchGapAnalysis = useCallback(() => {
    setLoading(true);
    fetch('/api/google-skills/users/me/gap-analysis')
      .then((res) => res.json())
      .then((resData) => {
        if (resData.success && resData.data) {
          setData(resData.data);
          if (resData.data.radar_axes?.length > 0) {
            setActiveAxis(resData.data.radar_axes[0]);
          }
        }
      })
      .catch((err) => console.error('[GapAnalysis] Error fetching:', err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchGapAnalysis();
    }
  }, [isOpen, fetchGapAnalysis]);

  const handleUpdateProficiency = async (skillId: number, newLevel: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED') => {
    setUpdatingSkillId(skillId);
    try {
      await fetch('/api/google-skills/users/me/skill-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skill_id: skillId, proficiency_level: newLevel })
      });
      fetchGapAnalysis();
    } catch (err) {
      console.error('[GapAnalysis] Update failed:', err);
    } finally {
      setUpdatingSkillId(null);
    }
  };

  if (!isOpen) return null;

  // SVG Radar Polygon Math
  const size = 380;
  const center = size / 2;
  const radius = center - 45;
  const axes = data?.radar_axes || [];
  const numAxes = axes.length || 8;

  const getCoordinates = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / numAxes - Math.PI / 2;
    const r = (value / 100) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle)
    };
  };

  const userPolygonPoints = axes
    .map((axis, i) => {
      const pt = getCoordinates(i, axis.user_score);
      return `${pt.x},${pt.y}`;
    })
    .join(' ');

  const industryPolygonPoints = axes
    .map((axis, i) => {
      const pt = getCoordinates(i, axis.industry_momentum);
      return `${pt.x},${pt.y}`;
    })
    .join(' ');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div
        className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-surface border border-outline-variant rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant bg-surface-variant/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <span className="material-symbols-outlined text-2xl">radar</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-on-surface flex items-center gap-2">
                Personalized Skill Gap Assessment & Radar
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-secondary/15 text-secondary border border-secondary/30">
                  Live Intelligence
                </span>
              </h2>
              <p className="text-xs text-on-surface-variant">
                Compare your technical competencies directly against real-time AI Industry Radar momentum.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant rounded-lg transition-colors"
            title="Close"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && !data ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm text-on-surface-variant">Calculating multi-axial competency radar...</p>
            </div>
          ) : data ? (
            <>
              {/* Top Metrics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-surface-variant/50 border border-outline-variant flex flex-col">
                  <span className="text-xs text-on-surface-variant font-medium">Your Readiness Score</span>
                  <span className="text-2xl font-black text-emerald-500 mt-1">
                    {data.average_user_readiness}%
                  </span>
                  <span className="text-[11px] text-on-surface-variant mt-auto">Aggregated competency scale</span>
                </div>

                <div className="p-4 rounded-xl bg-surface-variant/50 border border-outline-variant flex flex-col">
                  <span className="text-xs text-on-surface-variant font-medium">Industry Benchmark</span>
                  <span className="text-2xl font-black text-primary mt-1">
                    {data.average_industry_momentum}%
                  </span>
                  <span className="text-[11px] text-on-surface-variant mt-auto">Current market momentum</span>
                </div>

                <div className="p-4 rounded-xl bg-surface-variant/50 border border-outline-variant flex flex-col">
                  <span className="text-xs text-on-surface-variant font-medium">Identified Priority Gaps</span>
                  <span className="text-2xl font-black text-rose-500 mt-1">
                    {data.total_gaps_count} Skills
                  </span>
                  <span className="text-[11px] text-on-surface-variant mt-auto">Competency delta ≥ 20 pts</span>
                </div>

                <div className="p-4 rounded-xl bg-surface-variant/50 border border-outline-variant flex flex-col">
                  <span className="text-xs text-on-surface-variant font-medium">Targeted Google Courses</span>
                  <span className="text-2xl font-black text-secondary mt-1">
                    {data.targeted_courses?.length || 0} Paths
                  </span>
                  <span className="text-[11px] text-on-surface-variant mt-auto">Verified learning tracks</span>
                </div>
              </div>

              {/* Main Interactive Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* SVG Radar Chart Visualizer */}
                <div className="lg:col-span-7 bg-surface-variant/30 border border-outline-variant rounded-2xl p-5 flex flex-col items-center justify-center relative">
                  <div className="w-full flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                      Multi-Axial Competency Radar
                    </span>
                    <div className="flex items-center gap-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-emerald-500/80 border border-emerald-400"></span>
                        <span className="text-on-surface-variant">Your Level</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-primary/40 border border-primary border-dashed"></span>
                        <span className="text-on-surface-variant">Industry Target</span>
                      </div>
                    </div>
                  </div>

                  <svg
                    viewBox={`0 0 ${size} ${size}`}
                    className="w-full max-w-[360px] h-auto overflow-visible select-none my-2"
                  >
                    {/* Concentric Grid Rings */}
                    {[25, 50, 75, 100].map((ring) => (
                      <circle
                        key={ring}
                        cx={center}
                        cy={center}
                        r={(ring / 100) * radius}
                        fill="none"
                        stroke="currentColor"
                        strokeDasharray={ring === 100 ? 'none' : '3,3'}
                        className="text-outline-variant/40"
                      />
                    ))}

                    {/* Radial Axis Lines */}
                    {axes.map((_, i) => {
                      const pt = getCoordinates(i, 100);
                      return (
                        <line
                          key={i}
                          x1={center}
                          y1={center}
                          x2={pt.x}
                          y2={pt.y}
                          stroke="currentColor"
                          className="text-outline-variant/50"
                        />
                      );
                    })}

                    {/* Industry Momentum Polygon (Outer Target) */}
                    <polygon
                      points={industryPolygonPoints}
                      fill="rgba(75, 65, 225, 0.12)"
                      stroke="#4b41e1"
                      strokeWidth="2"
                      strokeDasharray="4,4"
                    />

                    {/* User Competency Polygon (Inner Profile) */}
                    <polygon
                      points={userPolygonPoints}
                      fill="rgba(16, 185, 129, 0.28)"
                      stroke="#10b981"
                      strokeWidth="2.5"
                      className="transition-all duration-500 ease-out"
                    />

                    {/* Axis Nodes & Interactive Dots */}
                    {axes.map((axis, i) => {
                      const userPt = getCoordinates(i, axis.user_score);
                      const isSelected = activeAxis?.id === axis.id;

                      return (
                        <g
                          key={axis.id}
                          className="cursor-pointer"
                          onClick={() => setActiveAxis(axis)}
                        >
                          <circle
                            cx={userPt.x}
                            cy={userPt.y}
                            r={isSelected ? 6 : 4}
                            fill="#10b981"
                            stroke="#ffffff"
                            strokeWidth={isSelected ? 2.5 : 1.5}
                            className="transition-all hover:scale-125"
                          />
                        </g>
                      );
                    })}

                    {/* Axis Labels */}
                    {axes.map((axis, i) => {
                      const labelPt = getCoordinates(i, 118);
                      const isSelected = activeAxis?.id === axis.id;

                      return (
                        <text
                          key={axis.id}
                          x={labelPt.x}
                          y={labelPt.y}
                          textAnchor="middle"
                          dominantBaseline="central"
                          className={`text-[10px] font-bold cursor-pointer transition-colors ${
                            isSelected
                              ? 'fill-primary font-black scale-105'
                              : 'fill-on-surface-variant hover:fill-on-surface'
                          }`}
                          onClick={() => setActiveAxis(axis)}
                        >
                          {axis.name.length > 14 ? `${axis.name.slice(0, 12)}…` : axis.name}
                        </text>
                      );
                    })}
                  </svg>

                  <p className="text-[11px] text-on-surface-variant text-center mt-2">
                    Click any axis point or label to adjust your competency level.
                  </p>
                </div>

                {/* Right Panel: Interactive Competency Adjuster */}
                <div className="lg:col-span-5 space-y-4">
                  {activeAxis ? (
                    <div className="p-5 rounded-2xl bg-surface border border-outline-variant shadow-sm space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-secondary">
                            Selected Skill
                          </span>
                          <h3 className="text-base font-bold text-on-surface">{activeAxis.name}</h3>
                        </div>
                        <span
                          className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${
                            activeAxis.gap_delta >= 20
                              ? 'bg-rose-500/10 text-rose-500 border-rose-500/30'
                              : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                          }`}
                        >
                          {activeAxis.gap_delta >= 20 ? `-${activeAxis.gap_delta} pt Gap` : 'On Track'}
                        </span>
                      </div>

                      {/* Level Comparison */}
                      <div className="grid grid-cols-2 gap-2 text-xs bg-surface-variant/40 p-3 rounded-xl">
                        <div>
                          <span className="text-on-surface-variant block text-[11px]">Your Level</span>
                          <span className="font-bold text-emerald-500 capitalize">
                            {activeAxis.user_proficiency.toLowerCase()} ({activeAxis.user_score}%)
                          </span>
                        </div>
                        <div>
                          <span className="text-on-surface-variant block text-[11px]">Industry Demand</span>
                          <span className="font-bold text-primary">
                            {activeAxis.industry_momentum}% Momentum
                          </span>
                        </div>
                      </div>

                      {/* 1-Click Proficiency Selector */}
                      <div>
                        <label className="text-xs font-semibold text-on-surface block mb-2">
                          Update Your Competency:
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {(['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const).map((level) => {
                            const isCurrent = activeAxis.user_proficiency === level;
                            return (
                              <button
                                key={level}
                                disabled={updatingSkillId === activeAxis.id}
                                onClick={() => handleUpdateProficiency(activeAxis.id, level)}
                                className={`py-2 px-3 text-xs font-bold rounded-lg border transition-all ${
                                  isCurrent
                                    ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm shadow-emerald-500/20'
                                    : 'bg-surface hover:bg-surface-variant text-on-surface border-outline-variant'
                                }`}
                              >
                                {level === 'BEGINNER' ? '🌱 Beginner' : level === 'INTERMEDIATE' ? '⚡ Mid' : '🏆 Pro'}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-outline-variant">
                        <span className="text-xs font-bold text-on-surface flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm text-secondary">school</span>
                          Recommended Next Step
                        </span>
                        <p className="text-xs text-on-surface-variant mt-1">
                          Complete verified Google Cloud & DeepMind skill badges below to bridge your {activeAxis.name} gap.
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {/* Priority Gaps Summary List */}
                  <div className="p-4 rounded-2xl bg-surface-variant/30 border border-outline-variant space-y-2">
                    <span className="text-xs font-bold text-on-surface uppercase tracking-wider block mb-1">
                      Highest Priority Gaps to Target
                    </span>
                    <div className="space-y-1.5 max-h-44 overflow-y-auto">
                      {data.priority_gaps.map((gap) => (
                        <div
                          key={gap.id}
                          onClick={() => setActiveAxis(gap)}
                          className="flex items-center justify-between p-2 rounded-lg bg-surface hover:bg-surface-variant/70 cursor-pointer border border-outline-variant/60 transition-colors text-xs"
                        >
                          <span className="font-semibold text-on-surface">{gap.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-rose-500 font-bold">-{gap.gap_delta} pts</span>
                            <span className="material-symbols-outlined text-xs text-on-surface-variant">chevron_right</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom: Targeted Google Skill Courses Carousel */}
              <div className="pt-4 border-t border-outline-variant space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-on-surface flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-primary text-base">verified</span>
                      Tailored Google Learning Tracks to Close Gaps
                    </h3>
                    <p className="text-xs text-on-surface-variant">
                      Authoritative Google Cloud, Vertex AI, and DeepMind pathways mapped to your identified deficit areas.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {data.targeted_courses.slice(0, 3).map((course: any) => (
                    <div
                      key={course.id}
                      className="p-4 rounded-xl bg-surface border border-outline-variant hover:border-primary/50 transition-all flex flex-col justify-between group shadow-sm hover:shadow-md"
                    >
                      <div>
                        <div className="flex items-center justify-between text-xs mb-2">
                          <span className="px-2 py-0.5 font-bold rounded-md bg-primary/10 text-primary border border-primary/20 text-[10px]">
                            {course.difficulty} • {course.duration}
                          </span>
                          <span className="text-[11px] font-bold text-emerald-500">
                            {course.recommendation_score}% Match
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-on-surface group-hover:text-primary transition-colors line-clamp-2">
                          {course.title}
                        </h4>
                        <p className="text-[11px] text-on-surface-variant mt-1.5 line-clamp-2">
                          {course.description}
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-outline-variant/60 flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-secondary flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">military_tech</span>
                          Skill Badge
                        </span>
                        <a
                          href={course.official_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 text-xs font-bold rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors flex items-center gap-1"
                        >
                          Start Track
                          <span className="material-symbols-outlined text-xs">open_in_new</span>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
