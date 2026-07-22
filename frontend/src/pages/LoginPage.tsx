import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { AuthMarketingPanel } from '../components/auth/AuthMarketingPanel';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 3l18 18M10.58 10.58a2 2 0 002.84 2.84M9.88 5.09A10.94 10.94 0 0112 5c6.5 0 10 7 10 7a18.2 18.2 0 01-4.12 5.12M6.12 6.12A18.2 18.2 0 002 12s3.5 7 10 7a10.9 10.9 0 005.88-1.71"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function LoginPage() {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (status === 'authenticated') {
    return <Navigate to={from} replace />;
  }

  if (status === 'loading') {
    return (
      <div className="login-page login-page--loading">
        <p className="login-muted">Verificando sesión…</p>
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { mustChangePassword } = await login(email.trim(), password);
      if (mustChangePassword) {
        navigate('/cambiar-contrasena', { replace: true });
        return;
      }
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('No se pudo iniciar sesión. Intente de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <AuthMarketingPanel />

      <section className="login-form-panel">
        <div className="login-form-panel__inner">
          <h1>Iniciar sesión</h1>
          <p className="login-form-panel__hint">Ingresa tu correo y la contraseña para acceder.</p>

          <form onSubmit={handleSubmit} noValidate>
            <div className="login-field">
              <label htmlFor="email">Correo</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="correo@n58bancodigital.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="login-field login-field--password">
              <div className="login-field__label-row">
                <label htmlFor="password">Contraseña</label>
                <Link to="/olvide-contrasena" className="login-link login-link--inline">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Tu contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="login-field__toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>

            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? 'Verificando…' : 'Continuar'}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
