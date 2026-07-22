import { Link } from 'react-router-dom';
import type { LearningCourseCard as CourseCardType } from '../../api/learning.types';
import { learningCoverUrl } from '../../api/learning';

function StatusBadge({ status }: { status: CourseCardType['status'] }) {
  if (status === 'COMPLETED') {
    return <span className="learning-badge learning-badge--done">Terminado</span>;
  }
  if (status === 'IN_PROGRESS') {
    return <span className="learning-badge learning-badge--progress">En curso</span>;
  }
  return <span className="learning-badge learning-badge--new">Nuevo</span>;
}

export function LearningCourseCard({ course }: { course: CourseCardType }) {
  const coverSrc = learningCoverUrl(course.id);

  return (
    <Link to={`/learning/${course.id}`} className="learning-card text-decoration-none">
      <img
        className="learning-card__cover"
        src={coverSrc}
        alt=""
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
        }}
      />
      <div className="learning-card__body">
        <div className="d-flex justify-content-between align-items-center">
          <span className="learning-card__code">{course.code}</span>
          <StatusBadge status={course.status} />
        </div>
        <h3 className="learning-card__title">{course.title}</h3>
        {course.description ? (
          <p className="text-muted small mb-0 text-truncate-2">{course.description}</p>
        ) : null}
        <div className="learning-progress mt-2">
          <div className="learning-progress__bar" style={{ width: `${course.percent}%` }} />
        </div>
        <span className="small text-muted">
          {course.percent}% · {course.completedLessons}/{course.totalLessons} lecciones
        </span>
      </div>
    </Link>
  );
}
