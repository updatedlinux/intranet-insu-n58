import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { changePasswordRequest } from '../api/auth';
import { PageHeader } from '../components/layout';
import { useAuth } from '../context/AuthContext';

export function ChangePasswordPage() {
  const { user, refreshSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const forced =
    Boolean((location.state as { forced?: boolean } | null)?.forced) || user?.mustChangePassword;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await changePasswordRequest({ currentPassword, newPassword, confirmPassword });
      await refreshSession();
      setSuccess('Contraseña actualizada correctamente.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => navigate('/', { replace: true }), 1200);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cambiar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="collab-password-page-wrap">
      <PageHeader
        title="Cambiar contraseña"
        breadcrumbParent="Cuenta"
        breadcrumbCurrent="Contraseña"
      />

      {forced && (
        <div className="admin-alert admin-alert--warning mb-20">
          Debe establecer una nueva contraseña antes de continuar usando la intranet.
        </div>
      )}

      {error && <div className="admin-alert admin-alert--error mb-20">{error}</div>}
      {success && <div className="admin-alert admin-alert--success mb-20">{success}</div>}

      <form className="admin-form card-style mb-30 collab-password-form" onSubmit={handleSubmit}>
        <p className="collab-password-form__hint text-sm text-gray">
          Use al menos 8 caracteres. Si recibió una contraseña temporal del administrador, ingrésela
          como contraseña actual.
        </p>

        <div className="collab-password-form__fields">
          <div className="collab-password-form__field">
            <label className="admin-form__label" htmlFor="currentPassword">
              Contraseña actual
            </label>
            <input
              id="currentPassword"
              type="password"
              className="admin-form__input"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={loading}
            />
          </div>
          <div className="collab-password-form__pair">
            <div className="collab-password-form__field">
              <label className="admin-form__label" htmlFor="newPassword">
                Nueva contraseña
              </label>
              <input
                id="newPassword"
                type="password"
                className="admin-form__input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                disabled={loading}
              />
            </div>
            <div className="collab-password-form__field">
              <label className="admin-form__label" htmlFor="confirmPassword">
                Confirmar nueva contraseña
              </label>
              <input
                id="confirmPassword"
                type="password"
                className="admin-form__input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                disabled={loading}
              />
            </div>
          </div>
        </div>

        <div className="admin-form__actions collab-password-form__actions">
          {!forced && (
            <Link to="/mi-perfil" className="admin-btn admin-btn--ghost">
              Cancelar
            </Link>
          )}
          <button type="submit" className="admin-btn admin-btn--primary" disabled={loading}>
            {loading ? 'Guardando…' : 'Actualizar contraseña'}
          </button>
        </div>
      </form>
    </div>
  );
}
