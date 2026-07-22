import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { fetchAreas } from '../../api/areas';
import { fetchAnnouncementCapabilities } from '../../api/announcements';
import {
  createAnnouncement,
  fetchAnnouncement,
  publishAnnouncement,
  updateAnnouncement,
} from '../../api/announcements';
import type { AnnouncementFormData } from '../../api/announcements.types';
import {
  AnnouncementForm,
  type AnnouncementFormValues,
} from '../../components/announcements/AnnouncementForm';
import { AnnouncementManageGuard } from '../../components/announcements/AnnouncementManageGuard';
import { PageHeader } from '../../components/layout';
import { useAuth } from '../../context/AuthContext';

function toPayload(values: AnnouncementFormValues): AnnouncementFormData {
  return {
    title: values.title.trim(),
    summary: values.summary.trim(),
    content: values.content,
    imageUrl: values.imageUrl,
    category: values.category,
    targetAreaId: values.targetAreaId ? Number.parseInt(values.targetAreaId, 10) : null,
    publish: values.publishNow,
  };
}

function useAreasCatalog() {
  const [areas, setAreas] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [canTargetCompany, setCanTargetCompany] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [areasRes, caps] = await Promise.all([
          fetchAreas({ isActive: true }),
          fetchAnnouncementCapabilities(),
        ]);
        setCanTargetCompany(caps.canPublishCompanyWide);
        if (caps.publishableAreaIds.length === 0) {
          setAreas(areasRes.items);
        } else {
          const allowed = new Set(caps.publishableAreaIds);
          setAreas(areasRes.items.filter((a) => allowed.has(a.id)));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { areas, loading, canTargetCompany };
}

export function AnnouncementCreatePage() {
  return (
    <AnnouncementManageGuard>
      <CreateContent />
    </AnnouncementManageGuard>
  );
}

function CreateContent() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { areas, loading: areasLoading, canTargetCompany } = useAreasCatalog();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const defaultAreaId = canTargetCompany ? '' : String(user?.area.id ?? '');

  const save = async (values: AnnouncementFormValues) => {
    setLoading(true);
    setError('');
    try {
      await createAnnouncement(toPayload(values));
      navigate('/comunicados/gestion');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar el comunicado');
    } finally {
      setLoading(false);
    }
  };

  if (areasLoading) return <p className="text-gray">Cargando…</p>;

  return (
    <>
      <PageHeader
        title="Nuevo comunicado"
        breadcrumbParent="Gestión"
        breadcrumbCurrent="Alta"
        breadcrumbParentHref="/comunicados/gestion"
      />
      {error && <div className="admin-alert admin-alert--error mb-20">{error}</div>}
      <AnnouncementForm
        areas={areas as import('../../api/areas.types').Area[]}
        canTargetCompany={canTargetCompany}
        initialValues={{ targetAreaId: defaultAreaId, content: '<p></p>' }}
        loading={loading}
        onSaveDraft={save}
        onPublish={save}
        onCancel={() => navigate('/comunicados/gestion')}
      />
    </>
  );
}

export function AnnouncementEditPage() {
  return (
    <AnnouncementManageGuard>
      <EditContent />
    </AnnouncementManageGuard>
  );
}

function EditContent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { areas, loading: areasLoading, canTargetCompany } = useAreasCatalog();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [initialValues, setInitialValues] = useState<Partial<AnnouncementFormValues>>();
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('DRAFT');
  const announcementId = Number.parseInt(id ?? '', 10);

  useEffect(() => {
    if (Number.isNaN(announcementId)) {
      setError('Identificador inválido');
      setFetching(false);
      return;
    }
    void (async () => {
      try {
        const res = await fetchAnnouncement(announcementId);
        const a = res.item;
        setStatus(a.status);
        setInitialValues({
          title: a.title,
          summary: a.summary,
          content: a.content,
          category: a.category,
          targetAreaId: a.targetAreaId != null ? String(a.targetAreaId) : '',
          imageUrl: a.imageKey ?? null,
          publishNow: false,
        });
        setImagePreviewUrl(a.imageUrl);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar el comunicado');
      } finally {
        setFetching(false);
      }
    })();
  }, [announcementId]);

  const saveDraft = async (values: AnnouncementFormValues) => {
    setLoading(true);
    setError('');
    try {
      await updateAnnouncement(announcementId, toPayload({ ...values, publishNow: false }));
      navigate('/comunicados/gestion');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar');
    } finally {
      setLoading(false);
    }
  };

  const saveAndPublish = async (values: AnnouncementFormValues) => {
    setLoading(true);
    setError('');
    try {
      await updateAnnouncement(announcementId, toPayload({ ...values, publishNow: false }));
      if (status !== 'PUBLISHED') {
        await publishAnnouncement(announcementId);
      }
      navigate('/comunicados/gestion');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo publicar');
    } finally {
      setLoading(false);
    }
  };

  if (fetching || areasLoading) return <p className="text-gray">Cargando…</p>;
  if (error && !initialValues) return <div className="admin-alert admin-alert--error">{error}</div>;

  return (
    <>
      <PageHeader
        title="Editar comunicado"
        breadcrumbParent="Gestión"
        breadcrumbCurrent="Edición"
        breadcrumbParentHref="/comunicados/gestion"
      />
      {error && <div className="admin-alert admin-alert--error mb-20">{error}</div>}
      {initialValues && (
        <AnnouncementForm
          areas={areas as import('../../api/areas.types').Area[]}
          canTargetCompany={canTargetCompany}
          initialValues={initialValues}
          initialImagePreviewUrl={imagePreviewUrl}
          loading={loading}
          onSaveDraft={saveDraft}
          onPublish={saveAndPublish}
          onCancel={() => navigate('/comunicados/gestion')}
          showPublishButton={status !== 'ARCHIVED'}
        />
      )}
    </>
  );
}
