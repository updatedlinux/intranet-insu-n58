export const CHAT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

export const CHAT_ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
]);

export function buildChatFileKey(roomId: number, fileName: string): string {
  const safe = fileName.replace(/[^\w.\-()]/g, '_');
  return `chat/rooms/${roomId}/${Date.now()}-${safe}`;
}

export function inferChatFileCategory(mime: string): 'image' | 'pdf' | 'other' {
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  return 'other';
}
