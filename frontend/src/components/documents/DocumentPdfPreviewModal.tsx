import { Download } from 'lucide-react';
import { documentDownloadUrl, triggerDocumentDownload } from '../../utils/document-download';

interface DocumentPdfPreviewModalProps {
  open: boolean;
  documentId: number;
  fileName: string;
  title?: string;
  onClose: () => void;
}

export function DocumentPdfPreviewModal({
  open,
  documentId,
  fileName,
  title,
  onClose,
}: DocumentPdfPreviewModalProps) {
  if (!open) return null;

  const displayTitle = title ?? fileName;

  return (
    <div className="docs-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="docs-modal docs-preview-modal"
        role="dialog"
        aria-labelledby="doc-pdf-preview-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="doc-pdf-preview-title" className="docs-modal__title">
          {displayTitle}
        </h2>
        <div className="docs-preview-modal__body">
          <iframe
            src={documentDownloadUrl(documentId, 'view')}
            title={displayTitle}
            className="docs-preview-modal__iframe"
          />
        </div>
        <div className="docs-modal__actions">
          <button type="button" className="admin-btn admin-btn--ghost" onClick={onClose}>
            Cerrar
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--primary docs-modal__download-btn"
            onClick={() => triggerDocumentDownload(documentId, fileName)}
          >
            <Download size={16} aria-hidden />
            Descargar
          </button>
        </div>
      </div>
    </div>
  );
}

export function isPdfDocument(kind: string): boolean {
  return kind === 'pdf';
}

export function openDocumentFile(
  doc: { id: number; fileName: string | null; fileKind: string },
  onPdfPreview: (doc: { id: number; fileName: string; fileKind: string }) => void,
): void {
  if (!doc.fileName) return;
  if (isPdfDocument(doc.fileKind)) {
    onPdfPreview({ id: doc.id, fileName: doc.fileName, fileKind: doc.fileKind });
    return;
  }
  triggerDocumentDownload(doc.id, doc.fileName);
}
