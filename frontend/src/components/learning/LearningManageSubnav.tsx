import { Link, useLocation } from 'react-router-dom';

interface Props {
  courseId: number;
}

export function LearningManageSubnav({ courseId }: Props) {
  const { pathname } = useLocation();
  const base = `/learning/gestion/${courseId}`;

  const links = [
    { to: `${base}/editar`, label: 'Datos y alcance', match: '/editar' },
    { to: base, label: 'Contenido', match: null },
    { to: `${base}/reporte`, label: 'Reporte', match: '/reporte' },
  ];

  const isActive = (match: string | null) => {
    if (match === '/editar') return pathname.endsWith('/editar');
    if (match === '/reporte') return pathname.endsWith('/reporte');
    return pathname === base;
  };

  return (
    <nav className="learning-manage-subnav" aria-label="Secciones del curso">
      <Link to="/learning/gestion" className="learning-manage-subnav__link">
        ← Listado
      </Link>
      {links.map((l) => (
        <Link
          key={l.to}
          to={l.to}
          className={`learning-manage-subnav__link${isActive(l.match) ? ' is-active' : ''}`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
