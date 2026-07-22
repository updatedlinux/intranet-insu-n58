import { useCallback, useEffect, useState } from 'react';
import { Check, Clock, X } from 'lucide-react';
import { ApiError } from '../../api/client';
import { approveDocument, fetchPendingDocuments, rejectDocument } from '../../api/documents';
import type { DocDocument } from '../../api/documents.types';
import { DOCUMENT_STATUS_LABELS } from '../../api/documents.types';
import { DocFileTile, formatFileSize } from '../../components/documents/DocFileIcon';
import {
  DocumentPdfPreviewModal,
  isPdfDocument,
  openDocumentFile,
} from './DocumentPdfPreviewModal';
import { triggerDocumentDownload } from '../../utils/document-download';

interface DocumentsPendingPanelProps {
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}

export function DocumentsPendingPanel({ open, onClose, onChanged }: DocumentsPendingPanelProps) {
  const [items, setItems] = useState<DocDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState<number | null>(null);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [pdfPreview, setPdfPreview] = useState<{
    id: number;
    fileName: string;
    title: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchPendingDocuments();
      setItems(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los pendientes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  if (!open) return null;

  const handleApprove = async (doc: DocDocument) => {
    setActionId(doc.id);
    try {
      await approveDocument(doc.id);
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo aprobar');
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async () => {
    if (rejectId == null) return;
    setActionId(rejectId);
    try {
      await rejectDocument(rejectId, rejectReason.trim() || null);
      setRejectId(null);
      setRejectReason('');
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo rechazar');
    } finally {
      setActionId(null);
    }
  };

  return (
    <>
      <div className="docs-modal-overlay" role="presentation" onClick={onClose}>
        <div
          className="docs-modal docs-pending-panel"
          role="dialog"
          aria-labelledby="pending-panel-title"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id="pending-panel-title" className="docs-modal__title">
            Pendientes por aprobar
          </h2>
          {error && <div className="admin-alert admin-alert--error mb-20">{error}</div>}
          {loading ? (
            <p className="text-gray">Cargando…</p>
          ) : items.length === 0 ? (
            <p className="text-gray">No hay documentos pendientes.</p>
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
                    <span
                      className={`docs-status-badge docs-status-badge--${doc.status.toLowerCase()}`}
                    >
                      {DOCUMENT_STATUS_LABELS[doc.status]}
                    </span>
                  </div>
                  <div className="docs-pending-list__actions">
                    <button
                      type="button"
                      className="docs-sp-btn docs-sp-btn--secondary"
                      disabled={actionId != null}
                      onClick={() => {
                        if (!doc.fileName) return;
                        if (isPdfDocument(doc.fileKind)) {
                          openDocumentFile(doc, (previewDoc) => {
                            setPdfPreview({
                              id: previewDoc.id,
                              fileName: previewDoc.fileName,
                              title: doc.name,
                            });
                          });
                        } else {
                          triggerDocumentDownload(doc.id, doc.fileName);
                        }
                      }}
                    >
                      {isPdfDocument(doc.fileKind) ? 'Ver PDF' : 'Descargar'}
                    </button>
                    <button
                      type="button"
                      className="docs-sp-btn docs-sp-btn--primary"
                      disabled={actionId != null}
                      onClick={() => void handleApprove(doc)}
                    >
                      <Check size={16} aria-hidden />
                      Aprobar
                    </button>
                    <button
                      type="button"
                      className="docs-sp-btn docs-sp-btn--secondary"
                      disabled={actionId != null}
                      onClick={() => {
                        setRejectId(doc.id);
                        setRejectReason('');
                      }}
                    >
                      <X size={16} aria-hidden />
                      Rechazar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {rejectId != null && (
            <div className="docs-pending-reject mt-3">
              <label className="admin-form__label" htmlFor="rejectReason">
                Motivo del rechazo (opcional)
              </label>
              <textarea
                id="rejectReason"
                className="admin-form__input admin-form__textarea mb-3"
                rows={2}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
              <div className="docs-modal__actions">
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost"
                  onClick={() => setRejectId(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn--danger"
                  onClick={() => void handleReject()}
                >
                  Confirmar rechazo
                </button>
              </div>
            </div>
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

export function PendingCountButton({ count, onClick }: { count: number; onClick: () => void }) {
  if (count <= 0) return null;
  return (
    <button type="button" className="docs-pending-btn" onClick={onClick}>
      <Clock size={16} aria-hidden />
      {count === 1 ? '1 pendiente' : `${count} pendientes`}
    </button>
  );
}
