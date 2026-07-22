import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { createArea, fetchArea, updateArea } from '../../api/areas';
import type { AreaLeader } from '../../api/areas.types';
import { AreaForm, type AreaFormValues } from '../../components/admin/AreaForm';
import { PageHeader } from '../../components/layout';

function toPayload(values: AreaFormValues) {
  return {
    name: values.name.trim(),
    description: values.description.trim() || null,
    parentAreaId: values.parentAreaId ? Number.parseInt(values.parentAreaId, 10) : null,
    isActive: values.isActive,
    isItSupportArea: values.isItSupportArea,
    leaderIds: values.leaderIds,
  };
}

export function AreaCreatePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (values: AreaFormValues) => {
    setLoading(true);
    setError('');
    try {
      await createArea(toPayload(values));
      navigate('/admin/areas');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el área');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Nuevo área"
        breadcrumbParent="Áreas"
        breadcrumbCurrent="Alta"
        breadcrumbParentHref="/admin/areas"
      />
      {error && <div className="admin-alert admin-alert--error mb-20">{error}</div>}
      <AreaForm
        submitLabel="Crear área"
        loading={loading}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/admin/areas')}
      />
    </>
  );
}

export function AreaEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [initialValues, setInitialValues] = useState<Partial<AreaFormValues>>();
  const [initialLeaders, setInitialLeaders] = useState<AreaLeader[]>([]);
  const areaId = Number.parseInt(id ?? '', 10);

  useEffect(() => {
    if (Number.isNaN(areaId)) {
      setError('Identificador inválido');
      setFetching(false);
      return;
    }
    void (async () => {
      try {
        const res = await fetchArea(areaId);
        const a = res.area;
        setInitialValues({
          name: a.name,
          description: a.description ?? '',
          parentAreaId: a.parentAreaId != null ? String(a.parentAreaId) : '',
          isActive: a.isActive,
          isItSupportArea: a.isItSupportArea,
          leaderIds: a.leaders.map((l) => l.id),
        });
        setInitialLeaders(a.leaders);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar el área');
      } finally {
        setFetching(false);
      }
    })();
  }, [areaId]);

  const handleSubmit = async (values: AreaFormValues) => {
    setLoading(true);
    setError('');
    try {
      await updateArea(areaId, toPayload(values));
      navigate('/admin/areas');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar el área');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return <p className="text-gray">Cargando…</p>;
  }

  if (!initialValues) {
    return (
      <>
        <div className="admin-alert admin-alert--error mb-20">{error || 'Área no encontrada'}</div>
        <Link to="/admin/areas" className="admin-btn admin-btn--ghost">
          Volver al listado
        </Link>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Editar área"
        breadcrumbParent="Áreas"
        breadcrumbCurrent="Edición"
        breadcrumbParentHref="/admin/areas"
      />
      {error && <div className="admin-alert admin-alert--error mb-20">{error}</div>}
      <AreaForm
        initialValues={initialValues}
        initialLeaders={initialLeaders}
        excludeAreaId={areaId}
        submitLabel="Guardar cambios"
        loading={loading}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/admin/areas')}
      />
    </>
  );
}
