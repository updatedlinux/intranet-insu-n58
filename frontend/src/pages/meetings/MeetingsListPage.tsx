import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, Monitor, Plus, RefreshCw, Users } from 'lucide-react';
import { ApiError } from '../../api/client';
import { fetchMeetings } from '../../api/meetings';
import type { MeetingListItem, MeetingListTab } from '../../api/meetings.types';
import { PageHeader } from '../../components/layout';
import { formatDateTime } from '../../utils/relative-time';

function ModalityBadge({ isRemote, label }: { isRemote: boolean; label: string }) {
  return (
    <span
      className={`meetings-badge meetings-badge--modality${isRemote ? ' is-remote' : ' is-in-person'}`}
    >
      {isRemote ? <Monitor size={12} aria-hidden /> : <MapPin size={12} aria-hidden />}
      {label}
    </span>
  );
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <span
      className={`meetings-badge meetings-badge--status meetings-badge--${status.toLowerCase()}`}
    >
      {label}
    </span>
  );
}

export function MeetingsListPage() {
  const [tab, setTab] = useState<MeetingListTab>('upcoming');
  const [items, setItems] = useState<MeetingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchMeetings({ tab });
      setItems(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las reuniones');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="Reuniones"
        breadcrumbParent="Comunicación"
        breadcrumbCurrent="Reuniones"
        breadcrumbParentHref="/reuniones"
      />

      <div className="meetings-toolbar card-style mb-30">
        <div className="meetings-tabs" role="tablist" aria-label="Filtrar reuniones">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'upcoming'}
            className={`meetings-tabs__btn${tab === 'upcoming' ? ' is-active' : ''}`}
            onClick={() => setTab('upcoming')}
          >
            Próximas
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'past'}
            className={`meetings-tabs__btn${tab === 'past' ? ' is-active' : ''}`}
            onClick={() => setTab('past')}
          >
            Pasadas
          </button>
        </div>

        <div className="meetings-toolbar__actions">
          <Link to="/reuniones/nueva" className="admin-btn admin-btn--primary">
            <Plus size={16} aria-hidden />
            Nueva Reunión
          </Link>
          <button
            type="button"
            className="admin-btn admin-btn--ghost"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw size={16} aria-hidden />
            Actualizar
          </button>
        </div>
      </div>

      {error && <div className="admin-alert admin-alert--error mb-20">{error}</div>}

      <div className="card-style mb-30">
        {loading ? (
          <p className="text-gray meetings-empty">Cargando reuniones…</p>
        ) : items.length === 0 ? (
          <div className="meetings-empty">
            <Calendar size={32} strokeWidth={1.5} aria-hidden />
            <p>
              {tab === 'upcoming'
                ? 'No tiene reuniones próximas.'
                : 'No hay reuniones pasadas registradas.'}
            </p>
            {tab === 'upcoming' && (
              <Link to="/reuniones/nueva" className="admin-link">
                Programar una reunión
              </Link>
            )}
          </div>
        ) : (
          <ul className="meetings-list">
            {items.map((meeting) => (
              <MeetingListRow key={meeting.id} meeting={meeting} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function MeetingListRow({ meeting }: { meeting: MeetingListItem }) {
  return (
    <li className="meetings-list__item">
      <Link to={`/reuniones/${meeting.id}`} className="meetings-list__link">
        <div className="meetings-list__main">
          <h3 className="meetings-list__title">{meeting.title}</h3>
          <p className="meetings-list__datetime">
            <Calendar size={14} aria-hidden />
            {formatDateTime(meeting.startDateTime)}
            {' — '}
            {formatDateTime(meeting.endDateTime)}
          </p>
          <p className="meetings-list__organizer">
            Organiza: {meeting.organizerName}
            {meeting.isOrganizer && <span className="meetings-list__you-badge">Usted</span>}
          </p>
        </div>
        <div className="meetings-list__meta">
          <ModalityBadge isRemote={meeting.isRemote} label={meeting.modalityLabel} />
          <StatusBadge status={meeting.status} label={meeting.statusLabel} />
          <span className="meetings-list__attendees">
            <Users size={14} aria-hidden />
            {meeting.attendeeCount}
          </span>
        </div>
      </Link>
    </li>
  );
}
