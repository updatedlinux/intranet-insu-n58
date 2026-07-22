import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Check,
  ExternalLink,
  MapPin,
  Monitor,
  Pencil,
  User,
  Users,
  X,
} from 'lucide-react';
import { ApiError } from '../../api/client';
import { cancelMeeting, completeMeeting, fetchMeeting, respondToMeeting } from '../../api/meetings';
import type { MeetingAttendeeStatus, MeetingDetail } from '../../api/meetings.types';
import { PageHeader } from '../../components/layout';
import { useAuth } from '../../context/AuthContext';
import { formatDateTime } from '../../utils/relative-time';

function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <span
      className={`meetings-badge meetings-badge--status meetings-badge--${status.toLowerCase()}`}
    >
      {label}
    </span>
  );
}

function AttendeeStatusBadge({ status, label }: { status: MeetingAttendeeStatus; label: string }) {
  return (
    <span
      className={`meetings-badge meetings-badge--attendee meetings-badge--attendee-${status.toLowerCase()}`}
    >
      {label}
    </span>
  );
}

export function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const meetingId = Number.parseInt(id ?? '', 10);

  const [item, setItem] = useState<MeetingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');

  const load = useCallback(async () => {
    if (Number.isNaN(meetingId)) {
      setError('Reunión inválida');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetchMeeting(meetingId);
      setItem(res.item);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar la reunión');
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRespond = (status: MeetingAttendeeStatus) => {
    if (!user || !item) return;
    setActionLoading(true);
    void (async () => {
      try {
        const res = await respondToMeeting(meetingId, user.id, status);
        setItem(res.item);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo registrar su respuesta');
      } finally {
        setActionLoading(false);
      }
    })();
  };

  const handleComplete = () => {
    setActionLoading(true);
    void (async () => {
      try {
        const res = await completeMeeting(meetingId);
        setItem(res.item);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo completar la reunión');
      } finally {
        setActionLoading(false);
      }
    })();
  };

  const handleCancel = () => {
    const reason = cancelReason.trim();
    if (!reason) {
      setCancelError('Indique el motivo de cancelación');
      return;
    }
    setActionLoading(true);
    setCancelError('');
    void (async () => {
      try {
        const res = await cancelMeeting(meetingId, reason);
        setItem(res.item);
        setCancelOpen(false);
        setCancelReason('');
      } catch (err) {
        setCancelError(err instanceof ApiError ? err.message : 'No se pudo cancelar la reunión');
      } finally {
        setActionLoading(false);
      }
    })();
  };

  if (loading) return <p className="text-gray">Cargando reunión…</p>;

  if (error && !item) {
    return (
      <>
        <Link to="/reuniones" className="announcement-back-link">
          <ArrowLeft size={16} aria-hidden />
          Volver
        </Link>
        <div className="admin-alert admin-alert--error">{error}</div>
      </>
    );
  }

  if (!item) return null;

  const showJoinLink =
    item.isRemote &&
    item.meetingLink &&
    (item.status === 'SCHEDULED' || item.status === 'RESCHEDULED');

  return (
    <>
      <PageHeader
        title={item.title}
        breadcrumbParent="Reuniones"
        breadcrumbCurrent="Detalle"
        breadcrumbParentHref="/reuniones"
      />

      <Link to="/reuniones" className="announcement-back-link mb-20">
        <ArrowLeft size={16} aria-hidden />
        Volver al listado
      </Link>

      {error && <div className="admin-alert admin-alert--error mb-20">{error}</div>}

      <div className="meetings-detail card-style mb-30">
        <div className="meetings-detail__header">
          <div>
            <div className="meetings-detail__badges">
              <span
                className={`meetings-badge meetings-badge--modality${item.isRemote ? ' is-remote' : ' is-in-person'}`}
              >
                {item.isRemote ? (
                  <Monitor size={12} aria-hidden />
                ) : (
                  <MapPin size={12} aria-hidden />
                )}
                {item.modalityLabel}
              </span>
              <StatusBadge status={item.status} label={item.statusLabel} />
            </div>
            <h2 className="meetings-detail__title">{item.title}</h2>
            <p className="meetings-detail__organizer">
              <User size={14} aria-hidden />
              Organiza: {item.organizerName}
            </p>
          </div>

          <div className="meetings-detail__actions">
            {showJoinLink && (
              <a
                href={item.meetingLink!}
                target="_blank"
                rel="noopener noreferrer"
                className="admin-btn admin-btn--primary"
              >
                <ExternalLink size={16} aria-hidden />
                Unirse a la reunión
              </a>
            )}
            {item.canEdit && (
              <Link to={`/reuniones/${item.id}/editar`} className="admin-btn admin-btn--ghost">
                <Pencil size={16} aria-hidden />
                Editar
              </Link>
            )}
            {item.canCancel && (
              <button
                type="button"
                className="admin-btn admin-btn--danger"
                onClick={() => setCancelOpen(true)}
                disabled={actionLoading}
              >
                Cancelar
              </button>
            )}
            {item.canComplete && (
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                onClick={() => handleComplete()}
                disabled={actionLoading}
              >
                Marcar completada
              </button>
            )}
            {item.canRespond && item.myAttendeeStatus === 'PENDING' && (
              <>
                <button
                  type="button"
                  className="admin-btn admin-btn--primary"
                  onClick={() => handleRespond('ACCEPTED')}
                  disabled={actionLoading}
                >
                  <Check size={16} aria-hidden />
                  Aceptar
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost"
                  onClick={() => handleRespond('DECLINED')}
                  disabled={actionLoading}
                >
                  <X size={16} aria-hidden />
                  Declinar
                </button>
              </>
            )}
          </div>
        </div>

        <div className="meetings-detail__grid">
          <section className="meetings-detail__section">
            <h3>
              <Calendar size={16} aria-hidden />
              Fecha y hora
            </h3>
            <p>
              <strong>Inicio:</strong> {formatDateTime(item.startDateTime)}
            </p>
            <p>
              <strong>Fin:</strong> {formatDateTime(item.endDateTime)}
            </p>
            {item.originalStartDateTime && (
              <p className="meetings-detail__rescheduled">
                Fecha original: {formatDateTime(item.originalStartDateTime)}
              </p>
            )}
          </section>

          <section className="meetings-detail__section">
            <h3>
              {item.isRemote ? <Monitor size={16} aria-hidden /> : <MapPin size={16} aria-hidden />}
              {item.isRemote ? 'Enlace' : 'Ubicación'}
            </h3>
            {item.isRemote ? (
              item.meetingLink ? (
                <a
                  href={item.meetingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="admin-link"
                >
                  {item.meetingLink}
                </a>
              ) : (
                <p>—</p>
              )
            ) : (
              <p>{item.location ?? '—'}</p>
            )}
          </section>
        </div>

        {item.description && (
          <section className="meetings-detail__section meetings-detail__section--full">
            <h3>Descripción</h3>
            <p className="meetings-detail__description">{item.description}</p>
          </section>
        )}

        {item.status === 'CANCELLED' && item.cancellationReason && (
          <div className="admin-alert admin-alert--error meetings-detail__cancel-reason">
            <strong>Motivo de cancelación:</strong> {item.cancellationReason}
          </div>
        )}

        <section className="meetings-detail__section meetings-detail__section--full">
          <h3>
            <Users size={16} aria-hidden />
            Asistentes internos ({item.internalAttendees.length})
          </h3>
          {item.internalAttendees.length === 0 ? (
            <p className="text-gray">Sin asistentes internos.</p>
          ) : (
            <ul className="meetings-attendees-list">
              {item.internalAttendees.map((attendee) => (
                <li key={attendee.id} className="meetings-attendees-list__item">
                  <div>
                    <span className="meetings-attendees-list__name">{attendee.fullName}</span>
                    <span className="meetings-attendees-list__area">{attendee.areaName}</span>
                  </div>
                  <AttendeeStatusBadge status={attendee.status} label={attendee.statusLabel} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="meetings-detail__section meetings-detail__section--full">
          <h3>Asistentes externos ({item.externalAttendees.length})</h3>
          {item.externalAttendees.length === 0 ? (
            <p className="text-gray">Sin asistentes externos.</p>
          ) : (
            <ul className="meetings-attendees-list meetings-attendees-list--external">
              {item.externalAttendees.map((attendee) => (
                <li key={attendee.id} className="meetings-attendees-list__item">
                  <div>
                    <span className="meetings-attendees-list__name">{attendee.name}</span>
                    {attendee.company && (
                      <span className="meetings-attendees-list__area">{attendee.company}</span>
                    )}
                    {attendee.email && (
                      <a
                        href={`mailto:${attendee.email}`}
                        className="admin-link meetings-attendees-list__email"
                      >
                        {attendee.email}
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {cancelOpen && (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onClick={() => !actionLoading && setCancelOpen(false)}
        >
          <div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-meeting-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="cancel-meeting-title" className="admin-modal__title">
              Cancelar reunión
            </h3>
            <div className="admin-modal__body">
              <p>Indique el motivo de la cancelación. Se notificará a todos los asistentes.</p>
              <label className="admin-form__label" htmlFor="cancel-reason">
                Motivo
              </label>
              <textarea
                id="cancel-reason"
                className="admin-form__input admin-form__textarea"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={4}
                required
              />
              {cancelError && (
                <div className="admin-alert admin-alert--error mt-10">{cancelError}</div>
              )}
            </div>
            <div className="admin-modal__actions">
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                onClick={() => setCancelOpen(false)}
                disabled={actionLoading}
              >
                Volver
              </button>
              <button
                type="button"
                className="admin-btn admin-btn--danger"
                onClick={() => handleCancel()}
                disabled={actionLoading}
              >
                {actionLoading ? 'Cancelando…' : 'Confirmar cancelación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
