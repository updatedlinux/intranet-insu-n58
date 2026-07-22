import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, RefreshCw, Users } from 'lucide-react';
import { ApiError } from '../../api/client';
import { fetchEvents } from '../../api/events';
import type { CorporateEvent, CorporateEventListTab } from '../../api/events.types';
import { PageHeader } from '../../components/layout';
import { formatDateTime } from '../../utils/relative-time';

function AudienceBadge({ event }: { event: CorporateEvent }) {
  return (
    <span className={`events-audience-badge${event.isCompanyWide ? ' is-company' : ''}`}>
      {event.isCompanyWide ? <Users size={12} aria-hidden /> : null}
      {event.audienceLabel}
    </span>
  );
}

export function EventsListPage() {
  const [tab, setTab] = useState<CorporateEventListTab>('upcoming');
  const [items, setItems] = useState<CorporateEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchEvents({ tab });
      setItems(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los eventos');
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
        title="Eventos"
        breadcrumbParent="Comunicación"
        breadcrumbCurrent="Eventos"
        breadcrumbParentHref="/eventos"
      />

      <div className="meetings-toolbar card-style mb-30">
        <div className="meetings-tabs" role="tablist" aria-label="Filtrar eventos">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'upcoming'}
            className={`meetings-tabs__btn${tab === 'upcoming' ? ' is-active' : ''}`}
            onClick={() => setTab('upcoming')}
          >
            Próximos
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'past'}
            className={`meetings-tabs__btn${tab === 'past' ? ' is-active' : ''}`}
            onClick={() => setTab('past')}
          >
            Pasados
          </button>
        </div>

        <div className="meetings-toolbar__actions">
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
          <p className="text-gray meetings-empty">Cargando eventos…</p>
        ) : items.length === 0 ? (
          <div className="meetings-empty">
            <Calendar size={32} strokeWidth={1.5} aria-hidden />
            <p>
              {tab === 'upcoming'
                ? 'No hay eventos próximos para su área.'
                : 'No hay eventos pasados registrados.'}
            </p>
          </div>
        ) : (
          <ul className="meetings-list">
            {items.map((event) => (
              <li key={event.id} className="meetings-list__item">
                <Link to={`/eventos/${event.id}`} className="meetings-list__link">
                  <div className="meetings-list__main">
                    <h3 className="meetings-list__title">{event.title}</h3>
                    <p className="meetings-list__datetime">
                      <Calendar size={14} aria-hidden />
                      {formatDateTime(event.startDateTime)}
                      {' — '}
                      {formatDateTime(event.endDateTime)}
                    </p>
                    {event.location ? (
                      <p className="meetings-list__organizer">
                        <MapPin size={14} aria-hidden />
                        {event.location}
                      </p>
                    ) : null}
                  </div>
                  <div className="meetings-list__meta">
                    <AudienceBadge event={event} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
