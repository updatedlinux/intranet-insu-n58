import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, MapPin, Users } from 'lucide-react';
import { ApiError } from '../../api/client';
import { fetchEvent } from '../../api/events';
import type { CorporateEvent } from '../../api/events.types';
import { PageHeader } from '../../components/layout';
import { formatDateTime } from '../../utils/relative-time';

export function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const eventId = Number.parseInt(id ?? '', 10);

  const [item, setItem] = useState<CorporateEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (Number.isNaN(eventId)) {
      setError('Evento inválido');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetchEvent(eventId);
      setItem(res.item);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar el evento');
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        title={item?.title ?? 'Evento'}
        breadcrumbParent="Eventos"
        breadcrumbCurrent="Detalle"
        breadcrumbParentHref="/eventos"
      />

      <div className="mb-20">
        <Link to="/eventos" className="admin-btn admin-btn--ghost">
          <ArrowLeft size={16} aria-hidden />
          Volver al listado
        </Link>
      </div>

      {error && <div className="admin-alert admin-alert--error mb-20">{error}</div>}

      {loading ? (
        <p className="text-gray">Cargando…</p>
      ) : item ? (
        <article className="card-style mb-30">
          <h2 className="text-medium mb-20">{item.title}</h2>

          <div className="events-detail__meta">
            <div className="events-detail__meta-item">
              <Calendar size={18} aria-hidden />
              <div>
                <strong>Inicio:</strong> {formatDateTime(item.startDateTime)}
                <br />
                <strong>Fin:</strong> {formatDateTime(item.endDateTime)}
              </div>
            </div>
            {item.location ? (
              <div className="events-detail__meta-item">
                <MapPin size={18} aria-hidden />
                <div>{item.location}</div>
              </div>
            ) : null}
            <div className="events-detail__meta-item">
              <Users size={18} aria-hidden />
              <div>{item.audienceLabel}</div>
            </div>
          </div>

          {item.description ? (
            <div className="events-detail__description text-gray">{item.description}</div>
          ) : (
            <p className="text-gray mb-0">Sin descripción adicional.</p>
          )}
        </article>
      ) : null}
    </>
  );
}
