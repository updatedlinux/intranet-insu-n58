/** Escapa HTML y convierte saltos de línea en <br> para contenido de comunicados. */
export function formatAnnouncementHtml(content: string): string {
  const escaped = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  return escaped.replace(/\n/g, '<br />');
}

export function formatPublishedDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('es-PA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
