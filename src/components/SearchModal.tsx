import React, { useState, useEffect, useRef } from 'react';
import { SearchResultItem } from '../../server/search/searchEngine';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSearch: (query: string, type?: string) => void;
  onSelectResult: (result: SearchResultItem) => void;
}

const SUGGESTED_QUERIES = [
  { label: 'Latest open-source models', query: 'open source models' },
  { label: 'AI coding agents', query: 'AI coding agents' },
  { label: 'Google DeepMind research', query: 'Google DeepMind' },
  { label: 'Gemini 2.5 releases', query: 'Gemini' },
  { label: 'AI funding 2026', query: 'funding' },
  { label: 'Robotics breakthroughs', query: 'robotics' }
];

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  onSelectSearch,
  onSelectResult
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [autocompleteResults, setAutocompleteResults] = useState<SearchResultItem[]>([]);
  const [correctedTerm, setCorrectedTerm] = useState<string | undefined>(undefined);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('recent_ai_searches');
      if (stored) setRecentSearches(JSON.parse(stored));
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setSearchTerm('');
      setAutocompleteResults([]);
    }
  }, [isOpen]);

  // Debounced Autocomplete Fetch
  useEffect(() => {
    if (!searchTerm.trim()) {
      setAutocompleteResults([]);
      setCorrectedTerm(undefined);
      return;
    }

    setLoading(true);
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(searchTerm.trim())}&limit=5`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.results)) {
            setAutocompleteResults(data.results);
            setCorrectedTerm(data.correctedTerm);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 250);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  if (!isOpen) return null;

  const saveRecentSearch = (q: string) => {
    const clean = q.trim();
    if (!clean) return;
    const updated = [clean, ...recentSearches.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(0, 6);
    setRecentSearches(updated);
    try {
      localStorage.setItem('recent_ai_searches', JSON.stringify(updated));
    } catch (e) {}
  };

  const handleExecuteSearch = (q: string) => {
    saveRecentSearch(q);
    onSelectSearch(q);
    onClose();
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('recent_ai_searches');
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
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-16 px-4 animate-fadeIn">
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Search Input Bar */}
        <div className="p-4 border-b border-outline-variant flex items-center gap-3 bg-surface-container-low/50">
          <span className="material-symbols-outlined text-secondary text-2xl">search</span>
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchTerm.trim()) {
                handleExecuteSearch(searchTerm.trim());
              } else if (e.key === 'Escape') {
                onClose();
              }
            }}
            placeholder="Search AI intelligence, models, companies, papers, briefings..."
            className="flex-1 bg-transparent text-primary text-body-md font-medium outline-none placeholder:text-on-surface-variant/60"
          />
          {loading && <span className="material-symbols-outlined text-secondary animate-spin text-xl">sync</span>}
          <button
            onClick={onClose}
            className="px-2 py-1 bg-surface-container border border-outline-variant rounded text-xs font-mono-label text-on-surface-variant hover:text-primary transition-colors"
          >
            ESC
          </button>
        </div>

        {/* Search Command Suggestions / Autocomplete Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {correctedTerm && (
            <div className="px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-900 text-xs font-medium flex items-center justify-between">
              <span>Did you mean <strong>"{correctedTerm}"</strong>?</span>
              <button
                onClick={() => handleExecuteSearch(correctedTerm)}
                className="text-secondary font-bold hover:underline"
              >
                Search {correctedTerm} →
              </button>
            </div>
          )}

          {/* Instant Autocomplete Results */}
          {autocompleteResults.length > 0 && (
            <div>
              <h4 className="text-metadata-sm uppercase font-bold text-on-surface-variant mb-2 tracking-wider">
                Instant Results
              </h4>
              <div className="space-y-2">
                {autocompleteResults.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      saveRecentSearch(searchTerm);
                      onSelectResult(item);
                      onClose();
                    }}
                    className="p-3 bg-surface-container-low hover:bg-surface-container border border-outline-variant rounded-lg cursor-pointer transition-all flex items-center justify-between group"
                  >
                    <div className="flex-1 pr-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded border uppercase ${getBadgeStyle(item.type)}`}>
                          {item.type}
                        </span>
                        <span className="text-metadata-sm text-on-surface-variant">
                          {item.primary_source_name || item.category}
                        </span>
                      </div>
                      <h5 className="text-body-sm font-bold text-primary group-hover:text-secondary transition-colors line-clamp-1">
                        {item.title}
                      </h5>
                    </div>
                    <span className="material-symbols-outlined text-outline group-hover:text-secondary transition-colors">
                      north_east
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Searches */}
          {recentSearches.length > 0 && !searchTerm.trim() && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-metadata-sm uppercase font-bold text-on-surface-variant tracking-wider">
                  Recent Searches
                </h4>
                <button
                  onClick={clearRecentSearches}
                  className="text-metadata-sm text-on-surface-variant hover:text-red-600 transition-colors"
                >
                  Clear history
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleExecuteSearch(q)}
                    className="px-3 py-1.5 bg-surface-container-low hover:bg-surface-container border border-outline-variant rounded-lg text-body-sm font-medium text-primary flex items-center gap-1.5 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm text-on-surface-variant">history</span>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Suggested Searches */}
          {!searchTerm.trim() && (
            <div>
              <h4 className="text-metadata-sm uppercase font-bold text-on-surface-variant mb-2 tracking-wider">
                Suggested Intelligence Queries
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {SUGGESTED_QUERIES.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleExecuteSearch(s.query)}
                    className="p-3 text-left bg-surface-container-lowest border border-outline-variant hover:border-secondary hover:bg-surface-container-low rounded-lg transition-all flex items-center justify-between group"
                  >
                    <span className="text-body-sm font-semibold text-primary group-hover:text-secondary">
                      {s.label}
                    </span>
                    <span className="material-symbols-outlined text-sm text-outline group-hover:text-secondary">
                      arrow_forward
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Bar */}
        <div className="p-3 bg-surface-container-low border-t border-outline-variant text-metadata-sm text-on-surface-variant flex justify-between items-center">
          <span>Press <kbd className="px-1.5 py-0.5 bg-surface-container rounded border text-mono-label font-bold">↵ Enter</kbd> for full intelligence discovery engine</span>
          <span>Shortcut: <kbd className="px-1 py-0.5 bg-surface-container rounded border text-mono-label font-bold">⌘ K</kbd> / <kbd className="px-1 py-0.5 bg-surface-container rounded border text-mono-label font-bold">/</kbd></span>
        </div>
      </div>
    </div>
  );
};
