import React, { useEffect, useState, useCallback, useRef } from 'react';
import { SideNavBar } from './components/SideNavBar';
import { TopNavBar } from './components/TopNavBar';
import { OverviewFeed } from './components/OverviewFeed';
import { StoryDetailView } from './components/StoryDetailView';
import { AdminPanel } from './components/AdminPanel';
import { TopicDetailView } from './components/TopicDetailView';
import { TopicsGrid } from './components/TopicsGrid';
import { MyTopicsView } from './components/MyTopicsView';
import { NewsPipelineAdmin } from './components/NewsPipelineAdmin';
import { BriefingHistoryView } from './components/BriefingHistoryView';
import { WatchlistFeed } from './components/WatchlistFeed';
import { SearchModal } from './components/SearchModal';
import { SearchResultsView } from './components/SearchResultsView';
import { SystemStatusPanel } from './components/SystemStatusPanel';
import { NotificationCenterModal } from './components/NotificationCenterModal';
import { NotificationsView } from './components/NotificationsView';
import { AlertSettingsView } from './components/AlertSettingsView';
import { SkillRadarView } from './components/SkillRadarView';
import { SkillDetailView } from './components/SkillDetailView';
import { GoogleSkillsView } from './components/GoogleSkillsView';
import { LiveAlertToast } from './components/LiveAlertToast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { StoryCluster, EarlySignal, DashboardStats } from './types';

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 12000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

export function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [activeView, setActiveView] = useState('signals');
  const [clusters, setClusters] = useState<StoryCluster[]>([]);
  const [earlySignals, setEarlySignals] = useState<EarlySignal[]>([]);
  const [todaySummary, setTodaySummary] = useState<{ headline: string; executive_summary: string } | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    articles_analyzed_today: 0,
    important_developments: 0,
    breaking_count: 0,
    sources_monitored: 17,
    last_updated: new Date().toISOString()
  });

  const [category, setCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [selectedCluster, setSelectedCluster] = useState<StoryCluster | null>(null);
  const [selectedTopicSlug, setSelectedTopicSlug] = useState<string | null>(null);
  const [selectedSkillSlug, setSelectedSkillSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Poll Unread Notification Count
  const fetchUnreadCount = useCallback(() => {
    fetch('/api/notifications/unread-count')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && typeof data.count === 'number') {
          setUnreadNotifCount(data.count);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 15000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Global Keyboard Shortcuts for Search Command Center (PRD §3)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchModalOpen(prev => !prev);
      } else if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setIsSearchModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsRefreshing(true);
    setError(null);

    try {
      let currentTimeRange = 'all';
      if (activeTab === 'today') currentTimeRange = 'today';

      const queryParams = new URLSearchParams({
        category,
        search: searchQuery,
        timeRange: currentTimeRange
      });

      if (activeTab === 'breaking') queryParams.append('breakingOnly', 'true');

      const [newsRes, summaryRes, statsRes, earlyRes] = await Promise.all([
        fetchWithTimeout(`/api/news?${queryParams.toString()}`).then((r) => r.json()).catch(() => ({ success: false })),
        fetchWithTimeout('/api/summary').then((r) => r.json()).catch(() => ({ success: false })),
        fetchWithTimeout('/api/stats').then((r) => r.json()).catch(() => ({ success: false })),
        fetchWithTimeout('/api/early-signals').then((r) => r.json()).catch(() => ({ success: false }))
      ]);

      if (newsRes && newsRes.success && Array.isArray(newsRes.data)) {
        setClusters(newsRes.data);
        setError(null);
      }
      if (summaryRes && summaryRes.success) setTodaySummary(summaryRes.data);
      if (statsRes && statsRes.success) setStats(statsRes.data);
      if (earlyRes && earlyRes.success && Array.isArray(earlyRes.data)) setEarlySignals(earlyRes.data);

      if (!newsRes || !newsRes.success) {
        setError('Connecting to backend server at http://localhost:3001...');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('[Dashboard] Error loading data:', err);
        setError('Connecting to backend server at http://localhost:3001...');
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [category, searchQuery, activeTab]);

  useEffect(() => {
    fetchData();

    // Controlled polling: Pause polling if browser tab is hidden
    const pollInterval = error ? 5000 : 60000;
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchData();
      }
    }, pollInterval);

    return () => {
      clearInterval(interval);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchData, error]);

  const handleSelectCluster = (cluster: StoryCluster) => {
    setSelectedCluster(cluster);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectTopic = (slug: string) => {
    setSelectedTopicSlug(slug);
    setSelectedCluster(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToFeed = () => {
    setSelectedCluster(null);
  };

  return (
    <div className="text-on-background font-body-md antialiased min-h-screen flex bg-[#F5F5F7]">
      {/* Side Navigation Bar */}
      <SideNavBar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setSelectedCluster(null);
          setSelectedTopicSlug(null);
          setSelectedSkillSlug(null);
        }}
        sourcesMonitored={stats.sources_monitored}
        onAnalyzeSignal={() => {
          if (clusters.length > 0) setSelectedCluster(clusters[0]);
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col md:ml-[240px] min-h-screen">
        {/* Top Header Navigation */}
        <TopNavBar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onRefresh={fetchData}
          isRefreshing={isRefreshing}
          activeView={activeView}
          setActiveView={(view) => {
            setActiveView(view);
            setSelectedCluster(null);
            setSelectedTopicSlug(null);
            setSelectedSkillSlug(null);
          }}
          onOpenSearchModal={() => setIsSearchModalOpen(true)}
          onExecuteSearch={(q) => {
            setSearchQuery(q);
            setActiveTab('search');
            setSelectedCluster(null);
            setSelectedTopicSlug(null);
            setSelectedSkillSlug(null);
          }}
          unreadCount={unreadNotifCount}
          onOpenNotificationCenter={() => setIsNotificationCenterOpen(true)}
        />

        {/* Scrollable Container */}
        <div className="flex-1 p-container-margin pb-24 max-w-7xl w-full mx-auto">
          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-100 border border-red-200 text-red-800 text-body-sm flex items-center justify-between">
              <span>{error}</span>
              <button
                onClick={fetchData}
                className="px-3 py-1 rounded bg-red-600 text-white text-xs font-bold"
              >
                Retry
              </button>
            </div>
          )}

          {/* Conditional View Rendering with Isolated Error Boundaries */}
          <ErrorBoundary fallbackTitle="Section Error">
            {selectedCluster ? (
              <StoryDetailView
                cluster={selectedCluster}
                onBack={handleBackToFeed}
                allClusters={clusters}
                onSelectCluster={handleSelectCluster}
              />
            ) : selectedTopicSlug ? (
              <TopicDetailView
                slug={selectedTopicSlug}
                onBack={() => setSelectedTopicSlug(null)}
                onSelectCluster={handleSelectCluster}
                onSelectTopic={handleSelectTopic}
              />
            ) : selectedSkillSlug ? (
              <SkillDetailView
                slug={selectedSkillSlug}
                onBack={() => setSelectedSkillSlug(null)}
                onSelectCluster={handleSelectCluster}
              />
            ) : activeTab === 'skill-radar' ? (
              <SkillRadarView onSelectSkill={(slug) => setSelectedSkillSlug(slug)} />
            ) : activeTab === 'google-skills' ? (
              <GoogleSkillsView />
            ) : activeTab === 'search' ? (
              <SearchResultsView
                initialQuery={searchQuery}
                onSelectCluster={handleSelectCluster}
                onSelectTopic={handleSelectTopic}
              />
            ) : activeTab === 'notifications' ? (
              <NotificationsView
                onSelectCluster={handleSelectCluster}
                onSelectTopic={handleSelectTopic}
              />
            ) : activeTab === 'alert-settings' ? (
              <AlertSettingsView />
            ) : activeTab === 'status' ? (
              <SystemStatusPanel />
            ) : activeTab === 'admin' ? (
              <AdminPanel />
            ) : activeTab === 'briefings' ? (
              <BriefingHistoryView onSelectCluster={handleSelectCluster} />
            ) : activeTab === 'pipeline' ? (
              <NewsPipelineAdmin />
            ) : activeTab === 'topics' ? (
              <TopicsGrid onSelectTopic={handleSelectTopic} />
            ) : activeTab === 'my-topics' ? (
              <MyTopicsView onSelectTopic={handleSelectTopic} />
            ) : activeTab === 'watchlist' || activeView === 'watchlist' ? (
              <WatchlistFeed onSelectCluster={handleSelectCluster} />
            ) : (
              <OverviewFeed
                clusters={clusters}
                earlySignals={earlySignals}
                todaySummary={todaySummary}
                stats={stats}
                onSelectCluster={handleSelectCluster}
                category={category}
                setCategory={setCategory}
                searchQuery={searchQuery}
                loading={loading}
              />
            )}
          </ErrorBoundary>
        </div>

        {/* Global Search Command Overlay Palette */}
        <SearchModal
          isOpen={isSearchModalOpen}
          onClose={() => setIsSearchModalOpen(false)}
          onSelectSearch={(q) => {
            setSearchQuery(q);
            setActiveTab('search');
            setSelectedCluster(null);
            setSelectedTopicSlug(null);
          }}
          onSelectResult={(item) => {
            if (item.type === 'TOPIC' && item.slug) {
              handleSelectTopic(item.slug);
            } else if (typeof item.id === 'number') {
              const found = clusters.find(c => c.id === item.id);
              if (found) setSelectedCluster(found);
              else {
                setSearchQuery(item.title);
                setActiveTab('search');
              }
            }
          }}
        />

        {/* Top Navigation Bell Dropdown Modal Overlay (PRD §5 & §6) */}
        <NotificationCenterModal
          isOpen={isNotificationCenterOpen}
          onClose={() => setIsNotificationCenterOpen(false)}
          onViewAll={() => {
            setActiveTab('notifications');
            setSelectedCluster(null);
            setSelectedTopicSlug(null);
          }}
          onSelectNotification={(n) => {
            if (n.event_id) {
              const found = clusters.find(c => c.id === n.event_id);
              if (found) setSelectedCluster(found);
              else {
                setActiveTab('notifications');
              }
            } else {
              setActiveTab('notifications');
            }
          }}
        />

        {/* Real-time Streaming Alert Toast Notifications (SSE) */}
        <LiveAlertToast
          onSelectStory={(storyId) => {
            const found = clusters.find(c => c.id === storyId);
            if (found) {
              setSelectedCluster(found);
            }
          }}
          onSelectGoogleSkill={() => {
            setActiveTab('google-skills');
          }}
        />
      </main>
    </div>
  );
}

export default App;
