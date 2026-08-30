import React, { useEffect, useState } from 'react';

export interface LiveAlert {
  id: string;
  type: 'BREAKING_NEWS' | 'NEW_CLUSTER' | 'GOOGLE_SKILL_SYNCED' | 'EARLY_SIGNAL' | 'HEARTBEAT';
  title: string;
  message?: string;
  category?: string;
  source?: string;
  url?: string;
  resourceId?: number;
  timestamp: string;
}

interface LiveAlertToastProps {
  onSelectStory?: (storyId: number) => void;
  onSelectGoogleSkill?: (resourceId: number) => void;
}

export const LiveAlertToast: React.FC<LiveAlertToastProps> = ({
  onSelectStory,
  onSelectGoogleSkill
}) => {
  const [alerts, setAlerts] = useState<LiveAlert[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connectSSE = () => {
      try {
        eventSource = new EventSource('/api/stream/events');

        eventSource.onopen = () => {
          setIsConnected(true);
        };

        eventSource.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            if (parsed.type === 'HEARTBEAT') return;

            const newAlert: LiveAlert = {
              id: parsed.id || `toast_${Date.now()}`,
              type: parsed.type,
              title: parsed.data?.title || 'New AI Intelligence Signal',
              message: parsed.data?.summary || parsed.data?.description,
              category: parsed.data?.category,
              source: parsed.data?.source || parsed.data?.provider,
              url: parsed.data?.url || parsed.data?.official_url,
              resourceId: parsed.data?.id,
              timestamp: parsed.timestamp || new Date().toISOString()
            };

            setAlerts((prev) => [newAlert, ...prev.slice(0, 3)]); // Keep max 4 visible toasts

            // Auto dismiss toast after 9 seconds
            setTimeout(() => {
              setAlerts((prev) => prev.filter((a) => a.id !== newAlert.id));
            }, 9000);
          } catch (e) {
            // Ignore non-JSON heartbeat
          }
        };

        eventSource.onerror = () => {
          setIsConnected(false);
          eventSource?.close();
          reconnectTimeout = setTimeout(connectSSE, 5000); // Reconnect after 5s
        };
      } catch (err) {
        setIsConnected(false);
      }
    };

    connectSSE();

    return () => {
      if (eventSource) eventSource.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  const handleDismiss = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const handleAction = (alert: LiveAlert) => {
    if (alert.type === 'GOOGLE_SKILL_SYNCED' && alert.resourceId && onSelectGoogleSkill) {
      onSelectGoogleSkill(alert.resourceId);
    } else if (alert.resourceId && onSelectStory) {
      onSelectStory(alert.resourceId);
    } else if (alert.url) {
      window.open(alert.url, '_blank');
    }
    handleDismiss(alert.id);
  };

  return (
    <>
      {/* Live Stream Connection Pulse Indicator */}
      <div className="fixed bottom-4 left-4 z-40 flex items-center gap-2 px-2.5 py-1 rounded-full bg-surface-container-high/90 border border-outline-variant/80 text-[11px] font-semibold text-on-surface backdrop-blur-md shadow-md select-none">
        <span
          className={`w-2 h-2 rounded-full ${
            isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
          }`}
        />
        <span>{isConnected ? 'Live Intelligence Stream' : 'Connecting to Stream...'}</span>
      </div>

      {/* Floating Alert Toasts Container */}
      <div className="fixed top-20 right-4 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {alerts.map((alert) => {
          const isBreaking = alert.type === 'BREAKING_NEWS';
          const isGoogleSkill = alert.type === 'GOOGLE_SKILL_SYNCED';

          return (
            <div
              key={alert.id}
              className={`pointer-events-auto p-4 rounded-2xl border shadow-2xl backdrop-blur-xl animate-slideInRight transition-all ${
                isBreaking
                  ? 'bg-rose-950/90 text-rose-50 border-rose-500/50 shadow-rose-500/20'
                  : isGoogleSkill
                  ? 'bg-indigo-950/90 text-indigo-50 border-indigo-500/50 shadow-indigo-500/20'
                  : 'bg-surface-container-high/95 text-on-surface border-outline-variant'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full animate-ping ${
                      isBreaking ? 'bg-rose-400' : isGoogleSkill ? 'bg-indigo-400' : 'bg-primary'
                    }`}
                  />
                  <span className="text-[10px] font-black uppercase tracking-wider">
                    {isBreaking
                      ? '🚨 BREAKING ALERT'
                      : isGoogleSkill
                      ? '⭐ GOOGLE SKILL DISCOVERED'
                      : '⚡ FRESH INTELLIGENCE'}
                  </span>
                </div>
                <button
                  onClick={() => handleDismiss(alert.id)}
                  className="text-on-surface-variant hover:text-on-surface text-xs p-1"
                  title="Dismiss"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>

              <h4 className="text-xs font-bold mt-1.5 leading-snug line-clamp-2">{alert.title}</h4>

              {alert.message && (
                <p className="text-[11px] opacity-80 mt-1 line-clamp-2 leading-relaxed">
                  {alert.message}
                </p>
              )}

              <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between">
                <span className="text-[10px] opacity-70">
                  {alert.source || alert.category || 'AI Radar'}
                </span>
                <button
                  onClick={() => handleAction(alert)}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-white/15 hover:bg-white/25 transition-colors flex items-center gap-1"
                >
                  Inspect
                  <span className="material-symbols-outlined text-xs">arrow_forward</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};
