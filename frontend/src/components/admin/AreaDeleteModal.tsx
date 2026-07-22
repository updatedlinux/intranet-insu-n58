import { useEffect, useState } from 'react';
import type { Area, AreaDeletePreview, AreaDeleteTaskAction } from '../../api/areas.types';
import { fetchAreaDeletePreview } from '../../api/areas';
import { Select } from '../ui/Select';

interface AreaDeleteModalProps {
  area: Area | null;
  areas: Area[];
  loading?: boolean;
  onConfirm: (payload: { taskAction?: AreaDeleteTaskAction; transferToAreaId?: number }) => void;
  onCancel: () => void;
}

export function AreaDeleteModal({
  area,
  areas,
  loading = false,
  onConfirm,
  onCancel,
}: AreaDeleteModalProps) {
  const [preview, setPreview] = useState<AreaDeletePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [taskAction, setTaskAction] = useState<AreaDeleteTaskAction>('transfer');
  const [transferToAreaId, setTransferToAreaId] = useState('');

  useEffect(() => {
    if (!area) {
      setPreview(null);
      setPreviewError('');
      setTaskAction('transfer');
      setTransferToAreaId('');
      return;
    }

    let active = true;
    setPreviewLoading(true);
    setPreviewError('');
    void fetchAreaDeletePreview(area.id)
      .then((res) => {
        if (!active) return;
        setPreview(res.preview);
      })
      .catch(() => {
        if (!active) return;
        setPreviewError('No se pudo cargar el resumen de eliminación.');
      })
      .finally(() => {
        if (active) setPreviewLoading(false);
      });

    return () => {
      active = false;
    };
  }, [area]);

  if (!area) return null;

  const transferOptions = areas
    .filter((item) => item.id !== area.id && item.isActive)
    .map((item) => ({ value: String(item.id), label: item.name }));

  const handleConfirm = () => {
    if (preview?.requiresTaskDecision) {
      if (taskAction === 'transfer') {
        if (!transferToAreaId) return;
        onConfirm({
          taskAction: 'transfer',
          transferToAreaId: Number.parseInt(transferToAreaId, 10),
        });
        return;
      }
      onConfirm({ taskAction: 'delete' });
      return;
    }
    onConfirm({});
  };

  const confirmDisabled =
    loading ||
    previewLoading ||
    previewError !== '' ||
    (preview != null && preview.childAreas > 0) ||
    (preview != null && preview.collaborators > 0) ||
    (preview?.requiresTaskDecision && taskAction === 'transfer' && !transferToAreaId);

  return (
    <div className="admin-modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="admin-modal admin-modal--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="area-delete-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="area-delete-modal-title" className="admin-modal__title">
          Eliminar área
        </h3>
        <div className="admin-modal__body">
          <p>
            ¿Eliminar el área <strong>{area.name}</strong>? Esta acción no se puede deshacer.
          </p>

          {previewLoading ? <p className="text-gray mb-0">Analizando dependencias…</p> : null}
          {previewError ? <p className="admin-modal__warning">{previewError}</p> : null}

          {preview ? (
            <>
              {(preview.documents > 0 || preview.folders > 0) && (
                <p className="admin-modal__warning mt-2">
                  Las carpetas y documentos ({preview.documents} documento
                  {preview.documents === 1 ? '' : 's'}, {preview.folders} carpeta
                  {preview.folders === 1 ? '' : 's'}) se conservarán y se marcarán con la etiqueta{' '}
                  <strong>Área eliminada</strong>.
                </p>
              )}

              {preview.collaborators > 0 && (
                <p className="admin-modal__warning mt-2">
                  Hay {preview.collaborators} colaborador
                  {preview.collaborators === 1 ? '' : 'es'} asignado
                  {preview.collaborators === 1 ? '' : 's'}. Debe reasignarlos antes de eliminar.
                </p>
              )}

              {preview.childAreas > 0 && (
                <p className="admin-modal__warning mt-2">
                  Hay {preview.childAreas} área{preview.childAreas === 1 ? '' : 's'} hija
                  {preview.childAreas === 1 ? '' : 's'}. Elimine o reubique las subáreas primero.
                </p>
              )}

              {preview.requiresTaskDecision ? (
                <div className="admin-form mt-3">
                  <p className="admin-form__label mb-2">
                    Este área tiene {preview.tasks} tarea{preview.tasks === 1 ? '' : 's'} en su
                    tablero. ¿Qué desea hacer?
                  </p>
                  <label className="admin-form__check mb-2">
                    <input
                      type="radio"
                      name="taskAction"
                      checked={taskAction === 'transfer'}
                      onChange={() => setTaskAction('transfer')}
                      disabled={loading}
                    />
                    <span>Transferir tareas a otra área</span>
                  </label>
                  {taskAction === 'transfer' ? (
                    <div className="mb-3 ms-4">
                      <Select
                        value={transferToAreaId}
                        onChange={setTransferToAreaId}
                        placeholder="Seleccionar área destino"
                        options={transferOptions}
                        disabled={loading}
                      />
                    </div>
                  ) : null}
                  <label className="admin-form__check">
                    <input
                      type="radio"
                      name="taskAction"
                      checked={taskAction === 'delete'}
                      onChange={() => setTaskAction('delete')}
                      disabled={loading}
                    />
                    <span>Eliminar todas las tareas definitivamente</span>
                  </label>
                  {taskAction === 'delete' ? (
                    <p className="admin-modal__warning mt-2 mb-0">
                      Se borrarán permanentemente las tareas, comentarios, adjuntos y asignaciones
                      vinculadas.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
        <div className="admin-modal__actions">
          <button
            type="button"
            className="admin-btn admin-btn--ghost"
            onClick={onCancel}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--danger"
            onClick={handleConfirm}
            disabled={confirmDisabled}
          >
            {loading ? 'Eliminando…' : 'Eliminar área'}
          </button>
        </div>
      </div>
    </div>
  );
}
