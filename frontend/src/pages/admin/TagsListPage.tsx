import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Tag as TagIcon } from 'lucide-react';
import { ApiError } from '../../api/client';
import { fetchTags, toggleTagStatus, deleteTag } from '../../api/tags';
import type { DocTag } from '../../api/tags.types';
import { AdminGovernanceBanner } from '../../components/admin/AdminGovernanceBanner';
import { ConfirmModal } from '../../components/admin/ConfirmModal';
import { PageHeader } from '../../components/layout';
import { Select } from '../../components/ui/Select';

type PendingToggle = { tag: DocTag; isActive: boolean };

function StatusBadge({ active }: { active: boolean }) {
  if (!active) {
    return <span className="admin-badge admin-badge--inactive">Inactiva</span>;
  }
  return <span className="admin-badge admin-badge--active">Activa</span>;
}

export function TagsListPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<DocTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [pending, setPending] = useState<PendingToggle | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DocTag | null>(null);

  const [nameFilter, setNameFilter] = useState('');
  const [isActiveFilter, setIsActiveFilter] = useState('');

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchTags({
        name: nameFilter || undefined,
        isActive: isActiveFilter === '' ? undefined : isActiveFilter === 'true',
      });
      setItems(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar el listado');
    } finally {
      setLoading(false);
    }
  }, [nameFilter, isActiveFilter]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const runToggle = async (tag: DocTag, isActive: boolean) => {
    setActionLoading(true);
    setError('');
    try {
      await toggleTagStatus(tag.id, isActive);
      await loadList();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo completar la acción');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmToggle = async () => {
    if (!pending) return;
    const { tag, isActive } = pending;
    setPending(null);
    await runToggle(tag, isActive);
  };

  const runDelete = async () => {
    if (!pendingDelete) return;
    setActionLoading(true);
    setError('');
    try {
      await deleteTag(pendingDelete.id);
      setPendingDelete(null);
      await loadList();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar la etiqueta');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Etiquetas"
        breadcrumbParent="Administración"
        breadcrumbCurrent="Etiquetas"
        breadcrumbParentHref="/admin/tags"
      />

      {error && <div className="admin-alert admin-alert--error mb-20">{error}</div>}

      <AdminGovernanceBanner title="Etiquetas de documentos" variant="support-ti">
        <p>
          Clasifican los documentos del repositorio corporativo. Una etiqueta inactiva con
          documentos asociados no puede deshabilitarse hasta reasignarlos.
        </p>
      </AdminGovernanceBanner>

      <div className="learning-manage-toolbar card-style mb-30">
        <div className="learning-manage-toolbar__filters">
          <input
            className="admin-form__input admin-form__input--sm"
            placeholder="Filtrar por nombre…"
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
          />
          <Select
            value={isActiveFilter}
            onChange={setIsActiveFilter}
            options={[
              { value: '', label: 'Todos los estados' },
              { value: 'true', label: 'Activas' },
              { value: 'false', label: 'Inactivas' },
            ]}
          />
        </div>
        <div className="learning-manage-toolbar__actions">
          <Link to="/admin/tags/nuevo" className="admin-btn admin-btn--primary">
            <Plus size={16} aria-hidden />
            Nueva etiqueta
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

      <div className="card-style admin-data-library mb-30">
        <div className="admin-data-list admin-data-list--tags" role="grid" aria-label="Etiquetas">
          <div className="admin-data-list__header" role="row">
            <div role="columnheader">Nombre</div>
            <div role="columnheader">Descripción</div>
            <div className="admin-data-list__cell--center" role="columnheader">
              Documentos
            </div>
            <div className="admin-data-list__cell--center" role="columnheader">
              Estado
            </div>
            <div className="admin-data-list__cell--end" role="columnheader">
              Acciones
            </div>
          </div>
          <div className="admin-data-list__body">
            {loading ? (
              <div className="admin-data-list__empty">Cargando…</div>
            ) : items.length === 0 ? (
              <div className="learning-manage-empty">
                <TagIcon size={32} strokeWidth={1.5} aria-hidden />
                <p>No hay etiquetas registradas.</p>
                <Link to="/admin/tags/nuevo" className="admin-link">
                  Crear la primera etiqueta
                </Link>
              </div>
            ) : (
              items.map((tag) => (
                <div key={tag.id} className="admin-data-list__row" role="row">
                  <div className="admin-data-list__name" role="cell" title={tag.name}>
                    <button
                      type="button"
                      className="admin-link-btn"
                      onClick={() => navigate(`/admin/tags/${tag.id}/editar`)}
                    >
                      {tag.name}
                    </button>
                  </div>
                  <div
                    className="admin-data-list__desc"
                    role="cell"
                    title={tag.description ?? undefined}
                  >
                    {tag.description ?? '—'}
                  </div>
                  <div className="admin-data-list__count admin-data-list__cell--center" role="cell">
                    {tag.documentCount}
                  </div>
                  <div className="admin-data-list__cell--center" role="cell">
                    <StatusBadge active={tag.isActive} />
                  </div>
                  <div className="admin-data-list__cell--end" role="cell">
                    <div className="admin-row-actions">
                      <button
                        type="button"
                        className="admin-btn admin-btn--ghost admin-btn--sm"
                        onClick={() => navigate(`/admin/tags/${tag.id}/editar`)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn--ghost admin-btn--sm"
                        onClick={() =>
                          tag.isActive && tag.documentCount > 0
                            ? setPending({ tag, isActive: false })
                            : void runToggle(tag, !tag.isActive)
                        }
                        disabled={actionLoading}
                      >
                        {tag.isActive ? 'Inactivar' : 'Activar'}
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn--ghost admin-btn--sm"
                        onClick={() => setPendingDelete(tag)}
                        disabled={actionLoading}
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {!loading && items.length > 0 && (
          <footer className="admin-data-library__footer">
            {items.length === 1 ? '1 etiqueta' : `${items.length} etiquetas`}
          </footer>
        )}
      </div>

      <ConfirmModal
        open={pending != null}
        title="Inactivar etiqueta"
        message={
          pending ? (
            <>
              La etiqueta <strong>{pending.tag.name}</strong> está asociada a{' '}
              {pending.tag.documentCount} documento(s). ¿Desea inactivarla de todas formas?
            </>
          ) : null
        }
        variant="danger"
        loading={actionLoading}
        confirmLabel="Inactivar"
        onConfirm={handleConfirmToggle}
        onCancel={() => setPending(null)}
      />

      <ConfirmModal
        open={pendingDelete != null}
        title="Eliminar etiqueta"
        message={
          pendingDelete ? (
            pendingDelete.documentCount > 0 ? (
              <>
                La etiqueta <strong>{pendingDelete.name}</strong> tiene{' '}
                {pendingDelete.documentCount} documento(s). Reasígnelos antes de eliminar.
              </>
            ) : (
              <>
                ¿Eliminar la etiqueta <strong>{pendingDelete.name}</strong>? Esta acción no se puede
                deshacer.
              </>
            )
          ) : null
        }
        variant="danger"
        confirmLabel={pendingDelete?.documentCount ? 'Entendido' : 'Eliminar'}
        loading={actionLoading}
        onConfirm={() => (pendingDelete?.documentCount ? setPendingDelete(null) : void runDelete())}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}
