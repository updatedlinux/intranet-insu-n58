import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { fetchAreas } from '../../api/areas';
import { createEvent, fetchEventManage, publishEvent, updateEvent } from '../../api/events';
import type { CorporateEventFormData } from '../../api/events.types';
import {
  CorporateEventForm,
  type CorporateEventFormValues,
} from '../../components/events/CorporateEventForm';
import { PageHeader } from '../../components/layout';

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
  start.setHours(start.getHours() + 24);
  const end = new Date(start);
  end.setHours(end.getHours() + 2);
  return {
    start: toDatetimeLocalValue(start.toISOString()),
    end: toDatetimeLocalValue(end.toISOString()),
  };
}

function toPayload(values: CorporateEventFormValues): CorporateEventFormData {
  return {
    title: values.title,
    description: values.description.trim() || null,
    location: values.location.trim() || null,
    startDateTime: fromDatetimeLocalValue(values.startDateTime),
    endDateTime: fromDatetimeLocalValue(values.endDateTime),
    isCompanyWide: values.isCompanyWide,
    areaIds: values.areaIds,
  };
}

function useAreasCatalog() {
  const [areas, setAreas] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchAreas({ isActive: true })
      .then((res) => setAreas(res.items))
      .finally(() => setLoading(false));
  }, []);

  return { areas, loading };
}

export function EventCreatePage() {
  const navigate = useNavigate();
  const { areas, loading: areasLoading } = useAreasCatalog();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const defaults = defaultStartEnd();

  const save = async (values: CorporateEventFormValues, andPublish: boolean) => {
    setLoading(true);
    setError('');
    try {
      const res = await createEvent(toPayload(values));
      if (andPublish) {
        await publishEvent(res.item.id);
      }
      navigate('/admin/eventos');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el evento');
    } finally {
      setLoading(false);
    }
  };

  if (areasLoading) return <p className="text-gray">Cargando…</p>;

  return (
    <>
      <PageHeader
        title="Nuevo evento"
        breadcrumbParent="Comunicación"
        breadcrumbCurrent="Nuevo evento"
        breadcrumbParentHref="/comunicados"
      />
      {error && <div className="admin-alert admin-alert--error mb-20">{error}</div>}
      <CorporateEventForm
        areas={areas as import('../../api/areas.types').Area[]}
        initialValues={{
          startDateTime: defaults.start,
          endDateTime: defaults.end,
        }}
        loading={loading}
        submitLabel="Guardar borrador"
        onSubmit={(values) => save(values, false)}
        onPublish={(values) => save(values, true)}
        onCancel={() => navigate('/admin/eventos')}
      />
    </>
  );
}

export function EventEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const eventId = Number.parseInt(id ?? '', 10);
  const { areas, loading: areasLoading } = useAreasCatalog();
  const [initial, setInitial] = useState<CorporateEventFormValues | null>(null);
  const [status, setStatus] = useState<string>('DRAFT');
  const [fetching, setFetching] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (Number.isNaN(eventId)) {
      setError('Identificador inválido');
      setFetching(false);
      return;
    }
    void fetchEventManage(eventId)
      .then((res) => {
        const e = res.item;
        setStatus(e.status);
        setInitial({
          title: e.title,
          description: e.description ?? '',
          location: e.location ?? '',
          startDateTime: toDatetimeLocalValue(e.startDateTime),
          endDateTime: toDatetimeLocalValue(e.endDateTime),
          isCompanyWide: e.isCompanyWide,
          areaIds: e.areaIds,
        });
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar el evento');
      })
      .finally(() => setFetching(false));
  }, [eventId]);

  const save = async (values: CorporateEventFormValues, andPublish: boolean) => {
    setLoading(true);
    setError('');
    try {
      await updateEvent(eventId, toPayload(values));
      if (andPublish && status !== 'PUBLISHED') {
        await publishEvent(eventId);
      }
      navigate('/admin/eventos');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el evento');
    } finally {
      setLoading(false);
    }
  };

  if (areasLoading || fetching) return <p className="text-gray">Cargando…</p>;
  if (!initial) {
    return error ? <div className="admin-alert admin-alert--error">{error}</div> : null;
  }

  const readOnly = status === 'CANCELLED';

  return (
    <>
      <PageHeader
        title="Editar evento"
        breadcrumbParent="Comunicación"
        breadcrumbCurrent="Editar evento"
        breadcrumbParentHref="/comunicados"
      />
      {error && <div className="admin-alert admin-alert--error mb-20">{error}</div>}
      {readOnly ? (
        <div className="admin-alert admin-alert--warning mb-20">
          Este evento está cancelado y no puede editarse.
        </div>
      ) : null}
      <CorporateEventForm
        areas={areas as import('../../api/areas.types').Area[]}
        initialValues={initial}
        loading={loading || readOnly}
        submitLabel="Guardar cambios"
        onSubmit={(values) => save(values, false)}
        onPublish={!readOnly && status === 'DRAFT' ? (values) => save(values, true) : undefined}
        onCancel={() => navigate('/admin/eventos')}
      />
    </>
  );
}
