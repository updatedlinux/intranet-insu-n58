import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ReactPlayer from 'react-player';
import { ApiError } from '../../api/client';
import {
  completeLearningLesson,
  fetchMyLearningCourse,
  learningCertificateUrl,
  learningStreamUrl,
} from '../../api/learning';
import type { LearningLessonItem, LearningModuleItem } from '../../api/learning.types';
import { PageHeader } from '../../components/layout';

function flatLessons(modules: LearningModuleItem[]): LearningLessonItem[] {
  return modules.flatMap((m) => m.lessons);
}

export function LearningCoursePage() {
  const { courseId: courseIdParam } = useParams();
  const courseId = Number(courseIdParam);
  const [modules, setModules] = useState<LearningModuleItem[]>([]);
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [completedIds, setCompletedIds] = useState<Set<number>>(new Set());
  const [activeLessonId, setActiveLessonId] = useState<number | null>(null);
  const [percent, setPercent] = useState(0);
  const [status, setStatus] = useState('NEW');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [completing, setCompleting] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isInteger(courseId) || courseId <= 0) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchMyLearningCourse(courseId);
      setTitle(data.course.title);
      setCode(data.course.code);
      setModules(data.modules);
      setCompletedIds(new Set(data.completedLessonIds));
      setPercent(data.progress.percent);
      setStatus(data.progress.status);
      const flat = flatLessons(data.modules);
      setActiveLessonId((prev) => prev ?? flat[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar el curso');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const lessons = useMemo(() => flatLessons(modules), [modules]);
  const activeLesson = lessons.find((l) => l.id === activeLessonId) ?? lessons[0] ?? null;
  const streamUrl = activeLesson ? learningStreamUrl(activeLesson.id) : '';

  const goNext = () => {
    const idx = lessons.findIndex((l) => l.id === activeLesson?.id);
    if (idx >= 0 && idx < lessons.length - 1) {
      setActiveLessonId(lessons[idx + 1]!.id);
    }
  };

  const handleComplete = async () => {
    if (!activeLesson) return;
    setCompleting(true);
    try {
      const res = await completeLearningLesson(activeLesson.id);
      setCompletedIds((prev) => new Set([...prev, activeLesson.id]));
      setPercent(res.progress.percent);
      setStatus(res.progress.status);
      goNext();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo marcar la lección');
    } finally {
      setCompleting(false);
    }
  };

  const renderContent = () => {
    if (!activeLesson) {
      return <p className="text-muted">Este curso no tiene lecciones aún.</p>;
    }

    const type = activeLesson.contentType;

    if (type === 'VIDEO') {
      return (
        <div className="learning-content__player">
          <ReactPlayer url={streamUrl} controls width="100%" height="100%" />
        </div>
      );
    }

    if (type === 'PDF' || type === 'DOCUMENT') {
      return (
        <iframe
          title={activeLesson.title}
          src={streamUrl}
          className="w-100"
          style={{ minHeight: '65vh', border: 'none' }}
        />
      );
    }

    if (type === 'IMAGE') {
      return (
        <div className="learning-content__player" style={{ background: '#f1f5f9' }}>
          <img src={streamUrl} alt={activeLesson.title} />
        </div>
      );
    }

    return (
      <a href={streamUrl} className="btn btn-primary" target="_blank" rel="noreferrer">
        Descargar archivo
      </a>
    );
  };

  return (
    <>
      <PageHeader
        title={title || 'Curso'}
        breadcrumbParent="N58 Learning"
        breadcrumbCurrent={code || 'Curso'}
        breadcrumbParentHref="/learning"
      />

      <Link to="/learning" className="btn btn-link btn-sm mb-2 ps-0">
        ← Volver al catálogo
      </Link>

      {error ? <div className="alert alert-danger">{error}</div> : null}
      {loading ? <p className="text-muted">Cargando…</p> : null}

      {!loading && (
        <>
          <div className="d-flex align-items-center gap-2 mb-3">
            <div className="learning-progress flex-grow-1" style={{ maxWidth: 280 }}>
              <div className="learning-progress__bar" style={{ width: `${percent}%` }} />
            </div>
            <span className="small text-muted">{percent}% completado</span>
            {status === 'COMPLETED' ? (
              <a
                href={learningCertificateUrl(courseId)}
                className="btn btn-success btn-sm ms-auto"
                download
              >
                Descargar constancia
              </a>
            ) : null}
          </div>

          <div className="learning-viewer">
            <aside className="learning-sidebar">
              {modules.map((mod) => (
                <div key={mod.id} className="learning-sidebar__module">
                  <div className="learning-sidebar__module-title">{mod.title}</div>
                  {mod.lessons.map((lesson) => (
                    <button
                      key={lesson.id}
                      type="button"
                      className={`learning-sidebar__lesson ${
                        lesson.id === activeLesson?.id ? 'learning-sidebar__lesson--active' : ''
                      } ${completedIds.has(lesson.id) ? 'learning-sidebar__lesson--done' : ''}`}
                      onClick={() => setActiveLessonId(lesson.id)}
                    >
                      {lesson.title}
                    </button>
                  ))}
                </div>
              ))}
            </aside>

            <section className="learning-content">
              {activeLesson ? (
                <>
                  <h2 className="h5 mb-3">{activeLesson.title}</h2>
                  {activeLesson.description ? (
                    <p className="text-muted">{activeLesson.description}</p>
                  ) : null}
                  {renderContent()}
                  <div className="mt-3 pt-3 border-top">
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={completing || completedIds.has(activeLesson.id)}
                      onClick={() => void handleComplete()}
                    >
                      {completedIds.has(activeLesson.id)
                        ? 'Completada'
                        : 'Marcar como completada y siguiente'}
                    </button>
                  </div>
                </>
              ) : null}
            </section>
          </div>
        </>
      )}
    </>
  );
}
