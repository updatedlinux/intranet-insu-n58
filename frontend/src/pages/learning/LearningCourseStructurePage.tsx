import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { ApiError } from '../../api/client';
import {
  createLearningModule,
  deleteLearningLesson,
  deleteLearningModule,
  fetchManageLearningCourse,
} from '../../api/learning';
import { LearningManageSubnav } from '../../components/learning/LearningManageSubnav';
import { ModuleLessonDropzone } from '../../components/learning/ModuleLessonDropzone';
import { PageHeader } from '../../components/layout';

export function LearningCourseStructurePage() {
  const courseId = Number(useParams().courseId);
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [modules, setModules] = useState<
    {
      id: number;
      title: string;
      order: number;
      lessons: { id: number; title: string; contentType: string; fileName: string | null }[];
    }[]
  >([]);
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchManageLearningCourse(courseId);
      setTitle(data.course.title);
      setCode(data.course.code);
      setModules(data.modules);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const addModule = async () => {
    if (!newModuleTitle.trim()) return;
    try {
      await createLearningModule(courseId, { title: newModuleTitle.trim() });
      setNewModuleTitle('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el módulo');
    }
  };

  const removeModule = async (moduleId: number) => {
    if (!confirm('¿Eliminar módulo y todas sus lecciones?')) return;
    try {
      await deleteLearningModule(moduleId);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar');
    }
  };

  const removeLesson = async (lessonId: number) => {
    if (!confirm('¿Eliminar esta lección?')) return;
    try {
      await deleteLearningLesson(lessonId);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar');
    }
  };

  return (
    <>
      <PageHeader
        title={title || 'Contenido del curso'}
        breadcrumbParent={code || 'Curso'}
        breadcrumbCurrent="Contenido"
        breadcrumbParentHref={`/learning/gestion/${courseId}/editar`}
      />

      <LearningManageSubnav courseId={courseId} />

      {error ? <div className="admin-alert admin-alert--error mb-20">{error}</div> : null}
      {loading ? <p className="text-gray learning-manage-empty">Cargando…</p> : null}

      {!loading && (
        <>
          <div className="learning-manage-toolbar card-style mb-30">
            <input
              className="form-control"
              style={{ maxWidth: 320 }}
              placeholder="Nombre del nuevo módulo"
              value={newModuleTitle}
              onChange={(e) => setNewModuleTitle(e.target.value)}
            />
            <button
              type="button"
              className="admin-btn admin-btn--primary"
              onClick={() => void addModule()}
            >
              <Plus size={16} aria-hidden />
              Agregar módulo
            </button>
          </div>

          {modules.map((mod) => (
            <article key={mod.id} className="learning-manage-module card-style">
              <div className="learning-manage-module__header">
                <strong>{mod.title}</strong>
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost admin-btn--sm"
                  onClick={() => void removeModule(mod.id)}
                  aria-label="Eliminar módulo"
                >
                  <Trash2 size={14} aria-hidden />
                </button>
              </div>
              <div className="learning-manage-module__body">
                <ModuleLessonDropzone moduleId={mod.id} onUploaded={() => void load()} />
                <ul className="learning-manage-list mt-3">
                  {mod.lessons.map((l) => (
                    <li key={l.id} className="learning-manage-list__item">
                      <div className="learning-manage-list__row py-3">
                        <div className="learning-manage-list__main">
                          <span className="learning-manage-list__title" style={{ margin: 0 }}>
                            {l.title}
                          </span>
                          <p className="learning-manage-list__meta">
                            <span className="learning-manage-badge learning-manage-badge--draft">
                              {l.contentType}
                            </span>
                            {l.fileName ? ` · ${l.fileName}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="admin-btn admin-btn--ghost admin-btn--sm"
                          onClick={() => void removeLesson(l.id)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </li>
                  ))}
                  {!mod.lessons.length ? (
                    <li className="learning-manage-list__item">
                      <p className="learning-manage-empty py-4 mb-0">
                        Sin lecciones — arrastre archivos arriba
                      </p>
                    </li>
                  ) : null}
                </ul>
              </div>
            </article>
          ))}

          {!modules.length ? (
            <div className="card-style">
              <div className="learning-manage-empty">
                <p className="mb-0">Agregue un módulo para comenzar a subir contenido.</p>
              </div>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
