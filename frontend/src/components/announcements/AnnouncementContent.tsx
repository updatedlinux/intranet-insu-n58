import { sanitizeAnnouncementHtml } from '../../utils/sanitize-html';

interface AnnouncementContentProps {
  content: string;
  className?: string;
}

export function AnnouncementContent({ content, className = '' }: AnnouncementContentProps) {
  const safeHtml = sanitizeAnnouncementHtml(content);

  return (
    <div
      className={`announcement-content tiptap-editor__content tiptap-editor__content--readonly ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}
