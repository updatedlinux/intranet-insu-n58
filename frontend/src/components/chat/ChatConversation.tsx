import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Paperclip, Send } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { ChatMessageBubble } from './ChatMessageBubble';
import { UserAvatar } from '../admin/UserAvatar';

interface Props {
  compact?: boolean;
  onBack?: () => void;
}

export function ChatConversation({ compact: _compact, onBack }: Props) {
  const {
    rooms,
    activeRoomId,
    messages,
    loadingMessages,
    typing,
    sendMessage,
    sendFile,
    setTyping,
    loadMoreMessages,
    hasMoreMessages,
  } = useChat();

  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const room = rooms.find((r) => r.id === activeRoomId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  if (!activeRoomId || !room) {
    return (
      <div className="chat-empty">
        <p>Seleccione una conversación para comenzar</p>
      </div>
    );
  }

  const handleSend = () => {
    if (!text.trim()) return;
    sendMessage(text);
    setText('');
    setTyping(false);
  };

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      await sendFile(file);
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="chat-conv-header">
        {onBack ? (
          <button type="button" className="btn btn-link p-0 d-md-none" onClick={onBack}>
            <ArrowLeft size={20} />
          </button>
        ) : null}
        {room.peer ? (
          <UserAvatar
            userId={room.peer.id}
            firstName={room.peer.fullName.split(' ')[0] ?? ''}
            lastName={room.peer.fullName.split(' ').slice(1).join(' ')}
            avatarUrl={room.peer.avatarUrl}
            size="sm"
          />
        ) : null}
        <div>
          <h2>{room.name}</h2>
          {room.isGroup && room.areaName ? (
            <span className="chat-conv-header__subtitle">{room.areaName}</span>
          ) : room.peer?.areaName ? (
            <span className="chat-conv-header__subtitle">{room.peer.areaName}</span>
          ) : null}
        </div>
      </div>

      <div className="chat-messages">
        {hasMoreMessages ? (
          <button
            type="button"
            className="btn btn-link chat-load-more align-self-center"
            disabled={loadingMessages}
            onClick={() => void loadMoreMessages()}
          >
            Cargar anteriores
          </button>
        ) : null}
        {loadingMessages && !messages.length ? <p className="chat-muted">Cargando…</p> : null}
        {messages.map((m) => (
          <ChatMessageBubble key={m.id} message={m} />
        ))}
        <div ref={bottomRef} />
      </div>

      {typing ? <div className="chat-typing">{typing.userName} está escribiendo…</div> : null}

      <div className="chat-input-bar">
        <input
          ref={fileRef}
          type="file"
          className="d-none"
          accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          className="chat-input-bar__attach"
          aria-label="Adjuntar"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          <Paperclip size={18} />
        </button>
        <textarea
          rows={1}
          placeholder="Escriba un mensaje…"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setTyping(e.target.value.length > 0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <button
          type="button"
          className="chat-input-bar__send"
          aria-label="Enviar"
          disabled={!text.trim() || uploading}
          onClick={handleSend}
        >
          <Send size={18} />
        </button>
      </div>
    </>
  );
}
