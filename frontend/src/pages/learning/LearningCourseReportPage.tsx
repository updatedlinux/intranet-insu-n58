import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { fetchLearningCourseReport, fetchManageLearningCourse } from '../../api/learning';
import type { LearningReportRow } from '../../api/learning.types';
import { LearningManageSubnav } from '../../components/learning/LearningManageSubnav';
import { PageHeader } from '../../components/layout';

export function LearningCourseReportPage() {
  const courseId = Number(useParams().courseId);
  const [title, setTitle] = useState('');
  const [items, setItems] = useState<LearningReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [course, report] = await Promise.all([
        fetchManageLearningCourse(courseId),
        fetchLearningCourseReport(courseId),
      ]);
      setTitle(course.course.title);
      setItems(report.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar el reporte');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('es-PR');
  };

  return (
    <>
      <PageHeader
        title={`Reporte: ${title}`}
        breadcrumbParent={title || 'Curso'}
        breadcrumbCurrent="Reporte"
        breadcrumbParentHref={`/learning/gestion/${courseId}`}
      />

      <LearningManageSubnav courseId={courseId} />

      {error ? <div className="admin-alert admin-alert--error mb-20">{error}</div> : null}
      {loading ? <p className="text-gray learning-manage-empty">Cargando…</p> : null}

      {!loading && (
        <div className="card-style mb-30">
          {items.length === 0 ? (
            <div className="learning-manage-empty">
              <p>No hay usuarios inscritos según el alcance definido.</p>
            </div>
          ) : (
            <>
              <div className="learning-manage-report-head">
                <span>Colaborador</span>
                <span>Área</span>
                <span>Inscripción</span>
                <span>Progreso</span>
                <span>Última actividad</span>
                <span>Finalización</span>
              </div>
              {items.map((row) => (
                <div key={row.userId} className="learning-manage-report-row">
                  <div>
                    <div className="fw-semibold">{row.fullName}</div>
                    <div className="small text-muted">{row.email}</div>
                  </div>
                  <span>{row.areaName}</span>
                  <span>{row.enrollmentType === 'EXCEPTION' ? 'Excepción' : 'Por área'}</span>
                  <div className="d-flex align-items-center gap-2">
                    <div className="learning-report-bar flex-grow-1">
                      <div
                        className="learning-report-bar__fill"
                        style={{ width: `${row.percent}%` }}
                      />
                    </div>
                    <span className="small text-nowrap">{row.percent}%</span>
                  </div>
                  <span className="small">{formatDate(row.lastActivityAt)}</span>
                  <span className="small">{formatDate(row.completedAt)}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </>
  );
}
