import React from 'react';
import { Search, Clock, Filter } from 'lucide-react';

interface FilterControlsProps {
  category: string;
  setCategory: (cat: string) => void;
  timeRange: string;
  setTimeRange: (range: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

const CATEGORIES = [
  'All',
  'MODEL RELEASE',
  'RESEARCH',
  'AI AGENTS',
  'AI CODING',
  'OPEN SOURCE',
  'AI HARDWARE',
  'ROBOTICS',
  'SAFETY',
  'AI REGULATION',
  'FUNDING',
  'PRODUCT'
];

const TIME_RANGES = [
  { id: '1h', label: '1 hour' },
  { id: '6h', label: '6 hours' },
  { id: '24h', label: '24 hours' },
  { id: '3d', label: '3 days' },
  { id: '7d', label: '7 days' }
];

export const FilterControls: React.FC<FilterControlsProps> = ({
  category,
  setCategory,
  timeRange,
  setTimeRange,
  searchQuery,
  setSearchQuery
}) => {
  return (
    <div className="glass-panel rounded-xl p-3 md:p-4 mb-6 border border-slate-800/80 space-y-3">
      {/* Top Search & Time Range Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search AI intelligence, models, companies..."
            className="w-full bg-slate-900/90 text-xs text-slate-100 placeholder-slate-500 rounded-lg pl-9 pr-3 py-2 border border-slate-700/80 focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>

        {/* Time Range Selector */}
        <div className="flex items-center gap-1.5 self-end sm:self-auto text-xs text-slate-400 bg-slate-900/90 p-1 rounded-lg border border-slate-800">
          <Clock className="w-3.5 h-3.5 ml-1 text-slate-400" />
          {TIME_RANGES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTimeRange(t.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                timeRange === t.id
                  ? 'bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <Filter className="w-3.5 h-3.5 text-slate-500 flex-shrink-0 mr-1" />
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-3 py-1 rounded-full whitespace-nowrap text-xs font-medium transition-all flex-shrink-0 ${
              category === cat
                ? 'bg-slate-100 text-slate-950 font-bold shadow-sm'
                : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-slate-800/80'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
    </div>
  );
};
