import { useEffect, useState, type FormEvent } from 'react';

export interface TicketCategoryFormValues {
  name: string;
  description: string;
  sortOrder: string;
  isActive: boolean;
}

interface TicketCategoryFormProps {
  initialValues?: Partial<TicketCategoryFormValues>;
  submitLabel: string;
  loading?: boolean;
  onSubmit: (values: TicketCategoryFormValues) => void | Promise<void>;
  onCancel: () => void;
}

const defaults: TicketCategoryFormValues = {
  name: '',
  description: '',
  sortOrder: '0',
  isActive: true,
};

export function TicketCategoryForm({
  initialValues,
  submitLabel,
  loading = false,
  onSubmit,
  onCancel,
}: TicketCategoryFormProps) {
  const [values, setValues] = useState<TicketCategoryFormValues>({ ...defaults, ...initialValues });
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (initialValues) {
      setValues((current) => ({ ...defaults, ...current, ...initialValues }));
    }
  }, [initialValues]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!values.name.trim()) {
      setFormError('El nombre es obligatorio');
      return;
    }
    void onSubmit(values);
  };

  return (
    <form className="admin-form card-style mb-30" onSubmit={handleSubmit}>
      {formError && <div className="admin-alert admin-alert--error mb-20">{formError}</div>}

      <p className="admin-form__hint mb-20">
        Las categorías activas aparecen al crear tickets en Service Desk. Use el orden para definir
        cómo se listan en los formularios.
      </p>

      <div className="admin-form__grid">
        <div className="admin-form__field admin-form__field--full">
          <label className="admin-form__label" htmlFor="tcName">
            Nombre
          </label>
          <input
            id="tcName"
            className="admin-form__input"
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            required
            maxLength={100}
          />
        </div>

        <div className="admin-form__field admin-form__field--full">
          <label className="admin-form__label" htmlFor="tcDesc">
            Descripción
          </label>
          <textarea
            id="tcDesc"
            className="admin-form__input"
            rows={3}
            value={values.description}
            onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
            maxLength={500}
          />
        </div>

        <div className="admin-form__field">
          <label className="admin-form__label" htmlFor="tcOrder">
            Orden
          </label>
          <input
            id="tcOrder"
            type="number"
            min={0}
            className="admin-form__input"
            value={values.sortOrder}
            onChange={(e) => setValues((v) => ({ ...v, sortOrder: e.target.value }))}
          />
        </div>

        <div className="admin-form__field">
          <label className="admin-form__checkbox">
            <input
              type="checkbox"
              checked={values.isActive}
              onChange={(e) => setValues((v) => ({ ...v, isActive: e.target.checked }))}
            />
            Categoría activa
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
