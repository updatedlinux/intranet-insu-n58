import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import { ApiError } from '../../api/client';
import {
  addTicketComment,
  assignTicket,
  fetchTicket,
  fetchTicketCapabilities,
  updateTicketPriority,
  updateTicketStatus,
} from '../../api/tickets';
import type {
  Ticket,
  TicketAttachment,
  TicketComment,
  TicketPriority,
  TicketStatus,
} from '../../api/tickets.types';
import { TicketAttachmentList } from '../../components/service-desk/TicketAttachmentList';
import { TicketCommentAuthorBadge } from '../../components/service-desk/TicketCommentAuthorBadge';
import {
  TicketPriorityBadge,
  TicketStatusBadge,
} from '../../components/service-desk/TicketStatusBadge';
import { PageHeader } from '../../components/layout';
import { Select } from '../../components/ui/Select';
import { useAuth } from '../../context/AuthContext';
import { formatDateTime, formatRelativeTime } from '../../utils/relative-time';
import { TicketInventoryPanels } from '../../components/service-desk/TicketInventoryPanels';

const IT_STATUSES = [
  'OPEN',
  'IN_PROGRESS',
  'ON_HOLD',
  'RESOLVED',
] as const satisfies readonly TicketStatus[];
const PRIORITIES: TicketPriority[] = ['Low', 'Medium', 'High', 'Critical'];

const TICKET_STATUS_LABELS: Record<(typeof IT_STATUSES)[number], string> = {
  OPEN: 'Abierto',
  IN_PROGRESS: 'En progreso',
  ON_HOLD: 'En espera',
  RESOLVED: 'Resuelto',
};

interface TicketDetailPageProps {
  manageMode?: boolean;
}

export function TicketDetailPage({ manageMode = false }: TicketDetailPageProps) {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const ticketId = Number.parseInt(id ?? '', 10);
  const [item, setItem] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [canManageDesk, setCanManageDesk] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const listPath = manageMode ? '/service-desk/gestion' : '/service-desk';

  const load = useCallback(async () => {
    if (Number.isNaN(ticketId)) {
      setError('Ticket inválido');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetchTicket(ticketId);
      setItem(res.item);
      setComments(res.comments);
      setAttachments(res.attachments ?? []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar el ticket');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    void fetchTicketCapabilities()
      .then((c) => setCanManageDesk(c.canManageDesk))
      .catch(() => setCanManageDesk(false));
    void load();
  }, [load]);

  const handleComment = (e: FormEvent) => {
    e.preventDefault();
    if (!message.trim() || item?.status === 'CLOSED') return;
    setSending(true);
    void (async () => {
      try {
        const res = await addTicketComment(ticketId, message.trim());
        setComments((prev) => [...prev, res.comment]);
        setMessage('');
        await load();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo enviar el comentario');
      } finally {
        setSending(false);
      }
    })();
  };

  const handleTakeTicket = () => {
    setActionLoading(true);
    void (async () => {
      try {
        await assignTicket(ticketId);
        await load();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo asignar');
      } finally {
        setActionLoading(false);
      }
    })();
  };

  const handleStatus = (status: TicketStatus) => {
    setActionLoading(true);
    void (async () => {
      try {
        await updateTicketStatus(ticketId, status);
        await load();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo actualizar el estado');
      } finally {
        setActionLoading(false);
      }
    })();
  };

  const handlePriority = (priority: TicketPriority) => {
    setActionLoading(true);
    void (async () => {
      try {
        await updateTicketPriority(ticketId, priority);
        await load();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo actualizar la prioridad');
      } finally {
        setActionLoading(false);
      }
    })();
  };

  const showManage = manageMode && canManageDesk;
  const isAssignedToMe = item != null && user != null && item.assignedTo === user.id;
  const canTakeOrAssign = showManage && item != null && item.status !== 'CLOSED' && !isAssignedToMe;

  if (loading) return <p className="text-gray">Cargando ticket…</p>;
  if (error && !item) {
    return (
      <>
        <Link to={listPath} className="announcement-back-link">
          <ArrowLeft size={16} aria-hidden />
          Volver
        </Link>
        <div className="admin-alert admin-alert--error">{error}</div>
      </>
    );
  }
  if (!item) return null;

  const canClose = item.status === 'RESOLVED' && !showManage;

  return (
    <>
      <PageHeader
        title={`${item.code} — ${item.title}`}
        breadcrumbParent={manageMode ? 'Mesa de ayuda TI' : 'Solicitud de Soporte TI'}
        breadcrumbCurrent="Detalle"
        breadcrumbParentHref={listPath}
      />

      <Link to={listPath} className="announcement-back-link mb-20">
        <ArrowLeft size={16} aria-hidden />
        Volver al listado
      </Link>

      {error && <div className="admin-alert admin-alert--error mb-20">{error}</div>}

      <div className="sd-detail-grid">
        <div>
          <div className="sd-chat card-style">
            <div className="sd-chat__original">
              <p className="sd-chat__meta">
                <strong>{item.requesterName}</strong>
                <span className="sd-chat__meta-sep">·</span>
                {item.requesterAreaName}
                <span className="sd-chat__meta-sep">·</span>
                <TicketCommentAuthorBadge role="requester" />
                <span className="sd-chat__meta-sep">·</span>
                <time dateTime={item.createdAt} title={formatRelativeTime(item.createdAt)}>
                  {formatDateTime(item.createdAt)}
                </time>
              </p>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{item.description}</p>
              <TicketAttachmentList
                ticketId={ticketId}
                attachments={attachments}
                onError={(msg) => setError(msg)}
              />
            </div>

            {comments.map((c) => (
              <div
                key={c.id}
                className={`sd-chat__bubble ${c.isOwn ? 'sd-chat__bubble--own' : 'sd-chat__bubble--other'}`}
              >
                <p className="sd-chat__meta">
                  <strong>{c.authorName}</strong>
                  <span className="sd-chat__meta-sep">·</span>
                  {c.authorAreaName}
                  <span className="sd-chat__meta-sep">·</span>
                  <TicketCommentAuthorBadge role={c.authorRole} inverted={c.isOwn} />
                  <span className="sd-chat__meta-sep">·</span>
                  <time dateTime={c.createdAt} title={formatRelativeTime(c.createdAt)}>
                    {formatDateTime(c.createdAt)}
                  </time>
                </p>
                <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{c.message}</p>
              </div>
            ))}
          </div>

          {item.status !== 'CLOSED' && (
            <form className="sd-compose card-style" onSubmit={handleComment}>
              <textarea
                className="admin-form__input"
                placeholder="Escriba un comentario…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={sending}
              />
              <button
                type="submit"
                className="admin-btn admin-btn--primary"
                disabled={sending || !message.trim()}
              >
                <Send size={16} aria-hidden />
                Enviar
              </button>
            </form>
          )}
        </div>

        <aside className="sd-side-panel card-style">
          <dl>
            <dt>Creado</dt>
            <dd>
              <time dateTime={item.createdAt} title={formatRelativeTime(item.createdAt)}>
                {formatDateTime(item.createdAt)}
              </time>
            </dd>
            <dt>Solicitante</dt>
            <dd>
              {item.requesterName}
              <span className="sd-side-panel__sub">{item.requesterAreaName}</span>
            </dd>
            <dt>Estado</dt>
            <dd>
              <TicketStatusBadge status={item.status} label={item.statusLabel} />
            </dd>
            <dt>Prioridad</dt>
            <dd>
              <TicketPriorityBadge priority={item.priority} label={item.priorityLabel} />
            </dd>
            <dt>Categoría</dt>
            <dd>{item.categoryName}</dd>
            <dt>Adjuntos</dt>
            <dd>{attachments.length > 0 ? attachments.length : 'Ninguno'}</dd>
            <dt>Asignado a</dt>
            <dd>{item.assigneeName ?? 'Sin asignar'}</dd>
          </dl>

          {showManage && (
            <div className="mt-20">
              <p className="sd-side-panel__hint">
                Cualquier agente de TI puede responder y gestionar este ticket.
              </p>
              {canTakeOrAssign && (
                <button
                  type="button"
                  className="admin-btn admin-btn--primary w-100 mb-10"
                  onClick={handleTakeTicket}
                  disabled={actionLoading}
                >
                  {item.assignedTo ? 'Asignarme' : 'Tomar ticket'}
                </button>
              )}
              <label className="admin-form__label" htmlFor="sdStatus">
                Estado
              </label>
              <Select
                id="sdStatus"
                className="mb-10"
                value={item.status}
                onChange={(v) => handleStatus(v as TicketStatus)}
                disabled={actionLoading || item.status === 'CLOSED'}
                options={IT_STATUSES.map((s) => ({ value: s, label: TICKET_STATUS_LABELS[s] }))}
              />
              <label className="admin-form__label" htmlFor="sdPri">
                Prioridad
              </label>
              <Select
                id="sdPri"
                value={item.priority}
                onChange={(v) => handlePriority(v as TicketPriority)}
                disabled={actionLoading}
                options={PRIORITIES.map((p) => ({ value: p, label: p }))}
              />
            </div>
          )}

          {canClose && (
            <button
              type="button"
              className="admin-btn admin-btn--primary w-100 mt-20"
              onClick={() => handleStatus('CLOSED')}
              disabled={actionLoading}
            >
              Cerrar ticket
            </button>
          )}
        </aside>
      </div>

      {showManage && item && (
        <TicketInventoryPanels
          ticketId={ticketId}
          requesterId={item.requesterId}
          ticketCode={item.code}
        />
      )}
    </>
  );
}
