import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import {
  createLearningCourse,
  fetchManageLearningCourse,
  updateLearningCourse,
  uploadLearningCover,
} from '../../api/learning';
import type { LearningUserOption } from '../../api/learning.types';
import { AccessScopeEditor } from '../../components/learning/AccessScopeEditor';
import { LearningManageSubnav } from '../../components/learning/LearningManageSubnav';
import { PageHeader } from '../../components/layout';
import { fetchDirectory } from '../../api/directory';

export function LearningCourseFormPage() {
  const { courseId: idParam } = useParams();
  const { pathname } = useLocation();
  const isNew = pathname.endsWith('/nuevo');
  const courseId = Number(idParam);
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [areaIds, setAreaIds] = useState<number[]>([]);
  const [exceptionUserIds, setExceptionUserIds] = useState<number[]>([]);
  const [exceptionUsers, setExceptionUsers] = useState<LearningUserOption[]>([]);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isNew) return;
    if (!Number.isInteger(courseId) || courseId <= 0) return;
    void (async () => {
      setLoading(true);
      try {
        const data = await fetchManageLearningCourse(courseId);
        setTitle(data.course.title);
        setDescription(data.course.description ?? '');
        setIsPublished(data.course.isPublished);
        setAreaIds(data.course.areaIds);
        setExceptionUserIds(data.course.exceptionUserIds);
        setCode(data.course.code);

        if (data.course.exceptionUserIds.length) {
          const dir = await fetchDirectory({ name: '' });
          const users = dir.items
            .filter((u) => data.course.exceptionUserIds.includes(u.id))
            .map((u) => ({
              id: u.id,
              fullName: u.fullName,
              email: u.email,
              areaName: u.areaName,
            }));
          setExceptionUsers(users);
        }
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Error al cargar');
      } finally {
        setLoading(false);
      }
    })();
  }, [isNew, courseId]);

  const save = async () => {
    if (!title.trim()) {
      setError('El título es obligatorio');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const body = {
        title: title.trim(),
        description: description.trim() || null,
        isPublished,
        areaIds,
        exceptionUserIds,
      };
      if (isNew) {
        const created = await createLearningCourse(body);
        navigate(`/learning/gestion/${created.course.id}`);
      } else {
        await updateLearningCourse(courseId, body);
        navigate(`/learning/gestion/${courseId}`);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  const onCover = async (file: File) => {
    if (isNew) return;
    try {
      await uploadLearningCover(courseId, file);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al subir portada');
    }
  };

  return (
    <>
      <PageHeader
        title={isNew ? 'Nuevo curso' : `Editar ${code}`}
        breadcrumbParent="Gestión de cursos"
        breadcrumbCurrent={isNew ? 'Nuevo' : code}
        breadcrumbParentHref="/learning/gestion"
      />

      {!isNew && Number.isInteger(courseId) && courseId > 0 ? (
        <LearningManageSubnav courseId={courseId} />
      ) : (
        <Link to="/learning/gestion" className="learning-manage-subnav__link mb-3">
          ← Listado
        </Link>
      )}

      {error ? <div className="admin-alert admin-alert--error mb-20">{error}</div> : null}
      {loading ? <p className="text-gray learning-manage-empty">Cargando…</p> : null}

      {!loading && (
        <div className="learning-manage-form card-style">
          <div className="mb-3">
            <label className="form-label">Título</label>
            <input
              className="form-control"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="mb-3">
            <label className="form-label">Descripción</label>
            <textarea
              className="form-control"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="form-check mb-3">
            <input
              type="checkbox"
              className="form-check-input"
              id="published"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
            />
            <label className="form-check-label" htmlFor="published">
              Publicado (visible en catálogo para usuarios con acceso)
            </label>
          </div>

          <AccessScopeEditor
            areaIds={areaIds}
            exceptionUserIds={exceptionUserIds}
            exceptionUsers={exceptionUsers}
            onChange={(a, u, users) => {
              setAreaIds(a);
              setExceptionUserIds(u);
              setExceptionUsers(users);
            }}
          />

          {!isNew ? (
            <div className="mt-3">
              <label className="form-label">Portada</label>
              <input
                type="file"
                accept="image/*"
                className="form-control"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onCover(f);
                }}
              />
            </div>
          ) : null}

          <div className="mt-4 d-flex flex-wrap gap-2">
            <button
              type="button"
              className="admin-btn admin-btn--primary"
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            {!isNew ? (
              <Link to={`/learning/gestion/${courseId}`} className="admin-btn admin-btn--ghost">
                Estructura y lecciones
              </Link>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
