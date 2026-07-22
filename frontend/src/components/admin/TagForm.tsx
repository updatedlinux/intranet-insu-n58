import { useState, type FormEvent } from 'react';

export interface TagFormValues {
  name: string;
  description: string;
  isActive: boolean;
}

interface TagFormProps {
  initialValues?: Partial<TagFormValues>;
  submitLabel: string;
  loading?: boolean;
  onSubmit: (values: TagFormValues) => void | Promise<void>;
  onCancel: () => void;
}

const defaults: TagFormValues = {
  name: '',
  description: '',
  isActive: true,
};

export function TagForm({
  initialValues,
  submitLabel,
  loading = false,
  onSubmit,
  onCancel,
}: TagFormProps) {
  const [values, setValues] = useState<TagFormValues>({ ...defaults, ...initialValues });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void onSubmit(values);
  };

  return (
    <form className="admin-form card-style mb-30" onSubmit={handleSubmit}>
      <div className="admin-form__grid">
        <div className="admin-form__field admin-form__field--full">
          <label className="admin-form__label" htmlFor="tagName">
            Nombre
          </label>
          <input
            id="tagName"
            className="admin-form__input"
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            required
            maxLength={100}
          />
        </div>
        <div className="admin-form__field admin-form__field--full">
          <label className="admin-form__label" htmlFor="tagDescription">
            Descripción
          </label>
          <textarea
            id="tagDescription"
            className="admin-form__input"
            rows={3}
            value={values.description}
            onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
            maxLength={500}
          />
        </div>
        <div className="admin-form__field">
          <label className="admin-form__checkbox">
            <input
              type="checkbox"
              checked={values.isActive}
              onChange={(e) => setValues((v) => ({ ...v, isActive: e.target.checked }))}
            />
            Etiqueta activa
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
