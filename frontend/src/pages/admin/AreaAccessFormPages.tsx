import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { createAreaAccess, fetchAreaAccess, updateAreaAccess } from '../../api/area-access';
import { fetchAreas } from '../../api/areas';
import type { Area } from '../../api/areas.types';
import { AreaAccessForm, type AreaAccessFormValues } from '../../components/admin/AreaAccessForm';
import { AdminGovernanceBanner } from '../../components/admin/AdminGovernanceBanner';
import { PageHeader } from '../../components/layout';

function toPayload(values: AreaAccessFormValues) {
  return {
    sourceAreaId: Number.parseInt(values.sourceAreaId, 10),
    targetAreaId: Number.parseInt(values.targetAreaId, 10),
    canRead: values.canRead,
    canUpload: values.canUpload,
    canApprove: values.canApprove,
    canAnnounce: values.canAnnounce,
    isActive: values.isActive,
  };
}

function useAreasCatalog() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetchAreas({ isActive: true });
        setAreas(res.items);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { areas, loading };
}

export function AreaAccessCreatePage() {
  const navigate = useNavigate();
  const { areas, loading: areasLoading } = useAreasCatalog();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (values: AreaAccessFormValues) => {
    setLoading(true);
    setError('');
    try {
      await createAreaAccess(toPayload(values));
      navigate('/admin/area-access');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la excepción');
    } finally {
      setLoading(false);
    }
  };

  if (areasLoading) {
    return <p className="text-gray">Cargando áreas…</p>;
  }

  return (
    <>
      <PageHeader
        title="Nueva excepción"
        breadcrumbParent="Acceso entre áreas"
        breadcrumbCurrent="Alta"
        breadcrumbParentHref="/admin/area-access"
      />
      {error && <div className="admin-alert admin-alert--error mb-20">{error}</div>}
      <AdminGovernanceBanner title="Acceso entre áreas" variant="support-ti">
        <p>
          Define qué puede hacer un área sobre los <strong>documentos</strong> de otra unidad
          (lectura, carga, aprobación o comunicados).
        </p>
      </AdminGovernanceBanner>
      <div className="learning-manage-form card-style">
        <AreaAccessForm
          areas={areas}
          submitLabel="Crear excepción"
          loading={loading}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/admin/area-access')}
        />
      </div>
    </>
  );
}

export function AreaAccessEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { areas, loading: areasLoading } = useAreasCatalog();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [initialValues, setInitialValues] = useState<Partial<AreaAccessFormValues>>();
  const grantId = Number.parseInt(id ?? '', 10);

  useEffect(() => {
    if (Number.isNaN(grantId)) {
      setError('Identificador inválido');
      setFetching(false);
      return;
    }
    void (async () => {
      try {
        const res = await fetchAreaAccess(grantId);
        const g = res.item;
        setInitialValues({
          sourceAreaId: String(g.sourceAreaId),
          targetAreaId: String(g.targetAreaId),
          canRead: g.canRead,
          canUpload: g.canUpload,
          canApprove: g.canApprove,
          canAnnounce: g.canAnnounce,
          isActive: g.isActive,
        });
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar la excepción');
      } finally {
        setFetching(false);
      }
    })();
  }, [grantId]);

  const handleSubmit = async (values: AreaAccessFormValues) => {
    setLoading(true);
    setError('');
    try {
      await updateAreaAccess(grantId, toPayload(values));
      navigate('/admin/area-access');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar la excepción');
    } finally {
      setLoading(false);
    }
  };

  if (fetching || areasLoading) {
    return <p className="text-gray">Cargando…</p>;
  }

  if (error && !initialValues) {
    return <div className="admin-alert admin-alert--error">{error}</div>;
  }

  return (
    <>
      <PageHeader
        title="Editar excepción"
        breadcrumbParent="Acceso entre áreas"
        breadcrumbCurrent="Edición"
        breadcrumbParentHref="/admin/area-access"
      />
      {error && <div className="admin-alert admin-alert--error mb-20">{error}</div>}
      <AdminGovernanceBanner title="Acceso entre áreas" variant="support-ti">
        <p>
          Define qué puede hacer un área sobre los <strong>documentos</strong> de otra unidad
          (lectura, carga, aprobación o comunicados).
        </p>
      </AdminGovernanceBanner>
      {initialValues && (
        <div className="learning-manage-form card-style">
          <AreaAccessForm
            areas={areas}
            initialValues={initialValues}
            submitLabel="Guardar cambios"
            loading={loading}
            onSubmit={handleSubmit}
            onCancel={() => navigate('/admin/area-access')}
          />
        </div>
      )}
    </>
  );
}
