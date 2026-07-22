import { Link, useLocation } from 'react-router-dom';
import { MessageCircle, X } from 'lucide-react';
import { BRAND_ISOTYPE_SRC, BRAND_NAME } from '../../config/brand';
import { useChat } from '../../context/ChatContext';
import { ChatConversation } from './ChatConversation';
import { ChatRoomListPanel } from './ChatRoomListPanel';

export function ChatWidget() {
  const location = useLocation();
  const { widgetOpen, setWidgetOpen, totalUnread, activeRoomId, selectRoom } = useChat();
  const isMessengerPage = location.pathname.startsWith('/messenger');

  if (isMessengerPage) {
    return null;
  }

  return (
    <>
      {widgetOpen ? (
        <div className="chat-widget-panel" role="dialog" aria-label={`Chat ${BRAND_NAME}`}>
          <div className="chat-widget-header">
            <div className="d-flex justify-content-between align-items-start gap-3">
              <div className="d-flex align-items-center gap-3">
                <img
                  src={BRAND_ISOTYPE_SRC}
                  alt={BRAND_NAME}
                  className="chat-widget-header__logo"
                />
                <div>
                  <h3>Chat {BRAND_NAME}</h3>
                  <p>Conectado · Mensajes en tiempo real</p>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-link text-white p-0"
                aria-label="Cerrar chat"
                onClick={() => {
                  setWidgetOpen(false);
                  selectRoom(null);
                }}
              >
                <X size={22} />
              </button>
            </div>
          </div>
          <div className="chat-widget-body">
            {!activeRoomId ? (
              <>
                <ChatRoomListPanel onSelectRoom={() => undefined} />
                <div className="p-3 border-top bg-white text-center">
                  <Link
                    to="/messenger"
                    className="admin-link chat-widget-footer-link"
                    onClick={() => setWidgetOpen(false)}
                  >
                    Abrir messenger completo
                  </Link>
                </div>
              </>
            ) : (
              <div className="chat-messenger__main" style={{ minHeight: 0, flex: 1 }}>
                <ChatConversation compact onBack={() => selectRoom(null)} />
              </div>
            )}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className="chat-widget-fab"
        aria-label={widgetOpen ? 'Cerrar chat' : 'Abrir chat'}
        onClick={() => setWidgetOpen(!widgetOpen)}
      >
        {widgetOpen ? <X size={26} /> : <MessageCircle size={26} />}
        {!widgetOpen && totalUnread > 0 ? (
          <span className="chat-widget-fab__badge">{totalUnread > 99 ? '99+' : totalUnread}</span>
        ) : null}
      </button>
    </>
  );
}
