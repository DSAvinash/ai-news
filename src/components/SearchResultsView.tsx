import React, { useEffect, useState, useCallback } from 'react';
import { SearchResultItem, SearchResponse } from '../../server/search/searchEngine';
import { StoryCluster } from '../types';

interface SearchResultsViewProps {
  initialQuery: string;
  onSelectCluster: (cluster: StoryCluster) => void;
  onSelectTopic: (slug: string) => void;
}

const TYPE_TABS = [
  { id: 'all', label: 'All' },
  { id: 'news', label: 'News' },
  { id: 'events', label: 'Events' },
  { id: 'models', label: 'Models' },
  { id: 'research', label: 'Research' },
  { id: 'topics', label: 'Topics' },
  { id: 'sources', label: 'Sources' },
  { id: 'briefings', label: 'Briefings' }
];

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
  'GENERATIVE AI',
  'PRODUCT'
];

export const SearchResultsView: React.FC<SearchResultsViewProps> = ({
  initialQuery,
  onSelectCluster,
  onSelectTopic
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [activeType, setActiveType] = useState('all');
  const [category, setCategory] = useState('All');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [dateRange, setDateRange] = useState('all');
  const [importanceFilter, setImportanceFilter] = useState('all');
  const [sortBy, setSortBy] = useState('relevance');
  const [page, setPage] = useState(1);

  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [savedSearchMsg, setSavedSearchMsg] = useState<string | null>(null);

  const executeSearch = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: query,
        type: activeType,
        category,
        source: sourceFilter,
        range: dateRange,
        importance: importanceFilter,
        sort: sortBy,
        page: page.toString(),
        limit: '20'
      });

      const res = await fetch(`/api/search?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setSearchResponse(data);
      }
    } catch (e) {
      console.error('[Search] Execution failed:', e);
    } finally {
      setLoading(false);
    }
  }, [query, activeType, category, sourceFilter, dateRange, importanceFilter, sortBy, page]);

  useEffect(() => {
    executeSearch();
  }, [executeSearch]);

  const handleSaveSearch = async () => {
    if (!query.trim()) return;
    try {
      const res = await fetch('/api/search/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          filters: { type: activeType, category, dateRange, sortBy }
        })
      });
      const data = await res.json();
      setSavedSearchMsg(data.message || 'Search saved successfully!');
      setTimeout(() => setSavedSearchMsg(null), 3000);
    } catch (e) {
      setSavedSearchMsg('Failed to save search.');
    }
  };

  const clearAllFilters = () => {
    setActiveType('all');
    setCategory('All');
    setSourceFilter('All');
    setDateRange('all');
    setImportanceFilter('all');
    setSortBy('relevance');
    setPage(1);
  };

  const getBadgeStyle = (type: string) => {
    switch (type) {
      case 'MODEL':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'RESEARCH':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'EVENT':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'COMPANY':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'TOPIC':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'SOURCE':
        return 'bg-cyan-100 text-cyan-800 border-cyan-200';
      case 'BRIEFING':
        return 'bg-violet-100 text-violet-800 border-violet-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const formatTimeAgo = (isoString?: string) => {
    if (!isoString) return 'Just now';
    const diffMins = Math.max(1, Math.floor((Date.now() - new Date(isoString).getTime()) / 60000));
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  const totalPages = searchResponse ? Math.ceil(searchResponse.total / searchResponse.pageSize) : 1;

  return (
    <div className="space-y-stack-lg animate-fadeIn">
      {/* Search Header Bar */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-container-margin shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <span className="text-metadata-sm uppercase font-bold tracking-wider text-secondary flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-sm">explore</span>
              GLOBAL INTELLIGENCE SEARCH ENGINE
            </span>
            <h2 className="text-headline-md font-bold text-primary flex items-center gap-2">
              Results for "{query || 'All AI Intelligence'}"
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveSearch}
              className="px-3 py-1.5 bg-surface-container-low hover:bg-surface-container border border-outline-variant rounded-lg text-body-sm font-semibold text-primary flex items-center gap-1.5 transition-colors"
            >
              <span className="material-symbols-outlined text-sm text-secondary">bookmark_add</span>
              + Save Search
            </button>
          </div>
        </div>

        {savedSearchMsg && (
          <div className="mb-3 px-3 py-1.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded text-xs font-bold animate-fadeIn">
            {savedSearchMsg}
          </div>
        )}

        {/* Type Navigation Tabs */}
        <div className="flex overflow-x-auto gap-2 border-t border-outline-variant pt-3 no-scrollbar">
          {TYPE_TABS.map((tab) => {
            const count = searchResponse?.facets?.types?.[tab.id] || 0;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveType(tab.id);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-body-sm font-bold flex items-center gap-1.5 transition-all whitespace-nowrap ${
                  activeType === tab.id
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-surface-container-low text-on-surface-variant hover:text-primary hover:bg-surface-container'
                }`}
              >
                {tab.label}
                <span className={`px-1.5 py-0.2 rounded text-xs ${activeType === tab.id ? 'bg-white/20 text-white' : 'bg-surface-container text-on-surface-variant'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter Toolbar & Sort Options */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Range Dropdown */}
          <div className="flex items-center gap-1 bg-surface-container-low border border-outline-variant rounded-lg px-2.5 py-1 text-metadata-sm">
            <span className="material-symbols-outlined text-sm text-on-surface-variant">calendar_today</span>
            <select
              value={dateRange}
              onChange={(e) => { setDateRange(e.target.value); setPage(1); }}
              className="bg-transparent text-primary font-semibold outline-none cursor-pointer"
            >
              <option value="all">Any time</option>
              <option value="1h">Last hour</option>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="1y">Last year</option>
            </select>
          </div>

          {/* Category Dropdown */}
          <div className="flex items-center gap-1 bg-surface-container-low border border-outline-variant rounded-lg px-2.5 py-1 text-metadata-sm">
            <span className="material-symbols-outlined text-sm text-on-surface-variant">category</span>
            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value); setPage(1); }}
              className="bg-transparent text-primary font-semibold outline-none cursor-pointer"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Importance Filter */}
          <div className="flex items-center gap-1 bg-surface-container-low border border-outline-variant rounded-lg px-2.5 py-1 text-metadata-sm">
            <span className="material-symbols-outlined text-sm text-on-surface-variant">priority_high</span>
            <select
              value={importanceFilter}
              onChange={(e) => { setImportanceFilter(e.target.value); setPage(1); }}
              className="bg-transparent text-primary font-semibold outline-none cursor-pointer"
            >
              <option value="all">All Importance</option>
              <option value="high">High Importance (70+)</option>
              <option value="critical">Critical Only (85+)</option>
            </select>
          </div>
        </div>

        {/* Sort Selector */}
        <div className="flex items-center gap-2 text-metadata-sm">
          <span className="text-on-surface-variant font-medium">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-surface-container-low border border-outline-variant text-primary font-bold px-3 py-1 rounded-lg outline-none cursor-pointer"
          >
            <option value="relevance">Relevance</option>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="importance">Most Important</option>
          </select>
        </div>
      </div>

      {/* Active Filter Chips */}
      {(category !== 'All' || dateRange !== 'all' || importanceFilter !== 'all' || activeType !== 'all') && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-metadata-sm text-on-surface-variant font-bold">Active Filters:</span>
          {activeType !== 'all' && (
            <span className="px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold flex items-center gap-1">
              Type: {activeType}
              <button onClick={() => setActiveType('all')}>×</button>
            </span>
          )}
          {category !== 'All' && (
            <span className="px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold flex items-center gap-1">
              Category: {category}
              <button onClick={() => setCategory('All')}>×</button>
            </span>
          )}
          {dateRange !== 'all' && (
            <span className="px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold flex items-center gap-1">
              Time: {dateRange}
              <button onClick={() => setDateRange('all')}>×</button>
            </span>
          )}
          <button
            onClick={clearAllFilters}
            className="text-metadata-sm text-secondary font-bold hover:underline ml-2"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Typo Resolution Banner */}
      {searchResponse?.correctedTerm && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-900 text-body-sm font-semibold flex items-center justify-between">
          <span>Showing results matched for <strong>"{searchResponse.correctedTerm}"</strong></span>
        </div>
      )}

      {/* Search Results Content */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-headline-sm font-bold text-primary">
            Found {searchResponse?.total || 0} intelligence items
          </h3>
        </div>

        {loading ? (
          <div className="py-24 text-center text-on-surface-variant text-body-sm flex flex-col items-center justify-center gap-2">
            <span className="material-symbols-outlined text-secondary text-4xl animate-spin">search</span>
            <span>Searching AI knowledge base & database indexes...</span>
          </div>
        ) : !searchResponse || searchResponse.results.length === 0 ? (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-16 text-center text-on-surface-variant space-y-3">
            <span className="material-symbols-outlined text-5xl text-outline mb-2">find_in_page</span>
            <h3 className="text-headline-sm font-bold text-primary">No Intelligence Found</h3>
            <p className="text-body-sm text-on-surface-variant max-w-md mx-auto">
              We couldn't find any articles, events, or research matching <strong>"{query}"</strong>.
            </p>
            <div className="pt-2 text-metadata-sm text-on-surface-variant space-y-1">
              <p>Suggestions:</p>
              <ul className="list-disc list-inside">
                <li>Check for typos or try broader keywords</li>
                <li>Remove active category or date filters</li>
                <li>Search for major companies (OpenAI, Gemini, Anthropic, Meta)</li>
              </ul>
            </div>
            <button
              onClick={clearAllFilters}
              className="mt-4 px-4 py-2 bg-primary text-white rounded-lg text-body-sm font-bold shadow-sm"
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-stack-lg">
            {searchResponse.results.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  if (item.type === 'TOPIC' && item.slug) {
                    onSelectTopic(item.slug);
                  } else if (typeof item.id === 'number') {
                    onSelectCluster(item as any);
                  }
                }}
                className="cursor-pointer bg-surface-container-lowest border border-outline-variant hover:border-secondary rounded-lg p-container-margin transition-all shadow-sm flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-stack-sm">
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded border uppercase tracking-wider ${getBadgeStyle(item.type)}`}>
                      {item.type}
                    </span>
                    <span className="text-metadata-sm text-on-surface-variant font-medium">
                      {item.primary_source_name || item.category}
                    </span>
                  </div>

                  <h4 className="text-headline-sm font-bold text-primary group-hover:text-secondary transition-colors mb-stack-sm leading-snug line-clamp-2">
                    {item.title}
                  </h4>

                  <p className="text-body-sm text-on-surface-variant line-clamp-3 leading-relaxed mb-stack-md">
                    {item.summary}
                  </p>
                </div>

                <div className="pt-stack-sm border-t border-outline-variant flex items-center justify-between text-metadata-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-mono-label bg-surface-container-low px-1.5 py-0.5 rounded border border-outline-variant">
                      Radar {item.radar_score}
                    </span>
                    <span className="text-metadata-sm text-on-surface-variant">
                      {formatTimeAgo(item.published_at)}
                    </span>
                  </div>

                  {item.primary_source_url ? (
                    <a
                      href={item.primary_source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-secondary font-bold hover:underline flex items-center gap-0.5"
                    >
                      Read source ↗
                    </a>
                  ) : (
                    <span className="text-secondary font-semibold group-hover:underline flex items-center gap-0.5">
                      Inspect →
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="mt-8 flex justify-center items-center gap-3">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1.5 bg-surface-container-low border border-outline-variant rounded-lg text-body-sm font-bold disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-body-sm font-semibold text-primary">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1.5 bg-surface-container-low border border-outline-variant rounded-lg text-body-sm font-bold disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  );
};
