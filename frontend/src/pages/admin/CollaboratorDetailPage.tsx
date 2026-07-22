import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import {
  deleteCollaborator,
  fetchCollaborator,
  resetCollaboratorPassword,
  setCollaboratorStatus,
} from '../../api/collaborators';
import type { Collaborator } from '../../api/collaborators.types';
import { ConfirmModal } from '../../components/admin/ConfirmModal';
import { PageHeader } from '../../components/layout';
import { getRoleLabel } from '../../config/roles';

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-PA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function CollaboratorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [collaborator, setCollaborator] = useState<Collaborator | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [warningMessage, setWarningMessage] = useState('');
  const [pendingStatus, setPendingStatus] = useState<boolean | null>(null);
  const [pendingReset, setPendingReset] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const load = async (userId: number) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchCollaborator(userId);
      setCollaborator(res.collaborator);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar el detalle');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const userId = Number.parseInt(id ?? '', 10);
    if (Number.isNaN(userId)) {
      setError('Identificador inválido');
      setLoading(false);
      return;
    }
    void load(userId);
  }, [id]);

  const handleStatus = async () => {
    if (!collaborator || pendingStatus == null) return;
    setActionLoading(true);
    try {
      const res = await setCollaboratorStatus(collaborator.id, pendingStatus);
      setCollaborator(res.collaborator);
      setPendingStatus(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar el estado');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReset = async () => {
    if (!collaborator) return;
    setActionLoading(true);
    setError('');
    setSuccessMessage('');
    setWarningMessage('');
    try {
      const res = await resetCollaboratorPassword(collaborator.id);
      setCollaborator(res.collaborator);
      setPendingReset(false);
      if (res.emailSent) {
        setSuccessMessage(
          `Se envió un correo a ${collaborator.email} con la contraseña temporal. El colaborador deberá cambiarla al iniciar sesión.`,
        );
      } else {
        setWarningMessage(
          `La contraseña fue restablecida, pero no se pudo enviar el correo a ${collaborator.email}. Verifique la configuración SMTP o contacte a soporte.`,
        );
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo resetear la contraseña');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!collaborator) return;
    setActionLoading(true);
    setError('');
    try {
      await deleteCollaborator(collaborator.id);
      navigate('/admin/colaboradores');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar el colaborador');
      setPendingDelete(false);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <p className="text-gray">Cargando detalle…</p>;
  }

  if (!collaborator) {
    return (
      <>
        <div className="admin-alert admin-alert--error mb-20">
          {error || 'Colaborador no encontrado'}
        </div>
        <Link to="/admin/colaboradores" className="admin-btn admin-btn--ghost">
          Volver
        </Link>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={`${collaborator.firstName} ${collaborator.lastName}`}
        breadcrumbParent="Colaboradores"
        breadcrumbCurrent="Detalle"
        breadcrumbParentHref="/admin/colaboradores"
      />

      {error && <div className="admin-alert admin-alert--error mb-20">{error}</div>}
      {successMessage && (
        <div className="admin-alert admin-alert--success mb-20">{successMessage}</div>
      )}
      {warningMessage && (
        <div className="admin-alert admin-alert--warning mb-20">{warningMessage}</div>
      )}

      <div className="admin-detail card-style mb-30">
        <div className="admin-detail__header">
          <div>
            <h3 className="admin-detail__name">
              {collaborator.firstName} {collaborator.lastName}
            </h3>
            <p className="text-gray mb-0">{collaborator.email}</p>
          </div>
          <div className="admin-detail__actions">
            <Link
              to={`/admin/colaboradores/${collaborator.id}/editar`}
              className="admin-btn admin-btn--primary admin-btn--sm"
            >
              Editar
            </Link>
            <button
              type="button"
              className="admin-btn admin-btn--ghost admin-btn--sm"
              onClick={() => setPendingStatus(!collaborator.isActive)}
            >
              {collaborator.isActive ? 'Inactivar' : 'Activar'}
            </button>
            <button
              type="button"
              className="admin-btn admin-btn--ghost admin-btn--sm"
              onClick={() => setPendingReset(true)}
            >
              Resetear contraseña
            </button>
            <button
              type="button"
              className="admin-btn admin-btn--ghost admin-btn--sm"
              onClick={() => setPendingDelete(true)}
            >
              Eliminar
            </button>
            <button
              type="button"
              className="admin-btn admin-btn--ghost admin-btn--sm"
              onClick={() => navigate('/admin/colaboradores')}
            >
              Volver
            </button>
          </div>
        </div>

        <dl className="admin-detail__grid">
          <div>
            <dt>Rol</dt>
            <dd>{getRoleLabel(collaborator.role.name)}</dd>
          </div>
          <div>
            <dt>Área</dt>
            <dd>{collaborator.area.name}</dd>
          </div>
          <div>
            <dt>Cargo</dt>
            <dd>{collaborator.position.name}</dd>
          </div>
          <div>
            <dt>Estado</dt>
            <dd>{collaborator.isActive ? 'Activo' : 'Inactivo'}</dd>
          </div>
          <div>
            <dt>Cambio de contraseña</dt>
            <dd>
              {collaborator.mustChangePassword ? 'Pendiente en próximo login' : 'No requerido'}
            </dd>
          </div>
          <div>
            <dt>Último acceso</dt>
            <dd>{formatDate(collaborator.lastLoginAt)}</dd>
          </div>
          <div>
            <dt>Creado</dt>
            <dd>{formatDate(collaborator.createdAt)}</dd>
          </div>
          <div>
            <dt>Actualizado</dt>
            <dd>{formatDate(collaborator.updatedAt)}</dd>
          </div>
        </dl>
      </div>

      <ConfirmModal
        open={pendingStatus != null}
        title={pendingStatus ? 'Activar colaborador' : 'Inactivar colaborador'}
        message={`¿Confirma ${pendingStatus ? 'activar' : 'inactivar'} esta cuenta?`}
        variant={pendingStatus ? 'primary' : 'danger'}
        loading={actionLoading}
        onConfirm={handleStatus}
        onCancel={() => setPendingStatus(null)}
      />

      <ConfirmModal
        open={pendingReset}
        title="Resetear contraseña"
        message="Se generará una contraseña temporal y se enviará por correo al colaborador. Deberá cambiarla al iniciar sesión."
        confirmLabel="Enviar por correo"
        loading={actionLoading}
        onConfirm={handleReset}
        onCancel={() => setPendingReset(false)}
      />

      <ConfirmModal
        open={pendingDelete}
        title="Eliminar colaborador"
        message={
          <>
            ¿Eliminar permanentemente a{' '}
            <strong>
              {collaborator.firstName} {collaborator.lastName}
            </strong>
            ? Esta acción no se puede deshacer.
          </>
        }
        variant="danger"
        confirmLabel="Eliminar"
        loading={actionLoading}
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(false)}
      />
    </>
  );
}
