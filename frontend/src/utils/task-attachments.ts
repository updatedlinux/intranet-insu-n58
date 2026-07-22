const API_BASE = (import.meta.env.VITE_API_URL ?? '/api/v1').replace(/\/$/, '');

/** URL del adjunto servida por la API (MinIO no es público). */
export function taskAttachmentUrl(
  taskId: number,
  attachmentId: number,
  action: 'view' | 'download' = 'download',
): string {
  const query = action === 'view' ? '?action=view' : '';
  return `${API_BASE}/tasks/${taskId}/attachments/${attachmentId}/download${query}`;
}

export async function fetchTaskAttachmentBlob(
  taskId: number,
  attachmentId: number,
  action: 'view' | 'download' = 'view',
): Promise<Blob> {
  const response = await fetch(taskAttachmentUrl(taskId, attachmentId, action), {
    credentials: 'include',
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message =
      (payload as { error?: { message?: string } }).error?.message ??
      'No se pudo obtener el adjunto';
    throw new Error(message);
  }

  return response.blob();
}

export function triggerTaskAttachmentDownload(
  taskId: number,
  attachmentId: number,
  fileName: string,
): void {
  const link = document.createElement('a');
  link.href = taskAttachmentUrl(taskId, attachmentId, 'download');
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}
