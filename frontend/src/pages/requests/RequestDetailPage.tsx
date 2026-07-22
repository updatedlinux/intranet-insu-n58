import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Kanban, RefreshCw } from 'lucide-react';
import { ApiError } from '../../api/client';
import { fetchRequest, updateRequestStatus } from '../../api/requests';
import type {
  InternalRequest,
  RequestStatus,
  RequestStatusHistoryItem,
} from '../../api/requests.types';
import { LinkTaskModal } from '../../components/requests/LinkTaskModal';
import { RequestPriorityBadge, RequestStatusBadge } from '../../components/requests/RequestBadges';
import { RequestStatusTimeline } from '../../components/requests/RequestStatusTimeline';
import { PageHeader } from '../../components/layout';
import { Select } from '../../components/ui/Select';
import { formatDateTime } from '../../utils/relative-time';

const LEADER_NEXT: Partial<Record<RequestStatus, { value: RequestStatus; label: string }[]>> = {
  SUBMITTED: [
    { value: 'RECEIVED', label: 'Marcar como recibida' },
    { value: 'REJECTED', label: 'Rechazar' },
  ],
  RECEIVED: [
    { value: 'IN_PROGRESS', label: 'En proceso' },
    { value: 'REJECTED', label: 'Rechazar' },
  ],
  IN_PROGRESS: [
    { value: 'RESOLVED', label: 'Marcar como resuelta' },
    { value: 'REJECTED', label: 'Rechazar' },
  ],
};

export function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const requestId = Number.parseInt(id ?? '', 10);
  const inboxView = searchParams.get('vista') === 'bandeja';

  const [item, setItem] = useState<InternalRequest | null>(null);
  const [history, setHistory] = useState<RequestStatusHistoryItem[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [canClose, setCanClose] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [nextStatus, setNextStatus] = useState<RequestStatus | ''>('');
  const [comment, setComment] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [linkModalOpen, setLinkModalOpen] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isInteger(requestId)) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetchRequest(requestId);
      setItem(res.item);
      setHistory(res.history);
      setCanManage(res.capabilities.canManage);
      setCanClose(res.capabilities.canClose);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar la solicitud');
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    void load();
  }, [load]);

  const showManage =
    canManage && item != null && item.status !== 'CLOSED' && item.status !== 'REJECTED';
  const manageOptions = item ? LEADER_NEXT[item.status] : undefined;

  async function handleStatusUpdate() {
    if (!item || !nextStatus) return;
    setSaving(true);
    setError('');
    try {
      const res = await updateRequestStatus(item.id, {
        status: nextStatus,
        comment: comment.trim() || null,
        rejectionReason: nextStatus === 'REJECTED' ? rejectionReason.trim() : null,
      });
      setItem(res.item);
      setHistory(res.history);
      setCanManage(res.capabilities.canManage);
      setCanClose(res.capabilities.canClose);
      setNextStatus('');
      setComment('');
      setRejectionReason('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar el estado');
    } finally {
      setSaving(false);
    }
  }

  async function handleClose() {
    if (!item) return;
    setSaving(true);
    try {
      const res = await updateRequestStatus(item.id, { status: 'CLOSED' });
      setItem(res.item);
      setHistory(res.history);
      setCanClose(res.capabilities.canClose);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cerrar la solicitud');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-gray p-20">Cargando solicitud…</p>;
  }

  if (!item) {
    return (
      <>
        {error && <div className="admin-alert admin-alert--error mb-20">{error}</div>}
        <p className="text-gray">Solicitud no encontrada.</p>
        <Link to="/solicitudes" className="admin-link">
          Volver al listado
        </Link>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={item.code}
        breadcrumbParent="Solicitudes"
        breadcrumbCurrent={item.title}
        breadcrumbParentHref={inboxView ? '/solicitudes' : '/solicitudes'}
      />

      <div className="req-detail-toolbar mb-20">
        <Link to={`/solicitudes${inboxView ? '' : ''}`} className="admin-btn admin-btn--ghost">
          ← Volver
        </Link>
        <button type="button" className="admin-btn admin-btn--ghost" onClick={() => void load()}>
          <RefreshCw size={16} aria-hidden />
          Actualizar
        </button>
      </div>

      {error && <div className="admin-alert admin-alert--error mb-20">{error}</div>}

      <div className="req-detail-grid">
        <section className="card-style req-detail-main">
          <div className="req-detail-head">
            <h2 className="req-detail-title">{item.title}</h2>
            <div className="req-detail-badges">
              <RequestStatusBadge status={item.status} />
              <RequestPriorityBadge priority={item.priority} />
            </div>
          </div>

          <dl className="req-detail-meta">
            <div>
              <dt>Área destino</dt>
              <dd>{item.targetAreaName}</dd>
            </div>
            <div>
              <dt>Solicitante</dt>
              <dd>
                {item.requesterName} ({item.requesterAreaName})
              </dd>
            </div>
            <div>
              <dt>Creada</dt>
              <dd>{formatDateTime(item.createdAt)}</dd>
            </div>
            {item.resolvedAt && (
              <div>
                <dt>Resuelta</dt>
                <dd>{formatDateTime(item.resolvedAt)}</dd>
              </div>
            )}
            {item.rejectionReason && (
              <div>
                <dt>Motivo de rechazo</dt>
                <dd>{item.rejectionReason}</dd>
              </div>
            )}
          </dl>

          <h3 className="req-detail-section-title">Descripción</h3>
          <p className="req-detail-description">{item.description}</p>

          {item.linkedTaskId && item.linkedTaskTitle && (
            <div className="req-linked-task card-style">
              <Kanban size={18} aria-hidden />
              <div>
                <strong>Tarea vinculada</strong>
                <p>{item.linkedTaskTitle}</p>
                <Link to={`/actividades?task=${item.linkedTaskId}`} className="admin-link">
                  Abrir en Kanban
                </Link>
              </div>
            </div>
          )}

          {canClose && (
            <div className="req-close-box mt-20">
              <p>Esta solicitud fue resuelta. Confirme el cierre cuando esté conforme.</p>
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                disabled={saving}
                onClick={() => void handleClose()}
              >
                Cerrar solicitud
              </button>
            </div>
          )}
        </section>

        <aside className="req-detail-side">
          {showManage && manageOptions && manageOptions.length > 0 && (
            <section className="card-style mb-20">
              <h3 className="req-detail-section-title">Gestionar estado</h3>
              <Select
                className="mb-12"
                value={nextStatus}
                onChange={(v) => setNextStatus(v as RequestStatus | '')}
                placeholder="Seleccione acción…"
                options={manageOptions.map((opt) => ({ value: opt.value, label: opt.label }))}
              />
              {nextStatus === 'REJECTED' && (
                <textarea
                  className="admin-form__input mb-12"
                  rows={3}
                  placeholder="Motivo de rechazo (obligatorio)"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  required
                />
              )}
              <textarea
                className="admin-form__input mb-12"
                rows={2}
                placeholder="Comentario opcional"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                disabled={
                  !nextStatus || saving || (nextStatus === 'REJECTED' && !rejectionReason.trim())
                }
                onClick={() => void handleStatusUpdate()}
              >
                Confirmar cambio
              </button>
              {!item.linkedTaskId && (
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost mt-12"
                  onClick={() => setLinkModalOpen(true)}
                >
                  Vincular a tarea
                </button>
              )}
            </section>
          )}

          <section className="card-style">
            <h3 className="req-detail-section-title">Historial</h3>
            <RequestStatusTimeline history={history} />
          </section>
        </aside>
      </div>

      <LinkTaskModal
        open={linkModalOpen}
        requestId={item.id}
        targetAreaId={item.targetAreaId}
        onClose={() => setLinkModalOpen(false)}
        onLinked={() => void load()}
      />
    </>
  );
}
