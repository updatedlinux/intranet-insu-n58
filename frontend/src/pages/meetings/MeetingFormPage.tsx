import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { ApiError } from '../../api/client';
import { createMeeting, fetchMeeting, updateMeeting } from '../../api/meetings';
import type { MeetingExternalAttendeeInput } from '../../api/meetings.types';
import {
  CollaboratorSearchMultiSelect,
  type CollaboratorOption,
} from '../../components/admin/CollaboratorSearchMultiSelect';
import { ConfirmModal } from '../../components/admin/ConfirmModal';
import { PageHeader } from '../../components/layout';

interface ExternalRow {
  key: string;
  name: string;
  email: string;
  company: string;
}

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): string {
  return new Date(value).toISOString();
}

function defaultStartEnd(): { start: string; end: string } {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start);
  end.setHours(end.getHours() + 1);
  return {
    start: toDatetimeLocalValue(start.toISOString()),
    end: toDatetimeLocalValue(end.toISOString()),
  };
}

function newExternalRow(): ExternalRow {
  return { key: crypto.randomUUID(), name: '', email: '', company: '' };
}

export function MeetingFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const meetingId = Number.parseInt(id ?? '', 10);
  const formId = useId();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDateTime, setStartDateTime] = useState('');
  const [endDateTime, setEndDateTime] = useState('');
  const [isRemote, setIsRemote] = useState(false);
  const [location, setLocation] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [internalAttendeeIds, setInternalAttendeeIds] = useState<number[]>([]);
  const [initialCollaborators, setInitialCollaborators] = useState<CollaboratorOption[]>([]);
  const [externalRows, setExternalRows] = useState<ExternalRow[]>([]);

  const [fetching, setFetching] = useState(isEdit);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showRescheduleConfirm, setShowRescheduleConfirm] = useState(false);

  const originalDatesRef = useRef<{ start: string; end: string } | null>(null);

  useEffect(() => {
    if (!isEdit) {
      const defaults = defaultStartEnd();
      setStartDateTime(defaults.start);
      setEndDateTime(defaults.end);
      return;
    }

    if (Number.isNaN(meetingId)) {
      setError('Identificador inválido');
      setFetching(false);
      return;
    }

    void (async () => {
      try {
        const res = await fetchMeeting(meetingId);
        const m = res.item;
        if (!m.canEdit) {
          setError('No tiene permiso para editar esta reunión');
          return;
        }
        setTitle(m.title);
        setDescription(m.description ?? '');
        setStartDateTime(toDatetimeLocalValue(m.startDateTime));
        setEndDateTime(toDatetimeLocalValue(m.endDateTime));
        setIsRemote(m.isRemote);
        setLocation(m.location ?? '');
        setMeetingLink(m.meetingLink ?? '');
        setInternalAttendeeIds(m.internalAttendees.map((a) => a.userId));
        setInitialCollaborators(
          m.internalAttendees.map((a) => ({
            id: a.userId,
            label: a.fullName,
            detail: a.areaName,
          })),
        );
        setExternalRows(
          m.externalAttendees.length > 0
            ? m.externalAttendees.map((a) => ({
                key: String(a.id),
                name: a.name,
                email: a.email ?? '',
                company: a.company ?? '',
              }))
            : [],
        );
        originalDatesRef.current = {
          start: toDatetimeLocalValue(m.startDateTime),
          end: toDatetimeLocalValue(m.endDateTime),
        };
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar la reunión');
      } finally {
        setFetching(false);
      }
    })();
  }, [isEdit, meetingId]);

  const buildPayload = () => {
    const externalAttendees: MeetingExternalAttendeeInput[] = externalRows
      .filter((row) => row.name.trim())
      .map((row) => ({
        name: row.name.trim(),
        email: row.email.trim() || null,
        company: row.company.trim() || null,
      }));

    return {
      title: title.trim(),
      description: description.trim() || null,
      startDateTime: fromDatetimeLocalValue(startDateTime),
      endDateTime: fromDatetimeLocalValue(endDateTime),
      isRemote,
      meetingLink: isRemote ? meetingLink.trim() : null,
      location: isRemote ? null : location.trim(),
      internalAttendeeIds,
      externalAttendees,
    };
  };

  const validate = (): string | null => {
    if (!title.trim()) return 'El título es obligatorio';
    if (!startDateTime || !endDateTime) return 'Indique fecha y hora de inicio y fin';
    if (new Date(endDateTime) <= new Date(startDateTime)) {
      return 'La hora de fin debe ser posterior a la de inicio';
    }
    if (isRemote && !meetingLink.trim()) return 'Indique el enlace de la reunión remota';
    if (!isRemote && !location.trim()) return 'Indique la ubicación o sala';
    for (const row of externalRows) {
      if (
        row.name.trim() &&
        row.email.trim() &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email.trim())
      ) {
        return `Correo inválido para el externo "${row.name.trim()}"`;
      }
    }
    return null;
  };

  const submitMeeting = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const payload = buildPayload();
      if (isEdit) {
        const res = await updateMeeting(meetingId, payload);
        navigate(`/reuniones/${res.item.id}`);
      } else {
        const res = await createMeeting(payload);
        navigate(`/reuniones/${res.item.id}`);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar la reunión');
    } finally {
      setLoading(false);
      setShowRescheduleConfirm(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (isEdit && originalDatesRef.current) {
      const datesChanged =
        startDateTime !== originalDatesRef.current.start ||
        endDateTime !== originalDatesRef.current.end;
      if (datesChanged) {
        setShowRescheduleConfirm(true);
        return;
      }
    }

    void submitMeeting();
  };

  const addExternalRow = () => {
    setExternalRows((prev) => [...prev, newExternalRow()]);
  };

  const updateExternalRow = (key: string, field: keyof ExternalRow, value: string) => {
    setExternalRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    );
  };

  const removeExternalRow = (key: string) => {
    setExternalRows((prev) => prev.filter((row) => row.key !== key));
  };

  if (fetching) {
    return <p className="text-gray">Cargando reunión…</p>;
  }

  return (
    <>
      <PageHeader
        title={isEdit ? 'Editar reunión' : 'Nueva reunión'}
        breadcrumbParent="Reuniones"
        breadcrumbCurrent={isEdit ? 'Editar' : 'Alta'}
        breadcrumbParentHref="/reuniones"
      />

      <Link
        to={isEdit ? `/reuniones/${meetingId}` : '/reuniones'}
        className="announcement-back-link mb-20"
      >
        <ArrowLeft size={16} aria-hidden />
        Volver
      </Link>

      <form className="admin-form card-style mb-30 meetings-form" onSubmit={handleSubmit}>
        {error && <div className="admin-alert admin-alert--error mb-20">{error}</div>}

        <div className="admin-form__grid">
          <div className="admin-form__field admin-form__field--full">
            <label className="admin-form__label" htmlFor={`${formId}-title`}>
              Título
            </label>
            <input
              id={`${formId}-title`}
              className="admin-form__input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
            />
          </div>

          <div className="admin-form__field admin-form__field--full">
            <label className="admin-form__label" htmlFor={`${formId}-description`}>
              Descripción
            </label>
            <textarea
              id={`${formId}-description`}
              className="admin-form__input admin-form__textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          <div className="admin-form__field">
            <label className="admin-form__label" htmlFor={`${formId}-start`}>
              Inicio
            </label>
            <input
              id={`${formId}-start`}
              type="datetime-local"
              className="admin-form__input"
              value={startDateTime}
              onChange={(e) => setStartDateTime(e.target.value)}
              required
            />
          </div>

          <div className="admin-form__field">
            <label className="admin-form__label" htmlFor={`${formId}-end`}>
              Fin
            </label>
            <input
              id={`${formId}-end`}
              type="datetime-local"
              className="admin-form__input"
              value={endDateTime}
              onChange={(e) => setEndDateTime(e.target.value)}
              required
            />
          </div>

          {isEdit && (
            <div className="admin-form__field admin-form__field--full">
              <p className="meetings-form__hint">
                Cambiar la fecha notificará a todos los asistentes sobre la reprogramación.
              </p>
            </div>
          )}

          <div className="admin-form__field admin-form__field--full">
            <span className="admin-form__label">Modalidad</span>
            <div className="meetings-modality-toggle">
              <button
                type="button"
                className={`meetings-modality-toggle__btn${!isRemote ? ' is-active' : ''}`}
                onClick={() => setIsRemote(false)}
              >
                Presencial
              </button>
              <button
                type="button"
                className={`meetings-modality-toggle__btn${isRemote ? ' is-active' : ''}`}
                onClick={() => setIsRemote(true)}
              >
                Remota
              </button>
            </div>
          </div>

          {isRemote ? (
            <div className="admin-form__field admin-form__field--full">
              <label className="admin-form__label" htmlFor={`${formId}-link`}>
                Enlace de la reunión
              </label>
              <input
                id={`${formId}-link`}
                type="url"
                className="admin-form__input"
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
                placeholder="https://meet.google.com/…"
                required
              />
            </div>
          ) : (
            <div className="admin-form__field admin-form__field--full">
              <label className="admin-form__label" htmlFor={`${formId}-location`}>
                Ubicación / Sala
              </label>
              <input
                id={`${formId}-location`}
                className="admin-form__input"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Sala de Juntas 2"
                required
              />
            </div>
          )}

          <div className="admin-form__field admin-form__field--full">
            <label className="admin-form__label" htmlFor={`${formId}-attendees`}>
              Asistentes internos
            </label>
            <CollaboratorSearchMultiSelect
              id={`${formId}-attendees`}
              value={internalAttendeeIds}
              onChange={setInternalAttendeeIds}
              initialOptions={initialCollaborators}
            />
          </div>

          <div className="admin-form__field admin-form__field--full">
            <div className="meetings-external-header">
              <span className="admin-form__label">Asistentes externos</span>
              <button
                type="button"
                className="admin-btn admin-btn--ghost admin-btn--sm"
                onClick={addExternalRow}
              >
                <Plus size={14} aria-hidden />
                Agregar externo
              </button>
            </div>

            {externalRows.length === 0 ? (
              <p className="meetings-form__hint">
                Opcional. Use el botón para invitar personas fuera de la organización.
              </p>
            ) : (
              <div className="meetings-external-rows">
                {externalRows.map((row) => (
                  <div key={row.key} className="meetings-external-row">
                    <input
                      className="admin-form__input"
                      placeholder="Nombre *"
                      value={row.name}
                      onChange={(e) => updateExternalRow(row.key, 'name', e.target.value)}
                      aria-label="Nombre del asistente externo"
                    />
                    <input
                      className="admin-form__input"
                      type="email"
                      placeholder="Correo (opcional)"
                      value={row.email}
                      onChange={(e) => updateExternalRow(row.key, 'email', e.target.value)}
                      aria-label="Correo del asistente externo"
                    />
                    <input
                      className="admin-form__input"
                      placeholder="Empresa (opcional)"
                      value={row.company}
                      onChange={(e) => updateExternalRow(row.key, 'company', e.target.value)}
                      aria-label="Empresa del asistente externo"
                    />
                    <button
                      type="button"
                      className="meetings-external-row__remove"
                      onClick={() => removeExternalRow(row.key)}
                      aria-label="Quitar asistente externo"
                    >
                      <Trash2 size={16} aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="admin-form__actions">
          <button
            type="button"
            className="admin-btn admin-btn--ghost"
            onClick={() => navigate(isEdit ? `/reuniones/${meetingId}` : '/reuniones')}
            disabled={loading}
          >
            Cancelar
          </button>
          <button type="submit" className="admin-btn admin-btn--primary" disabled={loading}>
            {loading ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear reunión'}
          </button>
        </div>
      </form>

      <ConfirmModal
        open={showRescheduleConfirm}
        title="Confirmar reprogramación"
        message="Cambiar la fecha notificará a todos los asistentes sobre la reprogramación. ¿Desea continuar?"
        confirmLabel="Sí, reprogramar"
        loading={loading}
        onConfirm={() => void submitMeeting()}
        onCancel={() => setShowRescheduleConfirm(false)}
      />
    </>
  );
}
