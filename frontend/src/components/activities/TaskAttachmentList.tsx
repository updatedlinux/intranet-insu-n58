import { useState } from 'react';
import { Download, Eye, Trash2 } from 'lucide-react';
import type { TaskAttachment } from '../../api/tasks.types';
import { openLightboxImage } from '../../lib/lightbox-setup';
import {
  canPreviewTicketAttachment,
  getTicketAttachmentPreviewKind,
  type TicketAttachmentPreviewKind,
} from '../../utils/ticket-attachment-preview';
import {
  fetchTaskAttachmentBlob,
  taskAttachmentUrl,
  triggerTaskAttachmentDownload,
} from '../../utils/task-attachments';
import { TicketDocumentPreviewModal } from '../service-desk/TicketDocumentPreviewModal';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface DocumentPreviewState {
  attachmentId: number;
  fileName: string;
  url: string;
  kind: 'pdf' | 'word';
}

interface TaskAttachmentListProps {
  taskId: number;
  attachments: TaskAttachment[];
  canDelete?: boolean;
  onDelete?: (attachmentId: number) => void;
  onError?: (message: string) => void;
}

export function TaskAttachmentList({
  taskId,
  attachments,
  canDelete = false,
  onDelete,
  onError,
}: TaskAttachmentListProps) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [docPreview, setDocPreview] = useState<DocumentPreviewState | null>(null);

  const reportError = (message: string) => {
    onError?.(message);
  };

  const handleDownload = (attachment: TaskAttachment) => {
    setBusyId(attachment.id);
    try {
      triggerTaskAttachmentDownload(taskId, attachment.id, attachment.fileName);
    } catch {
      reportError('No se pudo descargar el adjunto');
    } finally {
      setBusyId(null);
    }
  };

  const handleView = (attachment: TaskAttachment, kind: TicketAttachmentPreviewKind) => {
    const url = taskAttachmentUrl(taskId, attachment.id, 'view');

    if (kind === 'image') {
      setBusyId(attachment.id);
      void openLightboxImage(url, attachment.fileName)
        .catch(() => reportError('No se pudo abrir la vista previa'))
        .finally(() => setBusyId(null));
      return;
    }

    if (kind === 'pdf' || kind === 'word') {
      setDocPreview({
        attachmentId: attachment.id,
        fileName: attachment.fileName,
        url,
        kind,
      });
    }
  };

  if (attachments.length === 0) return null;

  return (
    <>
      <ul className="sd-attachments-list sd-attachments-list--detail">
        {attachments.map((attachment) => {
          const kind = getTicketAttachmentPreviewKind(attachment.fileType, attachment.fileName);
          const previewable = canPreviewTicketAttachment(kind);
          const isBusy = busyId === attachment.id;

          return (
            <li key={attachment.id} className="sd-attachments-list__item">
              <span className="sd-attachments-list__name">{attachment.fileName}</span>
              <span className="sd-attachments-list__size">
                {formatFileSize(attachment.fileSize)}
              </span>
              <div className="sd-attachments-list__actions">
                {previewable && (
                  <button
                    type="button"
                    className="admin-btn admin-btn--ghost sd-attachments-list__action"
                    onClick={() => handleView(attachment, kind)}
                    disabled={isBusy}
                  >
                    <Eye size={14} aria-hidden />
                    {isBusy && !docPreview ? 'Abriendo…' : 'Ver'}
                  </button>
                )}
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost sd-attachments-list__action"
                  onClick={() => handleDownload(attachment)}
                  disabled={isBusy}
                >
                  <Download size={14} aria-hidden />
                  {isBusy && !docPreview ? '…' : 'Descargar'}
                </button>
                {canDelete && onDelete && (
                  <button
                    type="button"
                    className="admin-btn admin-btn--ghost sd-attachments-list__action"
                    onClick={() => onDelete(attachment.id)}
                    disabled={isBusy}
                    aria-label="Eliminar adjunto"
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {docPreview && (
        <TicketDocumentPreviewModal
          open
          fileName={docPreview.fileName}
          url={docPreview.url}
          kind={docPreview.kind}
          onClose={() => setDocPreview(null)}
          onDownload={() => {
            const attachment = attachments.find((a) => a.id === docPreview.attachmentId);
            if (attachment) handleDownload(attachment);
          }}
          fetchBlob={() => fetchTaskAttachmentBlob(taskId, docPreview.attachmentId, 'view')}
        />
      )}
    </>
  );
}
