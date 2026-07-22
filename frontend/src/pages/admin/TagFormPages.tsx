import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { createTag, fetchTag, updateTag } from '../../api/tags';
import { TagForm, type TagFormValues } from '../../components/admin/TagForm';
import { PageHeader } from '../../components/layout';

function toPayload(values: TagFormValues) {
  return {
    name: values.name.trim(),
    description: values.description.trim() || null,
    isActive: values.isActive,
  };
}

export function TagCreatePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (values: TagFormValues) => {
    setLoading(true);
    setError('');
    try {
      await createTag(toPayload(values));
      navigate('/admin/tags');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la etiqueta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Nueva etiqueta"
        breadcrumbParent="Etiquetas"
        breadcrumbCurrent="Alta"
        breadcrumbParentHref="/admin/tags"
      />
      {error && <div className="admin-alert admin-alert--error mb-20">{error}</div>}
      <TagForm
        submitLabel="Crear etiqueta"
        loading={loading}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/admin/tags')}
      />
    </>
  );
}

export function TagEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [initialValues, setInitialValues] = useState<Partial<TagFormValues>>();
  const tagId = Number.parseInt(id ?? '', 10);

  useEffect(() => {
    if (Number.isNaN(tagId)) {
      setError('Identificador inválido');
      setFetching(false);
      return;
    }
    void (async () => {
      try {
        const res = await fetchTag(tagId);
        const t = res.tag;
        setInitialValues({
          name: t.name,
          description: t.description ?? '',
          isActive: t.isActive,
        });
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar la etiqueta');
      } finally {
        setFetching(false);
      }
    })();
  }, [tagId]);

  const handleSubmit = async (values: TagFormValues) => {
    setLoading(true);
    setError('');
    try {
      await updateTag(tagId, toPayload(values));
      navigate('/admin/tags');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar la etiqueta');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return <p className="text-gray">Cargando etiqueta…</p>;
  }

  if (error && !initialValues) {
    return <div className="admin-alert admin-alert--error">{error}</div>;
  }

  return (
    <>
      <PageHeader
        title="Editar etiqueta"
        breadcrumbParent="Etiquetas"
        breadcrumbCurrent="Edición"
        breadcrumbParentHref="/admin/tags"
      />
      {error && <div className="admin-alert admin-alert--error mb-20">{error}</div>}
      {initialValues && (
        <TagForm
          initialValues={initialValues}
          submitLabel="Guardar cambios"
          loading={loading}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/admin/tags')}
        />
      )}
    </>
  );
}
