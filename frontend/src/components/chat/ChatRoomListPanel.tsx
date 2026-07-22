import { useCallback, useEffect, useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import { ApiError } from '../../api/client';
import { fetchDirectory } from '../../api/directory';
import type { ChatListTab } from '../../api/chat.types';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { UserAvatar } from '../admin/UserAvatar';

interface Props {
  onSelectRoom?: () => void;
}

export function ChatRoomListPanel({ onSelectRoom }: Props) {
  const { user } = useAuth();
  const { rooms, activeRoomId, selectRoom, startDirectChat, loadingRooms } = useChat();
  const [tab, setTab] = useState<ChatListTab>('recent');
  const [contacts, setContacts] = useState<
    { id: number; fullName: string; areaName: string; avatarUrl: string | null }[]
  >([]);
  const [contactQ, setContactQ] = useState('');

  useEffect(() => {
    if (tab !== 'contacts') return;
    void fetchDirectory({ name: contactQ || undefined })
      .then((r) =>
        setContacts(
          r.items
            .filter((u) => u.id !== user?.id)
            .map((u) => ({
              id: u.id,
              fullName: u.fullName,
              areaName: u.areaName,
              avatarUrl: u.avatarUrl,
            })),
        ),
      )
      .catch(() => setContacts([]));
  }, [tab, contactQ, user?.id]);

  const filtered = useMemo(() => {
    if (tab === 'groups') return rooms.filter((r) => r.isGroup);
    return rooms;
  }, [rooms, tab]);

  const handleSelect = useCallback(
    (roomId: number) => {
      selectRoom(roomId);
      onSelectRoom?.();
    },
    [selectRoom, onSelectRoom],
  );

  return (
    <>
      <div className="chat-tabs" role="tablist">
        {(['recent', 'contacts', 'groups'] as ChatListTab[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            className={`chat-tabs__btn${tab === t ? ' is-active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'recent' ? 'Recientes' : t === 'contacts' ? 'Contactos' : 'Grupos'}
          </button>
        ))}
      </div>

      {tab === 'groups' ? (
        <p className="chat-groups-helper">
          Chats grupales de las unidades a las que tienes acceso.
          {user?.area?.name ? (
            <>
              {' '}
              Tu unidad principal es <strong>{user.area.name}</strong>.
            </>
          ) : null}
        </p>
      ) : null}

      {tab === 'contacts' ? (
        <div className="p-2">
          <input
            className="chat-contact-search"
            placeholder="Buscar en directorio…"
            value={contactQ}
            onChange={(e) => setContactQ(e.target.value)}
          />
        </div>
      ) : null}

      {tab === 'contacts' ? (
        <ul className="chat-contact-list">
          {contacts.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="chat-contact-item"
                onClick={() => {
                  if (user?.id != null && c.id === user.id) return;
                  void startDirectChat(c.id).catch((err) => {
                    if (err instanceof ApiError && err.status === 400) return;
                    console.error(err instanceof ApiError ? err.message : err);
                  });
                }}
              >
                <UserAvatar
                  userId={c.id}
                  firstName={c.fullName.split(' ')[0] ?? ''}
                  lastName={c.fullName.split(' ').slice(1).join(' ')}
                  avatarUrl={c.avatarUrl}
                  size="sm"
                />
                <div>
                  <div className="chat-contact-item__name">{c.fullName}</div>
                  <div className="chat-contact-item__area">{c.areaName}</div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="chat-room-list">
          {loadingRooms && !filtered.length ? <li className="p-3 chat-muted">Cargando…</li> : null}
          {!loadingRooms && !filtered.length ? (
            <li className="chat-empty py-4">
              <Users size={28} strokeWidth={1.5} />
              <p className="mb-0">
                {tab === 'groups' ? 'No hay grupos de área.' : 'Sin conversaciones aún.'}
              </p>
            </li>
          ) : null}
          {filtered.map((room) => (
            <li key={room.id}>
              <button
                type="button"
                className={`chat-room-item${activeRoomId === room.id ? ' is-active' : ''}`}
                onClick={() => handleSelect(room.id)}
              >
                {room.peer ? (
                  <UserAvatar
                    userId={room.peer.id}
                    firstName={room.peer.fullName.split(' ')[0] ?? ''}
                    lastName={room.peer.fullName.split(' ').slice(1).join(' ')}
                    avatarUrl={room.peer.avatarUrl}
                    size="sm"
                  />
                ) : (
                  <UserAvatar userId={0} firstName={room.name ?? 'G'} lastName="" size="sm" />
                )}
                <div className="chat-room-item__body">
                  <p className="chat-room-item__name">{room.name}</p>
                  <p className="chat-room-item__preview">{room.lastPreview || 'Sin mensajes'}</p>
                </div>
                {room.unreadCount > 0 ? (
                  <span className="chat-room-item__badge">{room.unreadCount}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
