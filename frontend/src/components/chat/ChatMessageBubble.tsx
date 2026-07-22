import { FileText, Download } from 'lucide-react';
import type { ChatMessageItem } from '../../api/chat.types';
import { chatFileUrl } from '../../api/chat';
import { formatRelativeTime } from '../../utils/relative-time';

export function ChatMessageBubble({ message }: { message: ChatMessageItem }) {
  const isOwn = message.isOwn;

  return (
    <div className={`chat-bubble ${isOwn ? 'chat-bubble--own' : 'chat-bubble--other'}`}>
      {!isOwn && message.senderName ? (
        <div className="chat-bubble__sender">{message.senderName}</div>
      ) : null}
      {message.messageText ? <div>{message.messageText}</div> : null}
      {message.hasFile && message.fileCategory === 'image' ? (
        <div className="chat-file-preview">
          <a href={chatFileUrl(message.id)} target="_blank" rel="noreferrer">
            <img src={chatFileUrl(message.id)} alt={message.fileName ?? 'Imagen'} />
          </a>
        </div>
      ) : null}
      {message.hasFile && message.fileCategory === 'pdf' ? (
        <a
          href={chatFileUrl(message.id)}
          target="_blank"
          rel="noreferrer"
          className="chat-file-card"
        >
          <FileText size={18} aria-hidden />
          <span>{message.fileName ?? 'Documento PDF'}</span>
          <Download size={14} aria-hidden />
        </a>
      ) : null}
      <div className="chat-bubble__meta">{formatRelativeTime(message.createdAt)}</div>
    </div>
  );
}
