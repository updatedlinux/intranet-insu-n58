import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import {
  createTicketCategory,
  fetchTicketCategory,
  updateTicketCategory,
} from '../../api/ticket-categories';
import {
  TicketCategoryForm,
  type TicketCategoryFormValues,
} from '../../components/admin/TicketCategoryForm';
import { PageHeader } from '../../components/layout';

function toPayload(values: TicketCategoryFormValues) {
  return {
    name: values.name.trim(),
    description: values.description.trim() || null,
    sortOrder: Number.parseInt(values.sortOrder, 10) || 0,
    isActive: values.isActive,
  };
}

export function TicketCategoryCreatePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (values: TicketCategoryFormValues) => {
    setLoading(true);
    setError('');
    try {
      await createTicketCategory(toPayload(values));
      navigate('/admin/ticket-categories');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la categoría');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Nueva categoría"
        breadcrumbParent="Categorías Soporte TI"
        breadcrumbCurrent="Alta"
        breadcrumbParentHref="/admin/ticket-categories"
      />
      {error && <div className="admin-alert admin-alert--error mb-20">{error}</div>}
      <TicketCategoryForm
        submitLabel="Crear categoría"
        loading={loading}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/admin/ticket-categories')}
      />
    </>
  );
}

export function TicketCategoryEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [initialValues, setInitialValues] = useState<Partial<TicketCategoryFormValues>>();
  const categoryId = Number.parseInt(id ?? '', 10);

  useEffect(() => {
    if (Number.isNaN(categoryId)) {
      setError('Identificador inválido');
      setFetching(false);
      return;
    }
    void (async () => {
      try {
        const res = await fetchTicketCategory(categoryId);
        const c = res.item;
        setInitialValues({
          name: c.name,
          description: c.description ?? '',
          sortOrder: String(c.sortOrder),
          isActive: c.isActive,
        });
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar la categoría');
      } finally {
        setFetching(false);
      }
    })();
  }, [categoryId]);

  const handleSubmit = async (values: TicketCategoryFormValues) => {
    setLoading(true);
    setError('');
    try {
      await updateTicketCategory(categoryId, toPayload(values));
      navigate('/admin/ticket-categories');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <p className="text-gray">Cargando…</p>;
  if (error && !initialValues) {
    return <div className="admin-alert admin-alert--error">{error}</div>;
  }

  return (
    <>
      <PageHeader
        title="Editar categoría"
        breadcrumbParent="Categorías Soporte TI"
        breadcrumbCurrent="Edición"
        breadcrumbParentHref="/admin/ticket-categories"
      />
      {error && <div className="admin-alert admin-alert--error mb-20">{error}</div>}
      {initialValues && (
        <TicketCategoryForm
          initialValues={initialValues}
          submitLabel="Guardar cambios"
          loading={loading}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/admin/ticket-categories')}
        />
      )}
    </>
  );
}
