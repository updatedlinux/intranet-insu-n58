import { useEffect, useMemo, useState } from 'react';
import { fetchAreas } from '../../api/areas';
import type { Area, AreaLeader } from '../../api/areas.types';
import {
  CollaboratorSearchMultiSelect,
  type CollaboratorOption,
} from './CollaboratorSearchMultiSelect';
import { Select } from '../ui/Select';

export interface AreaFormValues {
  name: string;
  description: string;
  parentAreaId: string;
  isActive: boolean;
  isItSupportArea: boolean;
  leaderIds: number[];
}

interface AreaFormProps {
  initialValues?: Partial<AreaFormValues>;
  initialLeaders?: AreaLeader[];
  excludeAreaId?: number;
  submitLabel: string;
  loading?: boolean;
  onSubmit: (values: AreaFormValues) => void;
  onCancel: () => void;
}

const emptyValues: AreaFormValues = {
  name: '',
  description: '',
  parentAreaId: '',
  isActive: true,
  isItSupportArea: false,
  leaderIds: [],
};

function leadersToOptions(leaders: AreaLeader[]): CollaboratorOption[] {
  return leaders.map((l) => ({
    id: l.id,
    label: `${l.firstName} ${l.lastName}`.trim(),
    detail: `${l.areaName} · ${l.positionName}`,
  }));
}

export function AreaForm({
  initialValues,
  initialLeaders = [],
  excludeAreaId,
  submitLabel,
  loading = false,
  onSubmit,
  onCancel,
}: AreaFormProps) {
  const [values, setValues] = useState<AreaFormValues>({ ...emptyValues, ...initialValues });
  const [parentOptions, setParentOptions] = useState<Area[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const leaderOptions = useMemo(() => leadersToOptions(initialLeaders), [initialLeaders]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetchAreas({ isActive: true });
        if (!active) return;
        const filtered = res.items.filter((a) => a.id !== excludeAreaId);
        setParentOptions(filtered);
      } finally {
        if (active) setCatalogLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [excludeAreaId]);

  const handleChange = (
    field: keyof Omit<AreaFormValues, 'leaderIds'>,
    value: string | boolean,
  ) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleLeadersChange = (leaderIds: number[]) => {
    setValues((prev) => ({ ...prev, leaderIds }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(values);
  };

  return (
    <form className="admin-form card-style mb-30" onSubmit={handleSubmit}>
      <div className="row g-3">
        <div className="col-md-6">
          <label className="admin-form__label" htmlFor="areaName">
            Nombre
          </label>
          <input
            id="areaName"
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
          <label className="admin-form__label" htmlFor="parentAreaId">
            Área padre
          </label>
          <Select
            id="parentAreaId"
            value={values.parentAreaId}
            onChange={(v) => handleChange('parentAreaId', v)}
            disabled={loading || catalogLoading}
            options={[
              { value: '', label: 'Sin área padre' },
              ...parentOptions.map((a) => ({ value: String(a.id), label: a.name })),
            ]}
          />
        </div>
        <div className="col-12">
          <label className="admin-form__label" htmlFor="areaLeaders">
            Líderes de área
          </label>
          <p className="admin-form__hint mb-2">
            Asigne uno o más colaboradores como líderes de esta unidad, independientemente de su
            cargo. Una misma persona puede liderar varias áreas.
          </p>
          <CollaboratorSearchMultiSelect
            id="areaLeaders"
            value={values.leaderIds}
            onChange={handleLeadersChange}
            initialOptions={leaderOptions}
            disabled={loading}
          />
        </div>
        <div className="col-12">
          <label className="admin-form__label" htmlFor="description">
            Descripción
          </label>
          <textarea
            id="description"
            className="admin-form__input admin-form__textarea"
            value={values.description}
            onChange={(e) => handleChange('description', e.target.value)}
            rows={3}
            maxLength={500}
            disabled={loading}
            placeholder="Opcional"
          />
        </div>
        <div className="col-12">
          <label className="admin-form__check">
            <input
              type="checkbox"
              checked={values.isItSupportArea}
              onChange={(e) => handleChange('isItSupportArea', e.target.checked)}
              disabled={loading}
            />
            <span>Área de Soporte TI</span>
          </label>
          <p className="admin-form__hint mb-0">
            Los colaboradores de esta unidad acceden a la mesa de ayuda, inventario TI y dashboard
            de soporte. Puede marcar más de un área.
          </p>
        </div>
        <div className="col-12">
          <label className="admin-form__check">
            <input
              type="checkbox"
              checked={values.isActive}
              onChange={(e) => handleChange('isActive', e.target.checked)}
              disabled={loading}
            />
            <span>Área activa</span>
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
