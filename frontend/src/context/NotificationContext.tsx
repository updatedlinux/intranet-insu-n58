import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  getNotificationsStreamUrl,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api/notifications';
import type { Notification } from '../api/notifications.types';
import { useAuth } from './AuthContext';

const MAX_ITEMS = 30;
const SSE_RETRY_MS = 5000;
const SSE_MAX_RETRIES = 5;
const POLL_MS = 60_000;

interface NotificationContextValue {
  items: Notification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

function upsertNotification(list: Notification[], incoming: Notification): Notification[] {
  const without = list.filter((n) => n.id !== incoming.id);
  return [incoming, ...without].slice(0, MAX_ITEMS);
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const eventSourceRef = useRef<EventSource | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sseRetriesRef = useRef(0);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    const [listRes, countRes] = await Promise.all([
      fetchNotifications(),
      fetchUnreadNotificationCount(),
    ]);
    if (!mountedRef.current) return;
    setItems(listRes.items);
    setUnreadCount(countRes.count);
  }, []);

  const clearPoll = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    clearPoll();
    pollTimerRef.current = setInterval(() => {
      void refresh().catch((error) => {
        console.error('[notifications] Polling error:', error);
      });
    }, POLL_MS);
  }, [clearPoll, refresh]);

  const disconnectSse = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    sseRetriesRef.current = 0;
    clearPoll();
  }, [clearPoll]);

  const connectSseRef = useRef<() => void>(() => {});

  const connectSse = useCallback(() => {
    disconnectSse();

    const source = new EventSource(getNotificationsStreamUrl(), { withCredentials: true });
    eventSourceRef.current = source;

    source.addEventListener('notification', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as Notification;
        setItems((prev) => upsertNotification(prev, payload));
        if (!payload.isRead) {
          setUnreadCount((c) => c + 1);
        }
      } catch (error) {
        console.error('[notifications] SSE parse error:', error);
      }
    });

    source.addEventListener('connected', () => {
      sseRetriesRef.current = 0;
      clearPoll();
    });

    source.onerror = () => {
      source.close();
      eventSourceRef.current = null;

      if (sseRetriesRef.current < SSE_MAX_RETRIES) {
        sseRetriesRef.current += 1;
        reconnectTimerRef.current = setTimeout(() => connectSseRef.current(), SSE_RETRY_MS);
      } else {
        startPolling();
      }
    };
  }, [clearPoll, disconnectSse, startPolling]);

  useEffect(() => {
    connectSseRef.current = connectSse;
  }, [connectSse]);

  useEffect(() => {
    mountedRef.current = true;

    if (status !== 'authenticated') {
      disconnectSse();
      setItems([]);
      setUnreadCount(0);
      setLoading(false);
      return () => {
        mountedRef.current = false;
      };
    }

    setLoading(true);
    void (async () => {
      try {
        await refresh();
        connectSse();
      } catch (error) {
        console.error('[notifications] Error al cargar:', error);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();

    return () => {
      mountedRef.current = false;
      disconnectSse();
    };
  }, [status, refresh, connectSse, disconnectSse]);

  const markAsRead = useCallback(async (id: number) => {
    let wasUnread = false;
    setItems((prev) => {
      wasUnread = prev.some((n) => n.id === id && !n.isRead);
      return prev;
    });
    const { item } = await markNotificationRead(id);
    setItems((prev) => prev.map((n) => (n.id === id ? item : n)));
    if (wasUnread) {
      setUnreadCount((c) => Math.max(0, c - 1));
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    await markAllNotificationsRead();
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }, []);

  const value = useMemo(
    () => ({
      items,
      unreadCount,
      loading,
      markAsRead,
      markAllAsRead,
      refresh,
    }),
    [items, unreadCount, loading, markAsRead, markAllAsRead, refresh],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications debe usarse dentro de NotificationProvider');
  }
  return ctx;
}
