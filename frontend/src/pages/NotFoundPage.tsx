import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="not-found">
      <h1>404</h1>
      <p>La página que busca no existe.</p>
      <Link to="/" className="main-btn primary-btn btn-hover">
        Volver al inicio
      </Link>
    </div>
  );
}
