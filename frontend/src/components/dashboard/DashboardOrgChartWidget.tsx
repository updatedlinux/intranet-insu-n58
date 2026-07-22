import { useEffect, useState } from 'react';
import { Maximize2, Network } from 'lucide-react';
import { ApiError } from '../../api/client';
import { fetchOrgChart } from '../../api/org-chart';
import type { OrgChartNode } from '../../api/org-chart.types';
import { useAuth } from '../../context/AuthContext';
import { OrgChartFit } from '../org-chart/OrgChartFit';
import { OrgChartModal } from '../org-chart/OrgChartModal';
import { OrgChartTree } from '../org-chart/OrgChartTree';

export function DashboardOrgChartWidget() {
  const { user } = useAuth();
  const [tree, setTree] = useState<OrgChartNode[]>([]);
  const [totalAreas, setTotalAreas] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    void fetchOrgChart()
      .then((res) => {
        setTree(res.tree);
        setTotalAreas(res.totalAreas);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar el organigrama');
      })
      .finally(() => setLoading(false));
  }, []);

  const highlightAreaId = user?.area.id ?? null;

  return (
    <>
      <div className="card-style mb-30 dashboard-org-chart">
        <div className="dashboard-org-chart__header">
          <div className="dashboard-org-chart__heading">
            <Network size={20} aria-hidden />
            <div>
              <h6 className="text-medium mb-0">Organigrama</h6>
              <p className="text-sm text-gray mb-0">
                Estructura organizacional por áreas
                {!loading && totalAreas > 0 ? ` · ${totalAreas} áreas` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="admin-btn admin-btn--primary admin-btn--sm"
            disabled={loading || tree.length === 0}
            onClick={() => setModalOpen(true)}
          >
            <Maximize2 size={14} aria-hidden />
            Ver completo
          </button>
        </div>

        {error ? (
          <p className="text-gray mb-0">{error}</p>
        ) : loading ? (
          <div className="dashboard-org-chart__preview dashboard-org-chart__preview--loading">
            <div className="dashboard-skeleton" style={{ minHeight: 180 }} />
          </div>
        ) : tree.length === 0 ? (
          <p className="text-gray mb-0">Aún no hay áreas activas para mostrar.</p>
        ) : (
          <button
            type="button"
            className="dashboard-org-chart__preview"
            onClick={() => setModalOpen(true)}
            aria-label="Abrir organigrama completo"
          >
            <div className="dashboard-org-chart__preview-inner">
              <OrgChartFit>
                <OrgChartTree nodes={tree} highlightAreaId={highlightAreaId} compact />
              </OrgChartFit>
            </div>
            <div className="dashboard-org-chart__preview-overlay">
              <span>
                <Maximize2 size={18} aria-hidden />
                Ver organigrama completo
              </span>
            </div>
          </button>
        )}
      </div>

      <OrgChartModal
        open={modalOpen}
        tree={tree}
        totalAreas={totalAreas}
        highlightAreaId={highlightAreaId}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
