import { useEffect, useState, type FormEvent } from 'react';
import type { Area } from '../../api/areas.types';
import type { Collaborator } from '../../api/collaborators.types';
import { Select } from '../ui/Select';

export interface ChatExceptionFormValues {
  userId: string;
  areaId: string;
  notes: string;
  isActive: boolean;
}

interface ChatExceptionFormProps {
  areas: Area[];
  collaborators: Collaborator[];
  initialValues?: Partial<ChatExceptionFormValues>;
  submitLabel: string;
  loading?: boolean;
  onSubmit: (values: ChatExceptionFormValues) => void | Promise<void>;
  onCancel: () => void;
}

const defaults: ChatExceptionFormValues = {
  userId: '',
  areaId: '',
  notes: '',
  isActive: true,
};

export function ChatExceptionForm({
  areas,
  collaborators,
  initialValues,
  submitLabel,
  loading = false,
  onSubmit,
  onCancel,
}: ChatExceptionFormProps) {
  const [values, setValues] = useState<ChatExceptionFormValues>({ ...defaults, ...initialValues });
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (initialValues) {
      setValues((current) => ({ ...defaults, ...current, ...initialValues }));
    }
  }, [initialValues]);

  const activeAreas = areas.filter((a) => a.isActive);
  const activeCollaborators = collaborators.filter((c) => c.isActive);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!values.userId) {
      setFormError('Seleccione un colaborador.');
      return;
    }
    if (!values.areaId) {
      setFormError('Seleccione el chat grupal de la unidad.');
      return;
    }

    await onSubmit(values);
  };

  return (
    <form className="admin-form" onSubmit={(e) => void handleSubmit(e)}>
      {formError ? <div className="admin-alert admin-alert--error mb-20">{formError}</div> : null}

      <div className="admin-form__grid">
        <div className="admin-form__field admin-form__field--full">
          <label className="admin-form__label" htmlFor="chat-exception-user">
            Colaborador
          </label>
          <Select
            id="chat-exception-user"
            value={values.userId}
            onChange={(v) => setValues((prev) => ({ ...prev, userId: v }))}
            placeholder="Seleccionar colaborador…"
            options={activeCollaborators.map((c) => ({
              value: String(c.id),
              label: `${c.firstName} ${c.lastName} — ${c.area.name}`,
            }))}
          />
          <p className="admin-form__hint">
            Persona que necesita acceder al chat grupal de otra unidad distinta a la suya.
          </p>
        </div>

        <div className="admin-form__field admin-form__field--full">
          <label className="admin-form__label" htmlFor="chat-exception-area">
            Chat grupal de la unidad
          </label>
          <Select
            id="chat-exception-area"
            value={values.areaId}
            onChange={(v) => setValues((prev) => ({ ...prev, areaId: v }))}
            placeholder="Seleccionar unidad…"
            options={activeAreas.map((a) => ({ value: String(a.id), label: a.name }))}
          />
        </div>

        <div className="admin-form__field admin-form__field--full">
          <label className="admin-form__label" htmlFor="chat-exception-notes">
            Motivo / notas
          </label>
          <textarea
            id="chat-exception-notes"
            className="admin-form__input"
            rows={3}
            maxLength={500}
            placeholder="Ej.: Gerente de TTHH con responsabilidades sobre Administración"
            value={values.notes}
            onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
          />
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
