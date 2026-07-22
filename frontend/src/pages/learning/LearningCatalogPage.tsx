import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, RefreshCw, Settings } from 'lucide-react';
import { ApiError } from '../../api/client';
import { fetchMyLearningCourses } from '../../api/learning';
import type { LearningCourseCard as CourseType } from '../../api/learning.types';
import { LearningCourseCard } from '../../components/learning/LearningCourseCard';
import { PageHeader } from '../../components/layout';
import { useAuth } from '../../context/AuthContext';
import { canManageLearning } from '../../config/roles';

export function LearningCatalogPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<CourseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const showManage = user && canManageLearning(user);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchMyLearningCourses();
      setItems(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar el catálogo');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="N58 Learning"
        breadcrumbParent="N58 Learning"
        breadcrumbCurrent="Mis cursos"
        breadcrumbParentHref="/learning"
      />

      {showManage ? (
        <div className="mb-3 text-end">
          <Link
            to="/learning/gestion"
            className="btn btn-outline-primary btn-sm d-inline-flex gap-1"
          >
            <Settings size={16} />
            Gestión
          </Link>
        </div>
      ) : null}

      <div className="d-flex align-items-center gap-2 mb-3 text-muted">
        <GraduationCap size={20} />
        <span>Cursos disponibles según su área y asignaciones especiales.</span>
        <button
          type="button"
          className="btn btn-link btn-sm ms-auto p-0"
          onClick={() => void load()}
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}
      {loading ? <p className="text-muted">Cargando…</p> : null}
      {!loading && !items.length ? (
        <p className="text-muted">No hay cursos asignados a su perfil en este momento.</p>
      ) : null}

      <div className="learning-catalog">
        {items.map((c) => (
          <LearningCourseCard key={c.id} course={c} />
        ))}
      </div>
    </>
  );
}
