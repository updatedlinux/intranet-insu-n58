import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, BookOpen, GraduationCap, Plus, RefreshCw } from 'lucide-react';
import { ApiError } from '../../api/client';
import { fetchManageLearningCourses } from '../../api/learning';
import type { ManageCourseSummary } from '../../api/learning.types';
import { AdminGovernanceBanner } from '../../components/admin/AdminGovernanceBanner';
import { PageHeader } from '../../components/layout';

type CourseFilter = 'all' | 'published' | 'draft';

export function LearningManageListPage() {
  const [items, setItems] = useState<ManageCourseSummary[]>([]);
  const [filter, setFilter] = useState<CourseFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchManageLearningCourses();
      setItems(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === 'published') return items.filter((c) => c.isPublished);
    if (filter === 'draft') return items.filter((c) => !c.isPublished);
    return items;
  }, [items, filter]);

  return (
    <>
      <PageHeader
        title="Gestión Insular Learning"
        breadcrumbParent="Insular Learning"
        breadcrumbCurrent="Gestión de cursos"
        breadcrumbParentHref="/learning"
      />

      <AdminGovernanceBanner title="Gobernanza de cursos" variant="support-ti">
        <p>
          Defina qué <strong>áreas</strong> ven cada curso y agregue <strong>excepciones</strong>{' '}
          por persona. Solo los cursos publicados aparecen en el catálogo del colaborador.
        </p>
      </AdminGovernanceBanner>

      <div className="learning-manage-toolbar card-style mb-30">
        <div className="learning-manage-tabs" role="tablist" aria-label="Filtrar cursos">
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'all'}
            className={`learning-manage-tabs__btn${filter === 'all' ? ' is-active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Todos
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'published'}
            className={`learning-manage-tabs__btn${filter === 'published' ? ' is-active' : ''}`}
            onClick={() => setFilter('published')}
          >
            Publicados
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'draft'}
            className={`learning-manage-tabs__btn${filter === 'draft' ? ' is-active' : ''}`}
            onClick={() => setFilter('draft')}
          >
            Borradores
          </button>
        </div>

        <div className="learning-manage-toolbar__actions">
          <Link to="/learning/gestion/nuevo" className="admin-btn admin-btn--primary">
            <Plus size={16} aria-hidden />
            Nuevo curso
          </Link>
          <button
            type="button"
            className="admin-btn admin-btn--ghost"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw size={16} aria-hidden />
            Actualizar
          </button>
        </div>
      </div>

      {error ? <div className="admin-alert admin-alert--error mb-20">{error}</div> : null}

      <div className="card-style mb-30">
        {loading ? (
          <p className="text-gray learning-manage-empty">Cargando cursos…</p>
        ) : filtered.length === 0 ? (
          <div className="learning-manage-empty">
            <GraduationCap size={32} strokeWidth={1.5} aria-hidden />
            <p>
              {filter === 'all'
                ? 'No hay cursos creados.'
                : filter === 'published'
                  ? 'No hay cursos publicados.'
                  : 'No hay cursos en borrador.'}
            </p>
            {filter === 'all' && (
              <Link to="/learning/gestion/nuevo" className="admin-link">
                Crear el primer curso
              </Link>
            )}
          </div>
        ) : (
          <ul className="learning-manage-list">
            {filtered.map((c) => (
              <li key={c.id} className="learning-manage-list__item">
                <div className="learning-manage-list__row">
                  <div className="learning-manage-list__main">
                    <div className="learning-manage-list__code">{c.code}</div>
                    <h3 className="learning-manage-list__title">{c.title}</h3>
                    <p className="learning-manage-list__meta">
                      {c.totalLessons} lección{c.totalLessons !== 1 ? 'es' : ''} ·{' '}
                      {c.areaIds.length} área{c.areaIds.length !== 1 ? 's' : ''}
                      {c.exceptionUserIds.length > 0
                        ? ` · ${c.exceptionUserIds.length} excepción${c.exceptionUserIds.length !== 1 ? 'es' : ''}`
                        : ''}
                    </p>
                  </div>
                  <div className="learning-manage-list__actions">
                    <span
                      className={`learning-manage-badge ${
                        c.isPublished
                          ? 'learning-manage-badge--published'
                          : 'learning-manage-badge--draft'
                      }`}
                    >
                      {c.isPublished ? 'Publicado' : 'Borrador'}
                    </span>
                    <Link
                      to={`/learning/gestion/${c.id}/editar`}
                      className="admin-btn admin-btn--ghost admin-btn--sm"
                    >
                      Editar
                    </Link>
                    <Link
                      to={`/learning/gestion/${c.id}`}
                      className="admin-btn admin-btn--ghost admin-btn--sm"
                    >
                      <BookOpen size={14} aria-hidden />
                      Contenido
                    </Link>
                    <Link
                      to={`/learning/gestion/${c.id}/reporte`}
                      className="admin-btn admin-btn--ghost admin-btn--sm"
                    >
                      <BarChart3 size={14} aria-hidden />
                      Reporte
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
