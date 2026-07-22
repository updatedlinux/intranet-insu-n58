import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LifeBuoy, X } from 'lucide-react';
import { ApiError } from '../../api/client';
import { createRequest, fetchTargetAreas } from '../../api/requests';
import type { CreateRequestData, RequestPriority } from '../../api/requests.types';
import { Select } from '../ui/Select';

interface RequestCreateModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function RequestCreateModal({ open, onClose, onCreated }: RequestCreateModalProps) {
  const [areas, setAreas] = useState<{ id: number; name: string }[]>([]);
  const [title, setTitle] = useState('');
  const [targetAreaId, setTargetAreaId] = useState('');
  const [priority, setPriority] = useState<RequestPriority>('Medium');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    void fetchTargetAreas()
      .then((res) => setAreas(res.items))
      .catch(() => setAreas([]));
  }, [open]);

  useEffect(() => {
    if (!open) {
      setTitle('');
      setTargetAreaId('');
      setPriority('Medium');
      setDescription('');
      setError('');
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const areaId = Number.parseInt(targetAreaId, 10);
    if (!title.trim() || !description.trim() || !Number.isInteger(areaId)) {
      setError('Complete título, área destino y descripción');
      return;
    }
    setSubmitting(true);
    try {
      const data: CreateRequestData = {
        targetAreaId: areaId,
        title: title.trim(),
        description: description.trim(),
        priority,
      };
      await createRequest(data);
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la solicitud');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="admin-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="admin-modal req-create-modal card-style"
        role="dialog"
        aria-labelledby="req-create-title"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="req-create-modal__header">
          <h2 id="req-create-title" className="req-create-modal__title">
            Nueva solicitud
          </h2>
          <button
            type="button"
            className="req-create-modal__close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={22} strokeWidth={2} aria-hidden />
          </button>
        </div>

        <div className="req-sd-banner req-sd-banner--prominent">
          <span className="req-sd-banner__icon" aria-hidden>
            <LifeBuoy size={24} />
          </span>
          <div className="req-sd-banner__text">
            <strong className="req-sd-banner__title">¿Necesitas soporte técnico?</strong>
            <p className="req-sd-banner__body">
              Las solicitudes de TI (incidencias, accesos, equipos) se gestionan en el módulo{' '}
              <Link to="/service-desk/nuevo">Soporte TI</Link>, no en solicitudes internas.
            </p>
          </div>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="admin-form">
          {error && <div className="admin-alert admin-alert--error mb-20">{error}</div>}

          <div className="admin-form__field">
            <label className="admin-form__label" htmlFor="req-title">
              Título *
            </label>
            <input
              id="req-title"
              className="admin-form__input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={300}
              required
            />
          </div>

          <div className="admin-form__field">
            <label className="admin-form__label" htmlFor="req-area">
              Área destino *
            </label>
            <Select
              id="req-area"
              value={targetAreaId}
              onChange={setTargetAreaId}
              required
              placeholder="Seleccione un área"
              options={areas.map((a) => ({ value: String(a.id), label: a.name }))}
            />
          </div>

          <div className="admin-form__field">
            <label className="admin-form__label" htmlFor="req-priority">
              Prioridad
            </label>
            <Select
              id="req-priority"
              value={priority}
              onChange={(v) => setPriority(v as RequestPriority)}
              options={[
                { value: 'Low', label: 'Baja' },
                { value: 'Medium', label: 'Media' },
                { value: 'High', label: 'Alta' },
              ]}
            />
          </div>

          <div className="admin-form__field">
            <label className="admin-form__label" htmlFor="req-desc">
              Descripción *
            </label>
            <textarea
              id="req-desc"
              className="admin-form__input"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="admin-modal__footer">
            <button type="button" className="admin-btn admin-btn--ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="admin-btn admin-btn--primary" disabled={submitting}>
              {submitting ? 'Enviando…' : 'Enviar solicitud'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
