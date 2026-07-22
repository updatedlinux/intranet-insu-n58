import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { ApiError } from '../../api/client';
import { deleteUserAvatar, uploadUserAvatar } from '../../api/users';
import { AvatarUploadField } from '../../components/admin/AvatarUploadField';
import { PageHeader } from '../../components/layout';
import { getRoleLabel } from '../../config/roles';
import { useAuth } from '../../context/AuthContext';

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-PA', { dateStyle: 'long', timeStyle: 'short' });
}

export function ProfilePage() {
  const { user, refreshSession } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [avatarSuccess, setAvatarSuccess] = useState('');

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  useEffect(() => {
    if (user) {
      setAvatarUrl(user.avatarUrl);
    }
  }, [user]);

  const persistAvatarUpload = useCallback(
    async (file: File) => {
      if (!user) return;

      setAvatarSaving(true);
      setAvatarError('');
      setAvatarSuccess('');

      try {
        const res = await uploadUserAvatar(user.id, file);
        setAvatarUrl(res.avatarUrl);
        await refreshSession();
        setAvatarSuccess('Foto de perfil actualizada.');
      } catch (err) {
        setAvatarError(err instanceof ApiError ? err.message : 'No se pudo subir la foto');
      } finally {
        setAvatarSaving(false);
      }
    },
    [refreshSession, user],
  );

  const persistAvatarRemove = useCallback(async () => {
    if (!user) return;

    setAvatarSaving(true);
    setAvatarError('');
    setAvatarSuccess('');

    try {
      await deleteUserAvatar(user.id);
      setAvatarUrl(null);
      await refreshSession();
      setAvatarSuccess('Foto de perfil eliminada.');
    } catch (err) {
      setAvatarError(err instanceof ApiError ? err.message : 'No se pudo eliminar la foto');
    } finally {
      setAvatarSaving(false);
    }
  }, [refreshSession, user]);

  if (!user) {
    return <p className="text-gray">Cargando perfil…</p>;
  }

  return (
    <div className="collab-profile-page-wrap">
      <PageHeader title="Mi perfil" breadcrumbParent="Cuenta" breadcrumbCurrent="Perfil" />

      <div className="card-style collab-profile-page mb-30">
        <div className="collab-profile-page__header">
          <div className="collab-profile-page__header-body">
            <h3 className="collab-profile-page__name">
              {user.firstName} {user.lastName}
            </h3>
            <p className="collab-profile-page__email">{user.email}</p>
          </div>
          <div className="collab-profile-page__photo">
            <span className="admin-form__label">Foto de perfil</span>
            <AvatarUploadField
              key={`${user.id}-${avatarUrl ?? 'none'}`}
              userId={user.id}
              firstName={user.firstName}
              lastName={user.lastName}
              currentAvatarUrl={avatarUrl}
              disabled={avatarSaving}
              onFileChange={(file) => {
                if (file) void persistAvatarUpload(file);
              }}
              onRemoveExisting={() => void persistAvatarRemove()}
            />
            {avatarSaving && (
              <p className="collab-profile-page__photo-status text-sm text-gray">Guardando foto…</p>
            )}
            {avatarSuccess && (
              <p className="collab-profile-page__photo-status collab-profile-page__photo-status--success">
                {avatarSuccess}
              </p>
            )}
            {avatarError && (
              <p className="collab-profile-page__photo-status collab-profile-page__photo-status--error">
                {avatarError}
              </p>
            )}
          </div>
        </div>

        <section className="collab-profile-page__details" aria-label="Datos de la cuenta">
          <dl className="admin-detail__grid collab-profile-page__grid">
            <div>
              <dt>Rol</dt>
              <dd>{getRoleLabel(user.role.name)}</dd>
            </div>
            <div>
              <dt>Área</dt>
              <dd>{user.area.name}</dd>
            </div>
            <div>
              <dt>Cargo</dt>
              <dd>{user.position.name}</dd>
            </div>
            <div>
              <dt>Estado de cuenta</dt>
              <dd>{user.isActive ? 'Activa' : 'Inactiva'}</dd>
            </div>
            <div>
              <dt>Último acceso</dt>
              <dd>{formatDate(user.lastLoginAt)}</dd>
            </div>
            <div>
              <dt>Contraseña</dt>
              <dd>
                {user.mustChangePassword ? (
                  <span className="admin-badge admin-badge--warning">Cambio pendiente</span>
                ) : (
                  'Actualizada'
                )}
              </dd>
            </div>
          </dl>
        </section>

        <div className="collab-profile-page__actions">
          <Link to="/cambiar-contrasena" className="admin-btn admin-btn--primary">
            <Lock size={16} aria-hidden />
            Cambiar contraseña
          </Link>
          <Link to="/" className="admin-btn admin-btn--ghost">
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
