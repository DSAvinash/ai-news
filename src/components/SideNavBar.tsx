import React from 'react';

interface SideNavBarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  sourcesMonitored: number;
  onAnalyzeSignal?: () => void;
}

export const SideNavBar: React.FC<SideNavBarProps> = ({
  activeTab,
  setActiveTab,
  sourcesMonitored,
  onAnalyzeSignal
}) => {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: 'radar' },
    { id: 'search', label: 'Search Intelligence', icon: 'search' },
    { id: 'skill-radar', label: 'Skill Radar', icon: 'school' },
    { id: 'google-skills', label: 'Google Skills', icon: 'verified' },
    { id: 'notifications', label: 'Notifications', icon: 'notifications' },
    { id: 'status', label: 'System Status', icon: 'health_and_safety' },
    { id: 'alert-settings', label: 'Alert Rules & Settings', icon: 'settings_suggest' },
    { id: 'today', label: 'Today', icon: 'today' },
    { id: 'breaking', label: 'Breaking', icon: 'bolt' },
    { id: 'briefings', label: 'Briefing History', icon: 'history_edu' },
    { id: 'my-topics', label: 'My Topics', icon: 'stars' },
    { id: 'topics', label: 'Topics Directory', icon: 'grid_view' },
    { id: 'watchlist', label: 'Watchlist', icon: 'bookmark' },
    { id: 'pipeline', label: 'News Pipeline', icon: 'insights' },
    { id: 'admin', label: 'Sources & Admin', icon: 'handyman' },
  ];

  return (
    <nav className="bg-surface w-[240px] h-screen fixed left-0 top-0 flex flex-col border-r border-outline-variant hidden md:flex z-50">
      <div className="flex flex-col h-full py-panel-padding">
        {/* Header */}
        <div className="px-container-margin mb-stack-lg flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary text-on-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-lg">radar</span>
          </div>
          <div>
            <h1 className="text-headline-md font-headline-md font-bold tracking-tighter text-primary">
              AI Intelligence
            </h1>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-1 overflow-y-auto px-unit">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-panel-padding py-stack-sm mb-unit rounded-lg transition-colors duration-150 text-left ${
                  isActive
                    ? 'text-secondary font-semibold border-r-2 border-secondary bg-surface-container-low'
                    : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-low'
                }`}
              >
                <span className={`material-symbols-outlined ${isActive ? 'filled-icon' : ''}`}>
                  {item.icon}
                </span>
                <span className="text-body-sm font-body-sm">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* CTA */}
        <div className="px-container-margin py-stack-md mt-auto">
          <button
            onClick={onAnalyzeSignal}
            className="w-full bg-primary text-on-primary py-2 rounded-lg text-body-sm font-semibold flex items-center justify-center gap-2 hover:bg-inverse-surface transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-sm">analytics</span>
            Analyze Signal
          </button>
        </div>

        {/* Footer Tabs */}
        <div className="px-unit border-t border-outline-variant pt-stack-sm">
          <button
            onClick={() => setActiveTab('admin')}
            className={`w-full flex items-center gap-3 px-panel-padding py-stack-sm mb-unit rounded-lg transition-colors duration-150 text-left ${
              activeTab === 'admin'
                ? 'text-secondary font-semibold bg-surface-container-low'
                : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-low'
            }`}
          >
            <span className="material-symbols-outlined">settings</span>
            <span className="text-body-sm font-body-sm">Settings</span>
          </button>
        </div>
      </div>
    </nav>
  );
};
