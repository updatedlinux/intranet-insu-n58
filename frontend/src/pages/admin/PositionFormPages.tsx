import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { createPosition, fetchPosition, updatePosition } from '../../api/positions';
import { PositionForm, type PositionFormValues } from '../../components/admin/PositionForm';
import { PageHeader } from '../../components/layout';

function toPayload(values: PositionFormValues) {
  return {
    name: values.name.trim(),
    areaId: Number.parseInt(values.areaId, 10),
    isLeader: values.isLeader,
    isActive: values.isActive,
  };
}

export function PositionCreatePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (values: PositionFormValues) => {
    setLoading(true);
    setError('');
    try {
      await createPosition(toPayload(values));
      navigate('/admin/positions');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el cargo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Nuevo cargo"
        breadcrumbParent="Cargos"
        breadcrumbCurrent="Alta"
        breadcrumbParentHref="/admin/positions"
      />
      {error && <div className="admin-alert admin-alert--error mb-20">{error}</div>}
      <PositionForm
        submitLabel="Crear cargo"
        loading={loading}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/admin/positions')}
      />
    </>
  );
}

export function PositionEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [initialValues, setInitialValues] = useState<Partial<PositionFormValues>>();
  const [collaboratorCount, setCollaboratorCount] = useState(0);
  const positionId = Number.parseInt(id ?? '', 10);

  useEffect(() => {
    if (Number.isNaN(positionId)) {
      setError('Identificador inválido');
      setFetching(false);
      return;
    }
    void (async () => {
      try {
        const res = await fetchPosition(positionId);
        const p = res.position;
        setInitialValues({
          name: p.name,
          areaId: String(p.areaId),
          isLeader: p.isLeader,
          isActive: p.isActive,
        });
        setCollaboratorCount(p.collaboratorCount);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar el cargo');
      } finally {
        setFetching(false);
      }
    })();
  }, [positionId]);

  const handleSubmit = async (values: PositionFormValues) => {
    setLoading(true);
    setError('');
    try {
      await updatePosition(positionId, toPayload(values));
      navigate('/admin/positions');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar el cargo');
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
        <div className="admin-alert admin-alert--error mb-20">{error || 'Cargo no encontrado'}</div>
        <Link to="/admin/positions" className="admin-btn admin-btn--ghost">
          Volver al listado
        </Link>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Editar cargo"
        breadcrumbParent="Cargos"
        breadcrumbCurrent="Edición"
        breadcrumbParentHref="/admin/positions"
      />
      {error && <div className="admin-alert admin-alert--error mb-20">{error}</div>}
      {collaboratorCount > 0 && (
        <div className="admin-alert admin-alert--warning mb-20">
          Este cargo tiene {collaboratorCount} colaborador{collaboratorCount === 1 ? '' : 'es'}{' '}
          asignado{collaboratorCount === 1 ? '' : 's'}. Si cambia el área, también se actualizará el
          área de {collaboratorCount === 1 ? 'ese colaborador' : 'esos colaboradores'}.
        </div>
      )}
      <PositionForm
        initialValues={initialValues}
        submitLabel="Guardar cambios"
        loading={loading}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/admin/positions')}
      />
    </>
  );
}
