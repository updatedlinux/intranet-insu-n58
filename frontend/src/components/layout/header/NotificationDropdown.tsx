import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  FileCheck,
  FileClock,
  FileX,
  Megaphone,
  MessageCircle,
  Settings,
  Headphones,
  UserCheck,
  X,
  Kanban,
  Calendar,
  ClipboardList,
  Package,
} from 'lucide-react';
import type { Notification, NotificationType } from '../../../api/notifications.types';
import { useNotifications } from '../../../context/NotificationContext';
import { formatRelativeTime } from '../../../utils/relative-time';

function notificationIcon(type: NotificationType) {
  const size = 18;
  switch (type) {
    case 'ANNOUNCEMENT':
      return <Megaphone size={size} aria-hidden />;
    case 'DOCUMENT_PENDING':
      return <FileClock size={size} aria-hidden />;
    case 'DOCUMENT_APPROVED':
      return <FileCheck size={size} aria-hidden />;
    case 'DOCUMENT_REJECTED':
      return <FileX size={size} aria-hidden />;
    case 'TICKET_CREATED':
    case 'TICKET_COMMENT':
      return <Headphones size={size} aria-hidden />;
    case 'TICKET_ASSIGNED':
      return <UserCheck size={size} aria-hidden />;
    case 'TICKET_RESOLVED':
      return <FileCheck size={size} aria-hidden />;
    case 'TASK_ASSIGNED':
    case 'TASK_MOVED':
    case 'TASK_COMMENT':
    case 'TASK_DUE_SOON':
      return <Kanban size={size} aria-hidden />;
    case 'MEETING_CREATED':
    case 'MEETING_RESCHEDULED':
    case 'MEETING_CANCELLED':
    case 'MEETING_REMINDER':
      return <Calendar size={size} aria-hidden />;
    case 'REQUEST_CREATED':
    case 'REQUEST_RECEIVED':
    case 'REQUEST_IN_PROGRESS':
    case 'REQUEST_RESOLVED':
    case 'REQUEST_REJECTED':
    case 'REQUEST_CLOSED':
      return <ClipboardList size={size} aria-hidden />;
    case 'INVENTORY_LOW_STOCK':
      return <Package size={size} aria-hidden />;
    case 'CHAT_MESSAGE':
      return <MessageCircle size={size} aria-hidden />;
    default:
      return <Settings size={size} aria-hidden />;
  }
}

function resourcePath(notification: Notification): string | null {
  if (!notification.resourceType || notification.resourceId == null) return null;
  if (notification.resourceType === 'announcement') {
    return `/comunicados/${notification.resourceId}`;
  }
  if (notification.resourceType === 'document') {
    return '/documentos';
  }
  if (notification.resourceType === 'ticket' && notification.resourceId != null) {
    const isItType =
      notification.type === 'TICKET_CREATED' ||
      notification.type === 'TICKET_COMMENT' ||
      notification.type === 'TICKET_ASSIGNED';
    return isItType
      ? `/service-desk/gestion/${notification.resourceId}`
      : `/service-desk/${notification.resourceId}`;
  }
  if (notification.resourceType === 'task' && notification.resourceId != null) {
    return `/actividades?task=${notification.resourceId}`;
  }
  if (notification.resourceType === 'meeting' && notification.resourceId != null) {
    return `/reuniones/${notification.resourceId}`;
  }
  if (notification.resourceType === 'inventory') {
    return '/ti/inventario';
  }
  if (notification.resourceType === 'request' && notification.resourceId != null) {
    const leaderInbox =
      notification.title === 'Nueva solicitud recibida' || notification.type === 'REQUEST_CLOSED';
    return `/solicitudes/${notification.resourceId}${leaderInbox ? '?vista=bandeja' : ''}`;
  }
  if (notification.resourceType === 'chat' && notification.resourceId != null) {
    return `/messenger?room=${notification.resourceId}`;
  }
  return null;
}

export function NotificationDropdown() {
  const navigate = useNavigate();
  const { items, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelStyle, setPanelStyle] = useState<{ top: number; right: number } | null>(null);

  const badgeLabel = unreadCount > 9 ? '9+' : unreadCount > 0 ? String(unreadCount) : null;

  const updatePanelPosition = useCallback(() => {
    const trigger = rootRef.current?.querySelector('.intranet-notifications__trigger');
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setPanelStyle({
      top: rect.bottom + 10,
      right: Math.max(12, window.innerWidth - rect.right),
    });
  }, []);

  const handleItemClick = useCallback(
    async (notification: Notification) => {
      if (!notification.isRead) {
        try {
          await markAsRead(notification.id);
        } catch (error) {
          console.error('[notifications] No se pudo marcar como leída:', error);
        }
      }

      const path = resourcePath(notification);
      setOpen(false);
      if (path) navigate(path);
    },
    [markAsRead, navigate],
  );

  const handleMarkAll = useCallback(async () => {
    if (unreadCount === 0) return;
    try {
      await markAllAsRead();
    } catch (error) {
      console.error('[notifications] No se pudieron marcar todas:', error);
    }
  }, [markAllAsRead, unreadCount]);

  useEffect(() => {
    if (!open) return;

    updatePanelPosition();

    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        rootRef.current?.contains(target) ||
        panelRef.current?.contains(target) ||
        (target as Element).closest?.('.intranet-notifications__backdrop')
      ) {
        return;
      }
      setOpen(false);
    };

    const onResize = () => updatePanelPosition();

    document.addEventListener('mousedown', onDocClick);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);

    return () => {
      document.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [open, updatePanelPosition]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const panel =
    open && panelStyle
      ? createPortal(
          <>
            <div
              className="intranet-notifications__backdrop"
              aria-hidden
              onClick={() => setOpen(false)}
            />
            <div
              ref={panelRef}
              className="intranet-notifications__panel"
              role="dialog"
              aria-label="Notificaciones"
              style={{ top: panelStyle.top, right: panelStyle.right }}
            >
              <div className="intranet-notifications__header">
                <div>
                  <h6 className="intranet-notifications__heading">Notificaciones</h6>
                  {unreadCount > 0 && (
                    <p className="intranet-notifications__subtitle">{unreadCount} sin leer</p>
                  )}
                </div>
                <div className="intranet-notifications__header-actions">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      className="intranet-notifications__mark-all"
                      onClick={() => void handleMarkAll()}
                    >
                      Marcar leídas
                    </button>
                  )}
                  <button
                    type="button"
                    className="intranet-notifications__close"
                    onClick={() => setOpen(false)}
                    aria-label="Cerrar notificaciones"
                  >
                    <X size={18} aria-hidden />
                  </button>
                </div>
              </div>

              <ul className="intranet-notifications__list">
                {loading && items.length === 0 && (
                  <li className="intranet-notifications__empty">Cargando…</li>
                )}
                {!loading && items.length === 0 && (
                  <li className="intranet-notifications__empty">
                    <Bell size={28} strokeWidth={1.5} aria-hidden />
                    <span>No tiene notificaciones</span>
                  </li>
                )}
                {items.map((notification) => (
                  <li key={notification.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      data-type={notification.type}
                      className={`intranet-notifications__item${notification.isRead ? '' : ' is-unread'}`}
                      onClick={() => void handleItemClick(notification)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          void handleItemClick(notification);
                        }
                      }}
                    >
                      {!notification.isRead && (
                        <span className="intranet-notifications__unread-dot" aria-hidden />
                      )}
                      <div className="intranet-notifications__icon" aria-hidden>
                        {notificationIcon(notification.type)}
                      </div>
                      <div className="intranet-notifications__body">
                        <div className="intranet-notifications__title">{notification.title}</div>
                        <div className="intranet-notifications__message">
                          {notification.message}
                        </div>
                        <div className="intranet-notifications__time">
                          {formatRelativeTime(notification.createdAt)}
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </>,
          document.body,
        )
      : null;

  return (
    <>
      <div
        ref={rootRef}
        className={`intranet-notifications d-none d-md-flex${open ? ' is-open' : ''}`}
      >
        <button
          className="intranet-notifications__trigger header-icon-btn"
          type="button"
          id="notification"
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={
            unreadCount > 0 ? `Notificaciones, ${unreadCount} sin leer` : 'Notificaciones'
          }
          onClick={() => setOpen((v) => !v)}
        >
          <Bell size={22} strokeWidth={1.75} aria-hidden />
          {badgeLabel != null && (
            <div className="intranet-notifications__badge" aria-hidden>
              {badgeLabel}
            </div>
          )}
        </button>
      </div>
      {panel}
    </>
  );
}
