import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/layout';
import { ChatConversation } from '../../components/chat/ChatConversation';
import { ChatRoomListPanel } from '../../components/chat/ChatRoomListPanel';
import { useChat } from '../../context/ChatContext';

export function MessengerPage() {
  const { activeRoomId, selectRoom } = useChat();
  const [showSidebarMobile, setShowSidebarMobile] = useState(true);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const roomParam = searchParams.get('room');
    if (roomParam) {
      const roomId = Number(roomParam);
      if (Number.isInteger(roomId) && roomId > 0) {
        selectRoom(roomId);
        setShowSidebarMobile(false);
      }
    }
  }, [searchParams, selectRoom]);

  return (
    <div className="chat-messenger-page-wrap">
      <PageHeader
        title="Chat N58"
        breadcrumbParent="Messenger"
        breadcrumbCurrent="Conversaciones"
        breadcrumbParentHref="/messenger"
      />

      <div className="chat-messenger card-style mb-30">
        <aside
          className={`chat-messenger__sidebar${
            activeRoomId && !showSidebarMobile ? ' is-hidden-mobile' : ''
          }`}
        >
          <ChatRoomListPanel onSelectRoom={() => setShowSidebarMobile(false)} />
        </aside>
        <section
          className={`chat-messenger__main${
            !activeRoomId ? ' is-hidden-mobile is-empty-mobile' : ''
          }`}
        >
          <ChatConversation onBack={() => setShowSidebarMobile(true)} />
        </section>
      </div>
    </div>
  );
}
