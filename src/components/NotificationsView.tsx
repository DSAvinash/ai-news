import React, { useEffect, useState, useCallback } from 'react';
import { NotificationItem } from '../../server/notifications/notificationEngine';
import { StoryCluster } from '../types';

interface NotificationsViewProps {
  onSelectCluster: (cluster: StoryCluster) => void;
  onSelectTopic: (slug: string) => void;
}

const TABS = [
  { id: 'ALL', label: 'All' },
  { id: 'UNREAD', label: 'Unread' },
  { id: 'CRITICAL', label: 'Critical' },
  { id: 'HIGH', label: 'High Priority' },
  { id: 'SYSTEM', label: 'System' }
];

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  onSelectCluster,
  onSelectTopic
}) => {
  const [activeTab, setActiveTab] = useState('ALL');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/api/notifications?limit=50';
      if (activeTab === 'UNREAD') url += '&unreadOnly=true';
      else if (activeTab === 'CRITICAL') url += '&priority=CRITICAL';
      else if (activeTab === 'HIGH') url += '&priority=HIGH';
      else if (activeTab === 'SYSTEM') url += '&type=SYSTEM';

      const res = await fetch(url);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setNotifications(data.data);
      }
    } catch (e) {
      console.error('[Notifications] Error fetching:', e);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkRead = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
      fetchNotifications();
    } catch (e) {}
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/notifications/read-all', { method: 'POST' });
      setActionMsg('All notifications marked as read.');
      setTimeout(() => setActionMsg(null), 3000);
      fetchNotifications();
    } catch (e) {}
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
      fetchNotifications();
    } catch (e) {}
  };

  const handleSendTestNotif = async () => {
    try {
      const res = await fetch('/api/notifications/test', { method: 'POST' });
      const data = await res.json();
      setActionMsg(data.message || 'Test notification created!');
      setTimeout(() => setActionMsg(null), 3000);
      fetchNotifications();
    } catch (e) {}
  };

  const handleItemClick = (n: NotificationItem) => {
    if (!n.read) {
      fetch(`/api/notifications/${n.id}/read`, { method: 'POST' }).catch(() => {});
    }

    if (n.event_id) {
      fetch(`/api/news`)
        .then(res => res.json())
        .then(data => {
          if (data.data) {
            const found = data.data.find((c: StoryCluster) => c.id === n.event_id);
            if (found) onSelectCluster(found);
          }
        });
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return <span className="px-2.5 py-0.5 bg-red-100 text-red-800 border border-red-200 rounded font-bold text-xs uppercase">🔴 CRITICAL</span>;
      case 'HIGH':
        return <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 rounded font-bold text-xs uppercase">🟠 HIGH</span>;
      case 'MEDIUM':
        return <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 border border-blue-200 rounded font-bold text-xs uppercase">🔵 INTEL</span>;
      default:
        return <span className="px-2.5 py-0.5 bg-slate-100 text-slate-800 border border-slate-200 rounded font-bold text-xs uppercase">INFO</span>;
    }
  };

  const formatTimeAgo = (isoString: string) => {
    const diffMins = Math.max(1, Math.floor((Date.now() - new Date(isoString).getTime()) / 60000));
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  return (
    <div className="space-y-stack-lg animate-fadeIn">
      {/* Header */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-container-margin shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <span className="text-metadata-sm uppercase font-bold tracking-wider text-secondary flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-sm">notifications</span>
              INTELLIGENCE ALERT CENTER
            </span>
            <h2 className="text-headline-md font-bold text-primary">Notifications & Alerts</h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSendTestNotif}
              className="px-3 py-1.5 bg-surface-container-low hover:bg-surface-container border border-outline-variant rounded-lg text-body-sm font-semibold text-primary flex items-center gap-1.5 transition-colors"
            >
              <span className="material-symbols-outlined text-sm text-secondary">add_alert</span>
              + Test Alert
            </button>
            <button
              onClick={handleMarkAllRead}
              className="px-4 py-2 bg-primary text-white hover:bg-inverse-surface rounded-lg text-body-sm font-bold shadow-sm transition-colors"
            >
              Mark All as Read
            </button>
          </div>
        </div>

        {actionMsg && (
          <div className="mb-3 px-3 py-1.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded text-xs font-bold animate-fadeIn">
            {actionMsg}
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex overflow-x-auto gap-2 border-t border-outline-variant pt-3 no-scrollbar">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-body-sm font-bold transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-surface-container-low text-on-surface-variant hover:text-primary hover:bg-surface-container'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notifications List */}
      <section>
        {loading ? (
          <div className="py-24 text-center text-on-surface-variant text-body-sm flex flex-col items-center justify-center gap-2">
            <span className="material-symbols-outlined text-secondary text-4xl animate-spin">sync</span>
            <span>Fetching intelligence alerts...</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-16 text-center text-on-surface-variant space-y-3">
            <span className="material-symbols-outlined text-5xl text-outline mb-2">notifications_off</span>
            <h3 className="text-headline-sm font-bold text-primary">No Notifications</h3>
            <p className="text-body-sm text-on-surface-variant max-w-md mx-auto">
              You are all caught up! No intelligence alerts matched your filter.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleItemClick(n)}
                className={`cursor-pointer bg-surface-container-lowest border rounded-xl p-4 transition-all shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 group ${
                  !n.read ? 'border-secondary/60 bg-secondary/5 font-semibold' : 'border-outline-variant opacity-80 hover:opacity-100'
                }`}
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    {getPriorityBadge(n.priority)}
                    <span className="text-metadata-sm text-on-surface-variant font-medium">
                      {n.type} • {formatTimeAgo(n.created_at)}
                    </span>
                    {!n.read && (
                      <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" title="Unread"></span>
                    )}
                  </div>

                  <h4 className="text-body-md font-bold text-primary group-hover:text-secondary transition-colors">
                    {n.title}
                  </h4>

                  <p className="text-body-sm text-on-surface-variant line-clamp-2 leading-relaxed">
                    {n.message}
                  </p>
                </div>

                <div className="flex items-center gap-3 self-end md:self-center">
                  {!n.read && (
                    <button
                      onClick={(e) => handleMarkRead(n.id, e)}
                      className="px-3 py-1 bg-surface-container-low hover:bg-surface-container border border-outline-variant rounded text-xs font-bold text-primary transition-colors"
                    >
                      Mark Read
                    </button>
                  )}
                  <button
                    onClick={(e) => handleDelete(n.id, e)}
                    className="p-1.5 text-on-surface-variant hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                    title="Delete notification"
                  >
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
