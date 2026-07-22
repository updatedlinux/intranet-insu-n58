import { useState } from 'react';
import { Download, Eye } from 'lucide-react';
import type { TicketAttachment } from '../../api/tickets.types';
import { openLightboxImage } from '../../lib/lightbox-setup';
import {
  canPreviewTicketAttachment,
  getTicketAttachmentPreviewKind,
  type TicketAttachmentPreviewKind,
} from '../../utils/ticket-attachment-preview';
import {
  fetchTicketAttachmentBlob,
  ticketAttachmentUrl,
  triggerTicketAttachmentDownload,
} from '../../utils/ticket-attachments';
import { TicketDocumentPreviewModal } from './TicketDocumentPreviewModal';

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

interface TicketAttachmentListProps {
  ticketId: number;
  attachments: TicketAttachment[];
  onError?: (message: string) => void;
}

export function TicketAttachmentList({
  ticketId,
  attachments,
  onError,
}: TicketAttachmentListProps) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [docPreview, setDocPreview] = useState<DocumentPreviewState | null>(null);

  const reportError = (message: string) => {
    onError?.(message);
  };

  const handleDownload = (attachment: TicketAttachment) => {
    setBusyId(attachment.id);
    try {
      triggerTicketAttachmentDownload(ticketId, attachment.id, attachment.fileName);
    } catch {
      reportError('No se pudo descargar el adjunto');
    } finally {
      setBusyId(null);
    }
  };

  const handleView = (attachment: TicketAttachment, kind: TicketAttachmentPreviewKind) => {
    const url = ticketAttachmentUrl(ticketId, attachment.id, 'view');

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
          const kind = getTicketAttachmentPreviewKind(attachment.mimeType, attachment.fileName);
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
          fetchBlob={() => fetchTicketAttachmentBlob(ticketId, docPreview.attachmentId, 'view')}
        />
      )}
    </>
  );
}
