import { useCallback, useEffect, useState } from 'react';
import { Ban, Eye } from 'lucide-react';
import { ApiError } from '../../api/client';
import { fetchRejectedDocuments } from '../../api/documents';
import type { DocDocument } from '../../api/documents.types';
import { DOCUMENT_STATUS_LABELS } from '../../api/documents.types';
import {
  DocumentPdfPreviewModal,
  isPdfDocument,
  openDocumentFile,
} from './DocumentPdfPreviewModal';
import { DocFileTile, formatFileSize } from '../../components/documents/DocFileIcon';
import { triggerDocumentDownload } from '../../utils/document-download';

interface DocumentsRejectedPanelProps {
  open: boolean;
  onClose: () => void;
}

export function DocumentsRejectedPanel({ open, onClose }: DocumentsRejectedPanelProps) {
  const [items, setItems] = useState<DocDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pdfPreview, setPdfPreview] = useState<{
    id: number;
    fileName: string;
    title: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchRejectedDocuments();
      setItems(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los rechazados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const handleOpen = (doc: DocDocument) => {
    if (!doc.fileName) return;
    openDocumentFile(doc, (previewDoc) => {
      setPdfPreview({ id: previewDoc.id, fileName: previewDoc.fileName, title: doc.name });
    });
  };

  if (!open) return null;

  return (
    <>
      <div className="docs-modal-overlay" role="presentation" onClick={onClose}>
        <div
          className="docs-modal docs-pending-panel"
          role="dialog"
          aria-labelledby="rejected-panel-title"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id="rejected-panel-title" className="docs-modal__title">
            Documentos rechazados
          </h2>
          <p className="docs-od-subline mb-3">
            Solo usted (como solicitante o líder del área) puede ver estos documentos. No aparecen
            en el explorador principal.
          </p>
          {error && <div className="admin-alert admin-alert--error mb-20">{error}</div>}
          {loading ? (
            <p className="text-gray">Cargando…</p>
          ) : items.length === 0 ? (
            <p className="text-gray">No hay documentos rechazados.</p>
          ) : (
            <ul className="docs-pending-list">
              {items.map((doc) => (
                <li key={doc.id} className="docs-pending-list__item">
                  <DocFileTile kind={doc.fileKind} />
                  <div className="docs-pending-list__body">
                    <strong>{doc.name}</strong>
                    <p className="docs-od-subline">
                      {doc.areaName ?? '—'} · {doc.uploadedByName ?? '—'} ·{' '}
                      {formatFileSize(doc.fileSize)}
                    </p>
                    <span className="docs-status-badge docs-status-badge--rejected">
                      {DOCUMENT_STATUS_LABELS[doc.status]}
                    </span>
                    {doc.rejectionReason && (
                      <p className="docs-od-subline docs-od-subline--reject mt-1">
                        {doc.rejectionReason}
                      </p>
                    )}
                  </div>
                  <div className="docs-pending-list__actions">
                    {doc.fileName && (
                      <>
                        {isPdfDocument(doc.fileKind) ? (
                          <button
                            type="button"
                            className="docs-sp-btn docs-sp-btn--secondary"
                            onClick={() => handleOpen(doc)}
                          >
                            <Eye size={16} aria-hidden />
                            Ver PDF
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="docs-sp-btn docs-sp-btn--secondary"
                            onClick={() => triggerDocumentDownload(doc.id, doc.fileName!)}
                          >
                            Descargar
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="docs-modal__actions">
            <button type="button" className="admin-btn admin-btn--ghost" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>
      </div>

      <DocumentPdfPreviewModal
        open={pdfPreview != null}
        documentId={pdfPreview?.id ?? 0}
        fileName={pdfPreview?.fileName ?? ''}
        title={pdfPreview?.title}
        onClose={() => setPdfPreview(null)}
      />
    </>
  );
}

export function RejectedCountButton({ count, onClick }: { count: number; onClick: () => void }) {
  if (count <= 0) return null;
  return (
    <button type="button" className="docs-pending-btn docs-pending-btn--rejected" onClick={onClick}>
      <Ban size={16} aria-hidden />
      {count === 1 ? '1 rechazado' : `${count} rechazados`}
    </button>
  );
}
