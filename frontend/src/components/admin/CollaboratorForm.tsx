import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AreaOption, PositionOption, RoleOption } from '../../api/collaborators.types';
import { fetchAdminAreas, fetchAdminPositions, fetchAdminRoles } from '../../api/collaborators';
import { AvatarUploadField } from './AvatarUploadField';
import { Select } from '../ui/Select';

export interface CollaboratorFormValues {
  firstName: string;
  lastName: string;
  email: string;
  roleId: string;
  areaId: string;
  positionId: string;
  isActive: boolean;
}

interface CollaboratorFormProps {
  initialValues?: Partial<CollaboratorFormValues>;
  initialPosition?: { id: number; name: string };
  submitLabel: string;
  loading?: boolean;
  mode?: 'create' | 'edit';
  userId?: number;
  avatarUrl?: string | null;
  avatarFile?: File | null;
  avatarRemovePending?: boolean;
  onAvatarFileChange?: (file: File | null) => void;
  onAvatarRemove?: () => void;
  onSubmit: (values: CollaboratorFormValues) => void;
  onCancel: () => void;
}

const emptyValues: CollaboratorFormValues = {
  firstName: '',
  lastName: '',
  email: '',
  roleId: '',
  areaId: '',
  positionId: '',
  isActive: true,
};

export function CollaboratorForm({
  initialValues,
  initialPosition,
  submitLabel,
  loading = false,
  mode = 'create',
  userId,
  avatarUrl,
  avatarFile: _avatarFile,
  avatarRemovePending = false,
  onAvatarFileChange,
  onAvatarRemove,
  onSubmit,
  onCancel,
}: CollaboratorFormProps) {
  const [values, setValues] = useState<CollaboratorFormValues>({
    ...emptyValues,
    ...initialValues,
  });
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [areas, setAreas] = useState<AreaOption[]>([]);
  const [positions, setPositions] = useState<PositionOption[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [rolesRes, areasRes] = await Promise.all([fetchAdminRoles(), fetchAdminAreas()]);
        if (!active) return;
        setRoles(rolesRes.roles);
        setAreas(areasRes.areas);
      } finally {
        if (active) setCatalogLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!values.areaId) {
      setPositions([]);
      return;
    }
    let active = true;
    (async () => {
      const areaId = Number.parseInt(values.areaId, 10);
      const res = await fetchAdminPositions(areaId);
      if (!active) return;
      setPositions(res.positions);
    })();
    return () => {
      active = false;
    };
  }, [values.areaId]);

  const positionOptions = useMemo(() => {
    const options = positions.map((p) => ({ value: String(p.id), label: p.name }));
    if (
      initialPosition &&
      values.positionId === String(initialPosition.id) &&
      !options.some((o) => o.value === String(initialPosition.id))
    ) {
      options.unshift({
        value: String(initialPosition.id),
        label: `${initialPosition.name} (cargo actual)`,
      });
    }
    return options;
  }, [positions, initialPosition, values.positionId]);

  const handleChange = (field: keyof CollaboratorFormValues, value: string | boolean) => {
    setValues((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'areaId') {
        next.positionId = '';
      }
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(values);
  };

  return (
    <form className="admin-form card-style mb-30" onSubmit={handleSubmit}>
      <div className="row g-3">
        {onAvatarFileChange && (
          <div className="col-12">
            <span className="admin-form__label">Foto de perfil</span>
            <AvatarUploadField
              userId={userId}
              firstName={values.firstName || ' '}
              lastName={values.lastName || ' '}
              currentAvatarUrl={avatarUrl}
              disabled={loading}
              removePending={avatarRemovePending}
              onFileChange={onAvatarFileChange}
              onRemoveExisting={mode === 'edit' ? onAvatarRemove : undefined}
            />
          </div>
        )}
        <div className="col-md-6">
          <label className="admin-form__label" htmlFor="firstName">
            Nombre
          </label>
          <input
            id="firstName"
            className="admin-form__input"
            value={values.firstName}
            onChange={(e) => handleChange('firstName', e.target.value)}
            required
            minLength={2}
            disabled={loading}
          />
        </div>
        <div className="col-md-6">
          <label className="admin-form__label" htmlFor="lastName">
            Apellido
          </label>
          <input
            id="lastName"
            className="admin-form__input"
            value={values.lastName}
            onChange={(e) => handleChange('lastName', e.target.value)}
            required
            minLength={2}
            disabled={loading}
          />
        </div>
        <div className="col-md-6">
          <label className="admin-form__label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="admin-form__input"
            value={values.email}
            onChange={(e) => handleChange('email', e.target.value)}
            required
            disabled={loading}
          />
        </div>
        <div className="col-md-6">
          <label className="admin-form__label" htmlFor="roleId">
            Rol
          </label>
          <Select
            id="roleId"
            value={values.roleId}
            onChange={(v) => handleChange('roleId', v)}
            required
            disabled={loading || catalogLoading}
            placeholder="Seleccionar rol"
            options={roles.map((r) => ({ value: String(r.id), label: r.name }))}
          />
        </div>
        <div className="col-md-6">
          <label className="admin-form__label" htmlFor="areaId">
            Área
          </label>
          <Select
            id="areaId"
            value={values.areaId}
            onChange={(v) => handleChange('areaId', v)}
            required
            disabled={loading || catalogLoading}
            placeholder="Seleccionar área"
            options={areas.map((a) => ({ value: String(a.id), label: a.name }))}
          />
        </div>
        <div className="col-md-6">
          <label className="admin-form__label" htmlFor="positionId">
            Cargo
          </label>
          <Select
            id="positionId"
            value={values.positionId}
            onChange={(v) => handleChange('positionId', v)}
            required
            disabled={loading || catalogLoading || !values.areaId}
            placeholder={values.areaId ? 'Seleccionar cargo' : 'Seleccione un área primero'}
            options={positionOptions}
          />
          {values.areaId && positions.length === 0 && (
            <p className="text-sm text-gray mb-0 mt-2">
              Esta área no tiene cargos activos.{' '}
              <Link to="/admin/positions/nuevo">Crear un cargo</Link> en Administración → Cargos.
            </p>
          )}
        </div>
        {mode === 'create' && (
          <div className="col-12">
            <label className="admin-form__check">
              <input
                type="checkbox"
                checked={values.isActive}
                onChange={(e) => handleChange('isActive', e.target.checked)}
                disabled={loading}
              />
              <span>Cuenta activa</span>
            </label>
          </div>
        )}
      </div>
      <div className="admin-form__actions">
        <button
          type="button"
          className="admin-btn admin-btn--ghost"
          onClick={onCancel}
          disabled={loading}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="admin-btn admin-btn--primary"
          disabled={loading || catalogLoading}
        >
          {loading ? 'Guardando…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
