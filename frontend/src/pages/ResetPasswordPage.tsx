import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { resetPasswordRequest } from '../api/auth';
import { AuthMarketingPanel } from '../components/auth/AuthMarketingPanel';
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

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await resetPasswordRequest({
        token,
        newPassword,
        confirmPassword,
      });
      setMessage(res.message);
      setTimeout(() => navigate('/login', { replace: true }), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo restablecer la contraseña');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="login-page">
        <AuthMarketingPanel />
        <section className="login-form-panel">
          <div className="login-form-panel__inner">
            <h1>Enlace no válido</h1>
            <p className="login-form-panel__hint">
              El enlace de recuperación falta o ya no es válido. Solicite uno nuevo.
            </p>
            <p className="login-form-panel__footer">
              <Link to="/olvide-contrasena" className="login-link">
                Solicitar nuevo enlace
              </Link>
              {' · '}
              <Link to="/login" className="login-link">
                Iniciar sesión
              </Link>
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="login-page">
      <AuthMarketingPanel />

      <section className="login-form-panel">
        <div className="login-form-panel__inner">
          <h1>Nueva contraseña</h1>
          <p className="login-form-panel__hint">
            Elija una contraseña segura de al menos 8 caracteres para acceder a la intranet.
          </p>

          <form onSubmit={handleSubmit} noValidate>
            <div className="login-field login-field--password">
              <label htmlFor="newPassword">Nueva contraseña</label>
              <input
                id="newPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>

            <div className="login-field login-field--password">
              <label htmlFor="confirmPassword">Confirmar contraseña</label>
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Repita la contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
              <button
                type="button"
                className="login-field__toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>

            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}

            {message && (
              <p className="login-success" role="status">
                {message}
              </p>
            )}

            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? 'Guardando…' : 'Guardar contraseña'}
            </button>
          </form>

          <p className="login-form-panel__footer">
            <Link to="/login" className="login-link">
              Volver a iniciar sesión
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
