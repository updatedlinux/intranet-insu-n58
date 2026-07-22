import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { renderAsync } from 'docx-preview';
import { isLegacyWordDocument } from '../../utils/ticket-attachment-preview';

interface TicketDocumentPreviewModalProps {
  open: boolean;
  fileName: string;
  url: string;
  kind: 'pdf' | 'word';
  onClose: () => void;
  onDownload: () => void;
  fetchBlob: () => Promise<Blob>;
}

export function TicketDocumentPreviewModal({
  open,
  fileName,
  url,
  kind,
  onClose,
  onDownload,
  fetchBlob,
}: TicketDocumentPreviewModalProps) {
  const docxRef = useRef<HTMLDivElement>(null);
  const [docxLoading, setDocxLoading] = useState(false);
  const [docxError, setDocxError] = useState('');

  const legacyDoc = kind === 'word' && isLegacyWordDocument(fileName);

  useEffect(() => {
    if (!open || kind !== 'word' || legacyDoc) return;

    const container = docxRef.current;
    if (!container) return;

    container.innerHTML = '';
    setDocxError('');
    setDocxLoading(true);

    void (async () => {
      try {
        const blob = await fetchBlob();
        await renderAsync(blob, container, undefined, {
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
        });
      } catch {
        setDocxError('No se pudo previsualizar el documento Word.');
      } finally {
        setDocxLoading(false);
      }
    })();
  }, [open, kind, legacyDoc, fetchBlob]);

  if (!open) return null;

  return (
    <div className="docs-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="docs-modal docs-preview-modal sd-doc-preview-modal"
        role="dialog"
        aria-labelledby="sd-doc-preview-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="sd-doc-preview-title" className="docs-modal__title">
          {fileName}
        </h2>

        <div className="docs-preview-modal__body sd-doc-preview-modal__body">
          {docxLoading ? (
            <p className="sd-doc-preview-modal__status">Cargando vista previa…</p>
          ) : legacyDoc ? (
            <div className="sd-doc-preview-modal__fallback">
              <p>
                Los archivos <strong>.doc</strong> no admiten vista previa en el navegador.
                Descárguelo para abrirlo con Word.
              </p>
            </div>
          ) : docxError ? (
            <div className="sd-doc-preview-modal__fallback">
              <p>{docxError}</p>
            </div>
          ) : kind === 'pdf' ? (
            <iframe src={url} title={fileName} className="docs-preview-modal__iframe" />
          ) : (
            <div ref={docxRef} className="sd-doc-preview-modal__docx" />
          )}
        </div>

        <div className="docs-modal__actions">
          <button type="button" className="admin-btn admin-btn--ghost" onClick={onClose}>
            Cerrar
          </button>
          <button type="button" className="admin-btn admin-btn--primary" onClick={onDownload}>
            <Download size={16} aria-hidden />
            Descargar
          </button>
        </div>
      </div>
    </div>
  );
}
