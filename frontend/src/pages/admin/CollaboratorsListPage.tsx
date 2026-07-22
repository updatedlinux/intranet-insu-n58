import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, RefreshCw } from 'lucide-react';
import { ApiError } from '../../api/client';
import {
  fetchAdminAreas,
  fetchAdminRoles,
  fetchAdminPositions,
  fetchCollaborators,
  resetCollaboratorPassword,
  setCollaboratorStatus,
  deleteCollaborator,
} from '../../api/collaborators';
import type {
  AreaOption,
  Collaborator,
  PositionOption,
  RoleOption,
} from '../../api/collaborators.types';
import { AdminGovernanceBanner } from '../../components/admin/AdminGovernanceBanner';
import { ConfirmModal } from '../../components/admin/ConfirmModal';
import { UserAvatar } from '../../components/admin/UserAvatar';
import { PageHeader } from '../../components/layout';
import { Select } from '../../components/ui/Select';
import { getRoleLabel } from '../../config/roles';

type PendingAction =
  | { type: 'status'; collaborator: Collaborator; isActive: boolean }
  | { type: 'reset'; collaborator: Collaborator }
  | { type: 'delete'; collaborator: Collaborator };

function StatusBadge({
  active,
  mustChangePassword,
}: {
  active: boolean;
  mustChangePassword: boolean;
}) {
  if (!active) {
    return <span className="admin-badge admin-badge--inactive">Inactivo</span>;
  }
  if (mustChangePassword) {
    return <span className="admin-badge admin-badge--warning">Pendiente cambio</span>;
  }
  return <span className="admin-badge admin-badge--active">Activo</span>;
}

export function CollaboratorsListPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Collaborator[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [warningMessage, setWarningMessage] = useState('');

  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [positions, setPositions] = useState<PositionOption[]>([]);

  const [search, setSearch] = useState('');
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('');
  const [areaId, setAreaId] = useState('');
  const [positionId, setPositionId] = useState('');
  const [isActive, setIsActive] = useState('');

  const loadCatalogs = useCallback(async () => {
    const [rolesRes, areasRes] = await Promise.all([fetchAdminRoles(), fetchAdminAreas()]);
    setRoles(rolesRes.roles);
    setAreas(areasRes.areas);
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchCollaborators({
        search: search || undefined,
        email: email || undefined,
        roleId: roleId ? Number.parseInt(roleId, 10) : undefined,
        areaId: areaId ? Number.parseInt(areaId, 10) : undefined,
        positionId: positionId ? Number.parseInt(positionId, 10) : undefined,
        isActive: isActive === '' ? undefined : isActive === 'true',
        page,
        pageSize,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar el listado');
    } finally {
      setLoading(false);
    }
  }, [search, email, roleId, areaId, positionId, isActive, page, pageSize]);

  useEffect(() => {
    void loadCatalogs();
  }, [loadCatalogs]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!areaId) {
      setPositions([]);
      return;
    }
    void fetchAdminPositions(Number.parseInt(areaId, 10)).then((res) =>
      setPositions(res.positions),
    );
  }, [areaId]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleConfirm = async () => {
    if (!pending) return;
    setActionLoading(true);
    setError('');
    setSuccessMessage('');
    setWarningMessage('');
    try {
      if (pending.type === 'status') {
        await setCollaboratorStatus(pending.collaborator.id, pending.isActive);
      } else if (pending.type === 'reset') {
        const res = await resetCollaboratorPassword(pending.collaborator.id);
        if (res.emailSent) {
          setSuccessMessage(
            `Se envió un correo a ${pending.collaborator.email} con la contraseña temporal.`,
          );
        } else {
          setWarningMessage(
            `La contraseña de ${pending.collaborator.email} fue restablecida, pero no se pudo enviar el correo. Verifique SMTP.`,
          );
        }
      } else {
        await deleteCollaborator(pending.collaborator.id);
        setSuccessMessage(
          `Se eliminó a ${pending.collaborator.firstName} ${pending.collaborator.lastName}.`,
        );
      }
      setPending(null);
      await loadList();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo completar la acción');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Colaboradores"
        breadcrumbParent="Administración"
        breadcrumbCurrent="Colaboradores"
        breadcrumbParentHref="/admin/colaboradores"
      />

      <AdminGovernanceBanner title="Directorio de colaboradores" variant="support-ti">
        <p>
          Alta, edición y estado de las cuentas de intranet. Cada colaborador tiene rol, área y
          cargo que determinan permisos en documentos, chat y módulos operativos.
        </p>
      </AdminGovernanceBanner>

      <div className="learning-manage-toolbar card-style mb-30">
        <div className="admin-toolbar__filters row g-2 flex-grow-1">
          <div className="col-lg-3 col-md-6">
            <input
              className="admin-form__input"
              placeholder="Buscar por nombre…"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
            />
          </div>
          <div className="col-lg-3 col-md-6">
            <input
              className="admin-form__input"
              placeholder="Filtrar por email…"
              value={email}
              onChange={(e) => {
                setPage(1);
                setEmail(e.target.value);
              }}
            />
          </div>
          <div className="col-lg-2 col-md-4">
            <Select
              value={roleId}
              onChange={(v) => {
                setPage(1);
                setRoleId(v);
              }}
              options={[
                { value: '', label: 'Todos los roles' },
                ...roles.map((r) => ({ value: String(r.id), label: r.name })),
              ]}
            />
          </div>
          <div className="col-lg-2 col-md-4">
            <Select
              value={areaId}
              onChange={(v) => {
                setPage(1);
                setAreaId(v);
                setPositionId('');
              }}
              options={[
                { value: '', label: 'Todas las áreas' },
                ...areas.map((a) => ({ value: String(a.id), label: a.name })),
              ]}
            />
          </div>
          <div className="col-lg-2 col-md-4">
            <Select
              value={positionId}
              onChange={(v) => {
                setPage(1);
                setPositionId(v);
              }}
              disabled={!areaId}
              options={[
                { value: '', label: 'Todos los cargos' },
                ...positions.map((p) => ({ value: String(p.id), label: p.name })),
              ]}
            />
          </div>
          <div className="col-lg-2 col-md-4">
            <Select
              value={isActive}
              onChange={(v) => {
                setPage(1);
                setIsActive(v);
              }}
              options={[
                { value: '', label: 'Todos los estados' },
                { value: 'true', label: 'Activos' },
                { value: 'false', label: 'Inactivos' },
              ]}
            />
          </div>
        </div>
        <div className="learning-manage-toolbar__actions">
          <Link to="/admin/colaboradores/nuevo" className="admin-btn admin-btn--primary">
            <Plus size={16} aria-hidden />
            Nuevo colaborador
          </Link>
          <button
            type="button"
            className="admin-btn admin-btn--ghost"
            onClick={() => void loadList()}
          >
            <RefreshCw size={16} aria-hidden />
            Actualizar
          </button>
        </div>
      </div>

      {error && <div className="admin-alert admin-alert--error mb-20">{error}</div>}

      {successMessage && (
        <div className="admin-alert admin-alert--success mb-20">
          {successMessage}
          <button
            type="button"
            className="admin-btn admin-btn--ghost admin-btn--sm ms-2"
            onClick={() => setSuccessMessage('')}
          >
            Cerrar
          </button>
        </div>
      )}

      {warningMessage && (
        <div className="admin-alert admin-alert--warning mb-20">
          {warningMessage}
          <button
            type="button"
            className="admin-btn admin-btn--ghost admin-btn--sm ms-2"
            onClick={() => setWarningMessage('')}
          >
            Cerrar
          </button>
        </div>
      )}

      <div className="card-style mb-30">
        <div className="table-responsive">
          <table className="table top-selling-table admin-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Área</th>
                <th>Cargo</th>
                <th>Estado</th>
                <th className="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center text-gray py-4">
                    Cargando colaboradores…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-gray py-4">
                    No se encontraron colaboradores con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                items.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="admin-table__name-cell">
                        <UserAvatar
                          userId={c.id}
                          firstName={c.firstName}
                          lastName={c.lastName}
                          avatarUrl={c.avatarUrl}
                          size="sm"
                        />
                        <button
                          type="button"
                          className="admin-link-btn"
                          onClick={() => navigate(`/admin/colaboradores/${c.id}`)}
                        >
                          {c.firstName} {c.lastName}
                        </button>
                      </div>
                    </td>
                    <td>{c.email}</td>
                    <td>{getRoleLabel(c.role.name)}</td>
                    <td>{c.area.name}</td>
                    <td>{c.position.name}</td>
                    <td>
                      <StatusBadge active={c.isActive} mustChangePassword={c.mustChangePassword} />
                    </td>
                    <td>
                      <div className="admin-row-actions">
                        <Link
                          to={`/admin/colaboradores/${c.id}`}
                          className="admin-btn admin-btn--ghost admin-btn--sm"
                        >
                          Ver
                        </Link>
                        <Link
                          to={`/admin/colaboradores/${c.id}/editar`}
                          className="admin-btn admin-btn--ghost admin-btn--sm"
                        >
                          Editar
                        </Link>
                        <button
                          type="button"
                          className="admin-btn admin-btn--ghost admin-btn--sm"
                          onClick={() =>
                            setPending({
                              type: 'status',
                              collaborator: c,
                              isActive: !c.isActive,
                            })
                          }
                        >
                          {c.isActive ? 'Inactivar' : 'Activar'}
                        </button>
                        <button
                          type="button"
                          className="admin-btn admin-btn--ghost admin-btn--sm"
                          onClick={() => setPending({ type: 'reset', collaborator: c })}
                        >
                          Reset pass
                        </button>
                        <button
                          type="button"
                          className="admin-btn admin-btn--ghost admin-btn--sm"
                          onClick={() => setPending({ type: 'delete', collaborator: c })}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="admin-pagination">
          <span className="text-sm text-gray">
            {total} registro{total !== 1 ? 's' : ''} · Página {page} de {totalPages}
          </span>
          <div className="admin-pagination__btns">
            <button
              type="button"
              className="admin-btn admin-btn--ghost admin-btn--sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </button>
            <button
              type="button"
              className="admin-btn admin-btn--ghost admin-btn--sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={pending?.type === 'status'}
        title={
          pending?.type === 'status' && pending.isActive
            ? 'Activar colaborador'
            : 'Inactivar colaborador'
        }
        message={
          pending?.type === 'status' ? (
            <>
              ¿Confirma {pending.isActive ? 'activar' : 'inactivar'} a{' '}
              <strong>
                {pending.collaborator.firstName} {pending.collaborator.lastName}
              </strong>
              ?
            </>
          ) : null
        }
        variant={pending?.type === 'status' && !pending.isActive ? 'danger' : 'primary'}
        loading={actionLoading}
        onConfirm={handleConfirm}
        onCancel={() => setPending(null)}
      />

      <ConfirmModal
        open={pending?.type === 'reset'}
        title="Resetear contraseña"
        message={
          pending?.type === 'reset' ? (
            <>
              Se enviará una contraseña temporal por correo a{' '}
              <strong>
                {pending.collaborator.firstName} {pending.collaborator.lastName}
              </strong>{' '}
              ({pending.collaborator.email}). Deberá cambiarla en el próximo inicio de sesión.
            </>
          ) : null
        }
        confirmLabel="Enviar por correo"
        loading={actionLoading}
        onConfirm={handleConfirm}
        onCancel={() => setPending(null)}
      />

      <ConfirmModal
        open={pending?.type === 'delete'}
        title="Eliminar colaborador"
        message={
          pending?.type === 'delete' ? (
            <>
              ¿Eliminar permanentemente a{' '}
              <strong>
                {pending.collaborator.firstName} {pending.collaborator.lastName}
              </strong>{' '}
              ({pending.collaborator.email})? Esta acción no se puede deshacer.
              <p className="admin-modal__warning mt-2">
                Solo es posible si el colaborador no tiene tickets, documentos, activos u otras
                referencias en el sistema.
              </p>
            </>
          ) : null
        }
        variant="danger"
        confirmLabel="Eliminar"
        loading={actionLoading}
        onConfirm={handleConfirm}
        onCancel={() => setPending(null)}
      />
    </>
  );
}
