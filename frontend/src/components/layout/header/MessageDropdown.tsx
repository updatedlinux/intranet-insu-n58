import { MessageCircle } from 'lucide-react';
import { useChat } from '../../../context/ChatContext';

export function MessageDropdown() {
  const { totalUnread, setWidgetOpen } = useChat();

  const badgeLabel = totalUnread > 9 ? '9+' : totalUnread > 0 ? String(totalUnread) : null;

  return (
    <div className="intranet-notifications d-none d-md-flex">
      <button
        className="intranet-notifications__trigger header-icon-btn"
        type="button"
        id="message"
        aria-label={
          totalUnread > 0
            ? `Mensajes de chat, ${totalUnread} sin leer`
            : 'Mensajes de chat sin leer'
        }
        onClick={() => setWidgetOpen(true)}
      >
        <MessageCircle size={22} strokeWidth={1.75} aria-hidden />
        {badgeLabel != null && (
          <div className="intranet-notifications__badge" aria-hidden>
            {badgeLabel}
          </div>
        )}
      </button>
    </div>
  );
}
