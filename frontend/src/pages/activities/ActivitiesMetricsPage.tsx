import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { ApiError } from '../../api/client';
import { fetchBoard, fetchMyBoards } from '../../api/boards';
import type { BoardSummary } from '../../api/boards.types';
import { PageHeader } from '../../components/layout';
import { BoardMetricsPanel } from '../../components/activities/BoardMetricsPanel';
import { Select } from '../../components/ui/Select';

interface ManageableBoard extends BoardSummary {
  canViewMetrics: boolean;
}

export function ActivitiesMetricsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [boards, setBoards] = useState<ManageableBoard[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { items } = await fetchMyBoards();
      const manageable: ManageableBoard[] = [];

      await Promise.all(
        items.map(async (board) => {
          try {
            const detail = await fetchBoard(board.id);
            if (detail.capabilities.canViewMetrics) {
              manageable.push({ ...board, canViewMetrics: true });
            }
          } catch {
            /* sin acceso de gestión a este tablero */
          }
        }),
      );

      manageable.sort((a, b) => a.areaName.localeCompare(b.areaName));
      setBoards(manageable);

      const boardParam = searchParams.get('board');
      const paramId = boardParam ? Number.parseInt(boardParam, 10) : NaN;
      const fromParam = manageable.find((b) => b.id === paramId)?.id;
      setSelectedBoardId(fromParam ?? manageable[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los tableros');
      setBoards([]);
      setSelectedBoardId(null);
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleBoardChange = (boardId: number) => {
    setSelectedBoardId(boardId);
    setSearchParams({ board: String(boardId) });
  };

  const openTask = (taskId: number) => {
    navigate(`/actividades?task=${taskId}`);
  };

  const selectedBoard = boards.find((b) => b.id === selectedBoardId);

  return (
    <div className="kanban-metrics-page">
      <PageHeader
        title="Métricas"
        breadcrumbParent="Actividades"
        breadcrumbCurrent="Métricas"
        breadcrumbParentHref="/actividades"
      />

      <div className="kanban-metrics-toolbar card-style mb-20">
        <div className="kanban-metrics-toolbar__main">
          {boards.length > 1 && selectedBoardId != null && (
            <label className="kanban-metrics-toolbar__select">
              <span className="sr-only">Tablero</span>
              <Select
                value={String(selectedBoardId)}
                onChange={(v) => handleBoardChange(Number.parseInt(v, 10))}
                options={boards.map((b) => ({
                  value: String(b.id),
                  label: b.name,
                }))}
              />
              {selectedBoard ? (
                <span className="kanban-metrics-toolbar__area">{selectedBoard.areaName}</span>
              ) : null}
            </label>
          )}
          {boards.length === 1 && (
            <div className="kanban-metrics-toolbar__single">
              <span className="kanban-metrics-toolbar__board-name">{boards[0]!.name}</span>
              <span className="kanban-metrics-toolbar__area">{boards[0]!.areaName}</span>
            </div>
          )}
        </div>
        <div className="kanban-metrics-toolbar__actions">
          <button type="button" className="admin-btn admin-btn--ghost" onClick={() => void load()}>
            <RefreshCw size={16} aria-hidden />
            Actualizar
          </button>
        </div>
      </div>

      {error && <div className="admin-alert admin-alert--error mb-20">{error}</div>}

      {loading ? (
        <p className="text-gray p-20">Cargando métricas…</p>
      ) : boards.length === 0 ? (
        <div className="card-style p-20">
          <p className="text-gray">
            No tiene tableros con métricas disponibles para las áreas que gestiona.
          </p>
        </div>
      ) : selectedBoardId ? (
        <BoardMetricsPanel boardId={selectedBoardId} onOpenTask={openTask} />
      ) : null}
    </div>
  );
}
