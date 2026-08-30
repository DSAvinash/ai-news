import React from 'react';

interface TopNavBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  activeView: string;
  setActiveView: (view: string) => void;
  onOpenSearchModal: () => void;
  onExecuteSearch?: (q: string) => void;
  unreadCount?: number;
  onOpenNotificationCenter?: () => void;
}

export const TopNavBar: React.FC<TopNavBarProps> = ({
  searchQuery,
  setSearchQuery,
  onRefresh,
  isRefreshing,
  activeView,
  setActiveView,
  onOpenSearchModal,
  onExecuteSearch,
  unreadCount = 0,
  onOpenNotificationCenter
}) => {
  return (
    <header className="bg-surface flex justify-between items-center h-16 px-container-margin border-b border-outline-variant top-0 sticky z-40 shrink-0">
      <div className="flex items-center gap-stack-lg">
        <h2 className="text-headline-sm font-headline-sm font-bold text-primary hidden md:block">
          Intelligence Radar
        </h2>
        <div className="hidden md:flex items-center gap-stack-md">
          <button
            onClick={() => setActiveView('signals')}
            className={`text-body-sm font-body-sm transition-colors ${
              activeView === 'signals' ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-secondary'
            }`}
          >
            Signals
          </button>
          <button
            onClick={() => setActiveView('watchlist')}
            className={`text-body-sm font-body-sm transition-colors ${
              activeView === 'watchlist' ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-secondary'
            }`}
          >
            Watchlist
          </button>
          <a
            href="/api/latest-briefing-html"
            target="_blank"
            rel="noopener noreferrer"
            className="text-on-surface-variant hover:text-secondary transition-colors text-body-sm font-body-sm"
          >
            Daily Briefing Report
          </a>
        </div>
      </div>

      <div className="flex items-center gap-stack-md">
        {/* Interactive Search Bar */}
        <div className="relative hidden sm:flex items-center bg-surface-container-low border border-outline-variant rounded-full px-3 py-1.5 w-72 hover:border-secondary transition-all">
          <span className="material-symbols-outlined text-on-surface-variant text-base mr-2">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={onOpenSearchModal}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchQuery.trim() && onExecuteSearch) {
                onExecuteSearch(searchQuery.trim());
              }
            }}
            placeholder="Search AI intelligence..."
            className="bg-transparent text-body-sm text-primary placeholder:text-on-surface-variant/70 focus:outline-none w-full pr-12"
          />
          <button
            onClick={onOpenSearchModal}
            title="Open command palette (⌘K / /)"
            className="absolute right-2 px-1.5 py-0.5 bg-surface-container border border-outline-variant text-[10px] font-mono-label font-bold text-on-surface-variant rounded hover:text-primary transition-colors"
          >
            ⌘K
          </button>
        </div>

        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Refresh feeds"
          className="text-on-surface-variant hover:text-secondary transition-colors p-2 rounded-full hover:bg-surface-container-low disabled:opacity-50"
        >
          <span className={`material-symbols-outlined ${isRefreshing ? 'animate-spin' : ''}`}>
            refresh
          </span>
        </button>

        {/* Notification Bell with Unread Badge Counter (PRD §5 & §13) */}
        <button
          onClick={onOpenNotificationCenter}
          title="Notifications & Alerts"
          className="relative text-on-surface-variant hover:text-secondary transition-colors p-2 rounded-full hover:bg-surface-container-low"
        >
          <span className="material-symbols-outlined">notifications</span>
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 px-1.5 py-0.2 bg-red-600 text-white rounded-full text-[10px] font-bold border-2 border-surface animate-pulse">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        <div className="flex items-center gap-2 pl-2">
          <div className="w-8 h-8 rounded-full bg-primary text-white font-bold text-xs flex items-center justify-center border border-outline-variant">
            AI
          </div>
        </div>
      </div>
    </header>
  );
};
