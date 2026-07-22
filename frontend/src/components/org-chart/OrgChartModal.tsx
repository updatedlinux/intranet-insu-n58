import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import type { OrgChartNode } from '../../api/org-chart.types';
import { downloadOrgChartPdf } from '../../utils/org-chart-pdf';
import { OrgChartFit } from './OrgChartFit';
import { OrgChartTree } from './OrgChartTree';

interface Props {
  open: boolean;
  tree: OrgChartNode[];
  totalAreas: number;
  highlightAreaId?: number | null;
  onClose: () => void;
}

export function OrgChartModal({ open, tree, totalAreas, highlightAreaId, onClose }: Props) {
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportError, setExportError] = useState('');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setExportError('');
      setExportingPdf(false);
    }
  }, [open]);

  if (!open) return null;

  const handleDownloadPdf = async () => {
    setExportingPdf(true);
    setExportError('');
    try {
      await downloadOrgChartPdf(tree);
    } catch {
      setExportError('No se pudo generar el PDF. Intente de nuevo.');
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="org-chart-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="org-chart-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="org-chart-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="org-chart-modal__header">
          <div>
            <h2 id="org-chart-modal-title" className="org-chart-modal__title">
              Organigrama estructural
            </h2>
            <p className="org-chart-modal__subtitle">
              Casa de Cambios Insular, S.A. —{' '}
              {totalAreas === 1 ? '1 área activa' : `${totalAreas} áreas activas`}
            </p>
          </div>
          <div className="org-chart-modal__actions">
            <button
              type="button"
              className="admin-btn admin-btn--ghost org-chart-modal__download"
              disabled={exportingPdf || tree.length === 0}
              onClick={() => void handleDownloadPdf()}
            >
              <Download size={18} aria-hidden />
              {exportingPdf ? 'Generando PDF…' : 'Descargar PDF'}
            </button>
            <button
              type="button"
              className="org-chart-modal__close"
              onClick={onClose}
              aria-label="Cerrar"
            >
              <X size={22} aria-hidden />
            </button>
          </div>
        </header>

        {exportError ? (
          <div className="org-chart-modal__export-error admin-alert admin-alert--error">
            {exportError}
          </div>
        ) : null}

        <div className="org-chart-modal__body">
          <div className="org-chart-modal__scroll">
            <OrgChartFit className="org-chart-fit--modal">
              <OrgChartTree nodes={tree} highlightAreaId={highlightAreaId} showLegalNotice />
            </OrgChartFit>
          </div>
        </div>
      </div>
    </div>
  );
}
