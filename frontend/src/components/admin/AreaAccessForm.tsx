import { useEffect, useState, type FormEvent } from 'react';
import type { Area } from '../../api/areas.types';
import { Select } from '../ui/Select';

export interface AreaAccessFormValues {
  sourceAreaId: string;
  targetAreaId: string;
  canRead: boolean;
  canUpload: boolean;
  canApprove: boolean;
  canAnnounce: boolean;
  isActive: boolean;
}

interface AreaAccessFormProps {
  areas: Area[];
  initialValues?: Partial<AreaAccessFormValues>;
  submitLabel: string;
  loading?: boolean;
  onSubmit: (values: AreaAccessFormValues) => void | Promise<void>;
  onCancel: () => void;
}

const defaults: AreaAccessFormValues = {
  sourceAreaId: '',
  targetAreaId: '',
  canRead: true,
  canUpload: false,
  canApprove: false,
  canAnnounce: false,
  isActive: true,
};

export function AreaAccessForm({
  areas,
  initialValues,
  submitLabel,
  loading = false,
  onSubmit,
  onCancel,
}: AreaAccessFormProps) {
  const [values, setValues] = useState<AreaAccessFormValues>({ ...defaults, ...initialValues });
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (initialValues) {
      setValues((current) => ({ ...defaults, ...current, ...initialValues }));
    }
  }, [initialValues]);

  const activeAreas = areas.filter((a) => a.isActive);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!values.sourceAreaId || !values.targetAreaId) {
      setFormError('Seleccione área origen y destino');
      return;
    }
    if (values.sourceAreaId === values.targetAreaId) {
      setFormError('El área origen y destino deben ser distintas');
      return;
    }
    if (!values.canRead && !values.canUpload && !values.canApprove && !values.canAnnounce) {
      setFormError('Debe habilitar al menos un permiso');
      return;
    }

    void onSubmit(values);
  };

  return (
    <form className="admin-form card-style mb-30" onSubmit={handleSubmit}>
      {formError && <div className="admin-alert admin-alert--error mb-20">{formError}</div>}

      <p className="admin-form__hint mb-20">
        Define qué puede hacer el personal del <strong>área origen</strong> sobre el{' '}
        <strong>área destino</strong> (documentos y comunicados).
      </p>

      <div className="admin-form__grid">
        <div className="admin-form__field">
          <label className="admin-form__label" htmlFor="sourceAreaId">
            Área origen
          </label>
          <Select
            id="sourceAreaId"
            value={values.sourceAreaId}
            onChange={(v) => setValues((prev) => ({ ...prev, sourceAreaId: v }))}
            required
            placeholder="Seleccionar…"
            options={activeAreas.map((area) => ({ value: String(area.id), label: area.name }))}
          />
        </div>

        <div className="admin-form__field">
          <label className="admin-form__label" htmlFor="targetAreaId">
            Área destino
          </label>
          <Select
            id="targetAreaId"
            value={values.targetAreaId}
            onChange={(v) => setValues((prev) => ({ ...prev, targetAreaId: v }))}
            required
            placeholder="Seleccionar…"
            options={activeAreas.map((area) => ({ value: String(area.id), label: area.name }))}
          />
        </div>

        <div className="admin-form__field admin-form__field--full">
          <span className="admin-form__label">Permisos</span>
          <div className="admin-form__checkbox-group">
            <label className="admin-form__checkbox">
              <input
                type="checkbox"
                checked={values.canRead}
                onChange={(e) => setValues((v) => ({ ...v, canRead: e.target.checked }))}
              />
              Ver documentos aprobados
            </label>
            <label className="admin-form__checkbox">
              <input
                type="checkbox"
                checked={values.canUpload}
                onChange={(e) => setValues((v) => ({ ...v, canUpload: e.target.checked }))}
              />
              Subir documentos
            </label>
            <label className="admin-form__checkbox">
              <input
                type="checkbox"
                checked={values.canApprove}
                onChange={(e) => setValues((v) => ({ ...v, canApprove: e.target.checked }))}
              />
              Aprobar / rechazar
            </label>
            <label className="admin-form__checkbox">
              <input
                type="checkbox"
                checked={values.canAnnounce}
                onChange={(e) => setValues((v) => ({ ...v, canAnnounce: e.target.checked }))}
              />
              Enviar comunicados
            </label>
          </div>
        </div>

        <div className="admin-form__field">
          <label className="admin-form__checkbox">
            <input
              type="checkbox"
              checked={values.isActive}
              onChange={(e) => setValues((v) => ({ ...v, isActive: e.target.checked }))}
            />
            Excepción activa
          </label>
        </div>
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
        <button type="submit" className="admin-btn admin-btn--primary" disabled={loading}>
          {loading ? 'Guardando…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
