import { useEffect, useState } from 'react';
import { fetchAreas } from '../../api/areas';
import type { Area } from '../../api/areas.types';
import { Select } from '../ui/Select';

export interface PositionFormValues {
  name: string;
  areaId: string;
  isLeader: boolean;
  isActive: boolean;
}

interface PositionFormProps {
  initialValues?: Partial<PositionFormValues>;
  submitLabel: string;
  loading?: boolean;
  onSubmit: (values: PositionFormValues) => void;
  onCancel: () => void;
}

const emptyValues: PositionFormValues = {
  name: '',
  areaId: '',
  isLeader: false,
  isActive: true,
};

export function PositionForm({
  initialValues,
  submitLabel,
  loading = false,
  onSubmit,
  onCancel,
}: PositionFormProps) {
  const [values, setValues] = useState<PositionFormValues>({ ...emptyValues, ...initialValues });
  const [areas, setAreas] = useState<Area[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetchAreas({ isActive: true });
        if (!active) return;
        setAreas(res.items);
      } finally {
        if (active) setCatalogLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleChange = (field: keyof PositionFormValues, value: string | boolean) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(values);
  };

  return (
    <form className="admin-form card-style mb-30" onSubmit={handleSubmit}>
      <div className="row g-3">
        <div className="col-md-6">
          <label className="admin-form__label" htmlFor="positionName">
            Nombre
          </label>
          <input
            id="positionName"
            className="admin-form__input"
            value={values.name}
            onChange={(e) => handleChange('name', e.target.value)}
            required
            minLength={2}
            maxLength={200}
            disabled={loading}
          />
        </div>
        <div className="col-md-6">
          <label className="admin-form__label" htmlFor="positionAreaId">
            Área
          </label>
          <Select
            id="positionAreaId"
            value={values.areaId}
            onChange={(v) => handleChange('areaId', v)}
            required
            disabled={loading || catalogLoading}
            placeholder="Seleccionar área"
            options={areas.map((a) => ({ value: String(a.id), label: a.name }))}
          />
        </div>
        <div className="col-12">
          <label className="admin-form__check">
            <input
              type="checkbox"
              checked={values.isLeader}
              onChange={(e) => handleChange('isLeader', e.target.checked)}
              disabled={loading}
            />
            <span>Gerente / líder de área (puede crear carpetas y aprobar documentos)</span>
          </label>
        </div>
        <div className="col-12">
          <label className="admin-form__check">
            <input
              type="checkbox"
              checked={values.isActive}
              onChange={(e) => handleChange('isActive', e.target.checked)}
              disabled={loading}
            />
            <span>Cargo activo</span>
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
