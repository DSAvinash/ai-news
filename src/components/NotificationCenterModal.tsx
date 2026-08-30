import React, { useEffect, useState } from 'react';
import { NotificationItem } from '../../server/notifications/notificationEngine';

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewAll: () => void;
  onSelectNotification: (notif: NotificationItem) => void;
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  isOpen,
  onClose,
  onViewAll,
  onSelectNotification
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchUnread = () => {
    setLoading(true);
    fetch('/api/notifications?unreadOnly=true&limit=6')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setNotifications(data.data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isOpen) {
      fetchUnread();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleMarkRead = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    fetch(`/api/notifications/${id}/read`, { method: 'POST' })
      .then(() => fetchUnread())
      .catch(() => {});
  };

  const handleMarkAllRead = () => {
    fetch('/api/notifications/read-all', { method: 'POST' })
      .then(() => fetchUnread())
      .catch(() => {});
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return <span className="px-2 py-0.5 bg-red-100 text-red-800 border border-red-200 rounded font-bold text-[10px] uppercase">🔴 BREAKING</span>;
      case 'HIGH':
        return <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 rounded font-bold text-[10px] uppercase">🟠 HIGH</span>;
      case 'MEDIUM':
        return <span className="px-2 py-0.5 bg-blue-100 text-blue-800 border border-blue-200 rounded font-bold text-[10px] uppercase">🔵 INTEL</span>;
      default:
        return <span className="px-2 py-0.5 bg-slate-100 text-slate-800 border border-slate-200 rounded font-bold text-[10px] uppercase">INFO</span>;
    }
  };

  const formatTimeAgo = (isoString: string) => {
    const diffMins = Math.max(1, Math.floor((Date.now() - new Date(isoString).getTime()) / 60000));
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end pt-16 pr-6 pointer-events-none animate-fadeIn">
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden pointer-events-auto flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="p-4 border-b border-outline-variant bg-surface-container-low flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-xl">notifications</span>
            <h3 className="text-headline-sm font-bold text-primary">Notifications</h3>
            {notifications.length > 0 && (
              <span className="px-2 py-0.5 bg-primary text-white rounded-full text-xs font-bold">
                {notifications.length} unread
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {notifications.length > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-metadata-sm text-secondary font-bold hover:underline"
              >
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="text-on-surface-variant hover:text-primary p-1 rounded-lg"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto divide-y divide-outline-variant p-2">
          {loading ? (
            <div className="p-8 text-center text-on-surface-variant text-body-sm flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-secondary animate-spin">sync</span>
              Loading alerts...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-10 text-center text-on-surface-variant space-y-2">
              <span className="material-symbols-outlined text-4xl text-outline mb-1">done_all</span>
              <h4 className="text-body-sm font-bold text-primary">All caught up!</h4>
              <p className="text-metadata-sm text-on-surface-variant">No unread intelligence alerts right now.</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => {
                  onSelectNotification(n);
                  onClose();
                }}
                className="p-3 bg-surface-container-lowest hover:bg-surface-container-low cursor-pointer transition-colors rounded-lg space-y-1.5 group"
              >
                <div className="flex items-center justify-between gap-2">
                  {getPriorityBadge(n.priority)}
                  <span className="text-metadata-sm text-on-surface-variant">
                    {formatTimeAgo(n.created_at)}
                  </span>
                </div>

                <h5 className="text-body-sm font-bold text-primary group-hover:text-secondary transition-colors line-clamp-2 leading-snug">
                  {n.title}
                </h5>

                <p className="text-metadata-sm text-on-surface-variant line-clamp-2 leading-relaxed">
                  {n.message}
                </p>

                <div className="flex justify-end pt-1">
                  <button
                    onClick={(e) => handleMarkRead(n.id, e)}
                    className="text-[10px] font-bold text-on-surface-variant hover:text-primary hover:underline"
                  >
                    Mark read
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-surface-container-low border-t border-outline-variant text-center">
          <button
            onClick={() => {
              onViewAll();
              onClose();
            }}
            className="text-body-sm font-bold text-primary hover:text-secondary transition-colors"
          >
            View all notifications →
          </button>
        </div>
      </div>
    </div>
  );
};
