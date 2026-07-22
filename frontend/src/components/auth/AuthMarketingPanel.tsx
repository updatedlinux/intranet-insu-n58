import { InsularLogo } from '../brand/InsularLogo';

export function AuthMarketingPanel() {
  return (
    <aside className="login-brand" aria-label="Identidad corporativa">
      <div className="login-brand__inner">
        <div className="login-brand__logo-wrap">
          <InsularLogo variant="negative" />
        </div>
        <p className="login-brand__tagline">Plataforma corporativa interna</p>
        <p className="login-brand__hint">Acceso exclusivo para colaboradores</p>
      </div>
    </aside>
  );
}
