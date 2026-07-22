import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import {
  createChatException,
  fetchChatException,
  updateChatException,
} from '../../api/chat-exceptions';
import { fetchAreas } from '../../api/areas';
import { fetchCollaborators } from '../../api/collaborators';
import type { Area } from '../../api/areas.types';
import type { Collaborator } from '../../api/collaborators.types';
import {
  ChatExceptionForm,
  type ChatExceptionFormValues,
} from '../../components/admin/ChatExceptionForm';
import { AdminGovernanceBanner } from '../../components/admin/AdminGovernanceBanner';
import { PageHeader } from '../../components/layout';

function toPayload(values: ChatExceptionFormValues) {
  return {
    userId: Number.parseInt(values.userId, 10),
    areaId: Number.parseInt(values.areaId, 10),
    notes: values.notes.trim() || null,
    isActive: values.isActive,
  };
}

export function ChatExceptionCreatePage() {
  const navigate = useNavigate();
  const [areas, setAreas] = useState<Area[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const [areasRes, collabRes] = await Promise.all([
          fetchAreas(),
          fetchCollaborators({ isActive: true, pageSize: 500 }),
        ]);
        setAreas(areasRes.items);
        setCollaborators(collabRes.items);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los catálogos');
      } finally {
        setFetching(false);
      }
    })();
  }, []);

  const handleSubmit = async (values: ChatExceptionFormValues) => {
    setLoading(true);
    setError('');
    try {
      await createChatException(toPayload(values));
      navigate('/admin/chat-exceptions');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la excepción');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return <p className="text-gray">Cargando…</p>;
  }

  return (
    <>
      <PageHeader
        title="Nueva excepción de chat"
        breadcrumbParent="Excepciones de chat"
        breadcrumbCurrent="Alta"
        breadcrumbParentHref="/admin/chat-exceptions"
      />
      {error ? <div className="admin-alert admin-alert--error mb-20">{error}</div> : null}
      <AdminGovernanceBanner title="Acceso a chats grupales" variant="support-ti">
        <p>
          El colaborador verá y podrá escribir en el chat grupal de la unidad seleccionada, además
          del chat de su propia área.
        </p>
      </AdminGovernanceBanner>
      <div className="learning-manage-form card-style">
        <ChatExceptionForm
          areas={areas}
          collaborators={collaborators}
          submitLabel="Crear excepción"
          loading={loading}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/admin/chat-exceptions')}
        />
      </div>
    </>
  );
}

export function ChatExceptionEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [areas, setAreas] = useState<Area[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [initialValues, setInitialValues] = useState<Partial<ChatExceptionFormValues>>();
  const grantId = Number.parseInt(id ?? '', 10);

  useEffect(() => {
    if (Number.isNaN(grantId)) {
      setError('Identificador inválido');
      setFetching(false);
      return;
    }
    void (async () => {
      try {
        const [areasRes, collabRes, grantRes] = await Promise.all([
          fetchAreas(),
          fetchCollaborators({ isActive: true, pageSize: 500 }),
          fetchChatException(grantId),
        ]);
        setAreas(areasRes.items);
        setCollaborators(collabRes.items);
        const g = grantRes.item;
        setInitialValues({
          userId: String(g.userId),
          areaId: String(g.areaId),
          notes: g.notes ?? '',
          isActive: g.isActive,
        });
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar la excepción');
      } finally {
        setFetching(false);
      }
    })();
  }, [grantId]);

  const handleSubmit = async (values: ChatExceptionFormValues) => {
    setLoading(true);
    setError('');
    try {
      await updateChatException(grantId, toPayload(values));
      navigate('/admin/chat-exceptions');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar la excepción');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return <p className="text-gray">Cargando…</p>;
  }

  if (error && !initialValues) {
    return <div className="admin-alert admin-alert--error">{error}</div>;
  }

  return (
    <>
      <PageHeader
        title="Editar excepción de chat"
        breadcrumbParent="Excepciones de chat"
        breadcrumbCurrent="Editar"
        breadcrumbParentHref="/admin/chat-exceptions"
      />
      {error ? <div className="admin-alert admin-alert--error mb-20">{error}</div> : null}
      <AdminGovernanceBanner title="Acceso a chats grupales" variant="support-ti">
        <p>
          El colaborador verá y podrá escribir en el chat grupal de la unidad seleccionada, además
          del chat de su propia área.
        </p>
      </AdminGovernanceBanner>
      <div className="learning-manage-form card-style">
        <ChatExceptionForm
          areas={areas}
          collaborators={collaborators}
          initialValues={initialValues}
          submitLabel="Guardar cambios"
          loading={loading}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/admin/chat-exceptions')}
        />
      </div>
    </>
  );
}
