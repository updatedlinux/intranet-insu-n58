const API_BASE = import.meta.env.VITE_API_URL ?? '/api/v1';

/** URL del documento servida por la API (MinIO no es público). */
export function documentDownloadUrl(
  documentId: number,
  action: 'view' | 'download' = 'download',
): string {
  const query = action === 'view' ? '?action=view' : '';
  return `${API_BASE}/docs/${documentId}/download${query}`;
}

export function triggerDocumentDownload(documentId: number, fileName: string): void {
  const link = document.createElement('a');
  link.href = documentDownloadUrl(documentId, 'download');
  link.download = fileName;
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  link.remove();
}
