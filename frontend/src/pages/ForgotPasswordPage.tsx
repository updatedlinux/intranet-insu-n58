import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../api/client';
import { forgotPasswordRequest } from '../api/auth';
import { AuthMarketingPanel } from '../components/auth/AuthMarketingPanel';
import './LoginPage.css';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await forgotPasswordRequest(email.trim());
      setMessage(res.message);
      setEmail('');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo procesar la solicitud. Intente de nuevo.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <AuthMarketingPanel />

      <section className="login-form-panel">
        <div className="login-form-panel__inner">
          <h1>¿Olvidaste tu contraseña?</h1>
          <p className="login-form-panel__hint">
            Ingresa el correo corporativo con el que accedes a la intranet. Si está registrado, te
            enviaremos un enlace para crear una nueva contraseña.
          </p>

          <form onSubmit={handleSubmit} noValidate>
            <div className="login-field">
              <label htmlFor="forgot-email">Correo</label>
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                placeholder="correo@insularcambios.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
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
              {loading ? 'Enviando…' : 'Enviar enlace'}
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
