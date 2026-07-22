import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Plus, RefreshCw, X } from 'lucide-react';
import { ApiError } from '../../api/client';
import {
  createAssetInventoryCategory,
  createConsumableInventoryCategory,
  deleteAssetInventoryCategory,
  deleteConsumableInventoryCategory,
  fetchAssetInventoryCategories,
  fetchConsumableInventoryCategories,
  updateAssetInventoryCategory,
  updateConsumableInventoryCategory,
} from '../../api/inventory-categories';
import type {
  AssetInventoryCategory,
  ConsumableInventoryCategory,
} from '../../api/inventory-categories.types';
import { AdminGovernanceBanner } from '../../components/admin/AdminGovernanceBanner';
import { ConfirmModal } from '../../components/admin/ConfirmModal';
import { PageHeader } from '../../components/layout';

type Tab = 'assets' | 'consumables';

export function InventoryCategoriesPage() {
  const [tab, setTab] = useState<Tab>('assets');

  return (
    <>
      <PageHeader
        title="Categorías de inventario"
        breadcrumbParent="Administración"
        breadcrumbCurrent="Categorías de inventario"
        breadcrumbParentHref="/admin/inventory-categories"
      />

      <AdminGovernanceBanner title="¿Qué gobierna esta sección?">
        <p>
          Administra las categorías del <strong>módulo Inventario TI</strong> (activos y
          consumibles). No modifica las categorías de tickets de Soporte TI.
        </p>
        <ul>
          <li>
            <strong>Activos:</strong> clasificación al registrar equipos (computación, red,
            impresión, etc.) en <code className="admin-code">/ti/inventario</code>.
          </li>
          <li>
            <strong>Consumibles:</strong> clasificación de insumos con stock (tóner, cables,
            repuestos, etc.).
          </li>
          <li>
            No se puede eliminar una categoría con ítems vinculados; reasigne o retire los registros
            antes.
          </li>
          <li>
            Es independiente de <strong>Categorías Soporte TI</strong> en Administración.
          </li>
        </ul>
      </AdminGovernanceBanner>

      <div className="req-toolbar card-style mb-20">
        <div className="req-tabs">
          <button
            type="button"
            className={`req-tabs__btn${tab === 'assets' ? ' is-active' : ''}`}
            onClick={() => setTab('assets')}
          >
            Activos
          </button>
          <button
            type="button"
            className={`req-tabs__btn${tab === 'consumables' ? ' is-active' : ''}`}
            onClick={() => setTab('consumables')}
          >
            Consumibles
          </button>
        </div>
      </div>

      {tab === 'assets' ? <AssetCategoriesPanel /> : <ConsumableCategoriesPanel />}
    </>
  );
}

function AssetCategoriesPanel() {
  const [items, setItems] = useState<AssetInventoryCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [modal, setModal] = useState<
    { mode: 'create' } | { mode: 'edit'; item: AssetInventoryCategory } | null
  >(null);
  const [pendingDelete, setPendingDelete] = useState<AssetInventoryCategory | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchAssetInventoryCategories(nameFilter || undefined);
      setItems(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar las categorías');
    } finally {
      setLoading(false);
    }
  }, [nameFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const runDelete = async () => {
    if (!pendingDelete) return;
    setActionLoading(true);
    setError('');
    try {
      await deleteAssetInventoryCategory(pendingDelete.id);
      setPendingDelete(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      {error && <div className="admin-alert admin-alert--error mb-20">{error}</div>}

      <CategoryDataList
        nameFilter={nameFilter}
        onNameFilterChange={setNameFilter}
        onRefresh={() => void load()}
        onNew={() => setModal({ mode: 'create' })}
        newLabel="Nueva categoría de activo"
        loading={loading}
        emptyMessage="No hay categorías de activos."
        columns={['Nombre', 'Descripción', 'Activos', 'Acciones']}
        rows={items.map((item) => (
          <CategoryRow
            key={item.id}
            name={item.name}
            description={item.description}
            itemCount={item.itemCount}
            itemLabel="activo"
            onEdit={() => setModal({ mode: 'edit', item })}
            onDelete={() => setPendingDelete(item)}
            deleteDisabled={actionLoading}
          />
        ))}
        footerCount={items.length}
        footerLabel="categoría"
      />

      {modal && (
        <AssetCategoryModal
          mode={modal.mode}
          item={modal.mode === 'edit' ? modal.item : undefined}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            void load();
          }}
        />
      )}

      <ConfirmModal
        open={pendingDelete != null}
        title="Eliminar categoría"
        message={
          pendingDelete ? (
            pendingDelete.itemCount > 0 ? (
              <>
                La categoría <strong>{pendingDelete.name}</strong> tiene {pendingDelete.itemCount}{' '}
                activo(s). Reasígnelos antes de eliminar.
              </>
            ) : (
              <>
                ¿Eliminar la categoría <strong>{pendingDelete.name}</strong>? Esta acción no se
                puede deshacer.
              </>
            )
          ) : null
        }
        variant="danger"
        confirmLabel={pendingDelete?.itemCount ? 'Entendido' : 'Eliminar'}
        onConfirm={() => (pendingDelete?.itemCount ? setPendingDelete(null) : void runDelete())}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}

function ConsumableCategoriesPanel() {
  const [items, setItems] = useState<ConsumableInventoryCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [modal, setModal] = useState<
    { mode: 'create' } | { mode: 'edit'; item: ConsumableInventoryCategory } | null
  >(null);
  const [pendingDelete, setPendingDelete] = useState<ConsumableInventoryCategory | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchConsumableInventoryCategories(nameFilter || undefined);
      setItems(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar las categorías');
    } finally {
      setLoading(false);
    }
  }, [nameFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const runDelete = async () => {
    if (!pendingDelete) return;
    setActionLoading(true);
    setError('');
    try {
      await deleteConsumableInventoryCategory(pendingDelete.id);
      setPendingDelete(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      {error && <div className="admin-alert admin-alert--error mb-20">{error}</div>}

      <CategoryDataList
        nameFilter={nameFilter}
        onNameFilterChange={setNameFilter}
        onRefresh={() => void load()}
        onNew={() => setModal({ mode: 'create' })}
        newLabel="Nueva categoría de consumible"
        loading={loading}
        emptyMessage="No hay categorías de consumibles."
        columns={['Nombre', 'Descripción', 'Consumibles', 'Acciones']}
        rows={items.map((item) => (
          <CategoryRow
            key={item.id}
            name={item.name}
            description={item.description}
            itemCount={item.itemCount}
            itemLabel="consumible"
            onEdit={() => setModal({ mode: 'edit', item })}
            onDelete={() => setPendingDelete(item)}
            deleteDisabled={actionLoading}
          />
        ))}
        footerCount={items.length}
        footerLabel="categoría"
      />

      {modal && (
        <ConsumableCategoryModal
          mode={modal.mode}
          item={modal.mode === 'edit' ? modal.item : undefined}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            void load();
          }}
        />
      )}

      <ConfirmModal
        open={pendingDelete != null}
        title="Eliminar categoría"
        message={
          pendingDelete ? (
            pendingDelete.itemCount > 0 ? (
              <>
                La categoría <strong>{pendingDelete.name}</strong> tiene {pendingDelete.itemCount}{' '}
                consumible(s). Reasígnelos antes de eliminar.
              </>
            ) : (
              <>
                ¿Eliminar la categoría <strong>{pendingDelete.name}</strong>? Esta acción no se
                puede deshacer.
              </>
            )
          ) : null
        }
        variant="danger"
        confirmLabel={pendingDelete?.itemCount ? 'Entendido' : 'Eliminar'}
        onConfirm={() => (pendingDelete?.itemCount ? setPendingDelete(null) : void runDelete())}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}

function CategoryDataList({
  nameFilter,
  onNameFilterChange,
  onRefresh,
  onNew,
  newLabel,
  loading,
  emptyMessage,
  columns,
  rows,
  footerCount,
  footerLabel,
  listClassName,
}: {
  nameFilter: string;
  onNameFilterChange: (v: string) => void;
  onRefresh: () => void;
  onNew: () => void;
  newLabel: string;
  loading: boolean;
  emptyMessage: string;
  columns: string[];
  rows: ReactNode[];
  footerCount: number;
  footerLabel: string;
  listClassName?: string;
}) {
  const listClass = listClassName ?? 'admin-data-list--inventory-categories';
  return (
    <>
      <div className="learning-manage-toolbar card-style mb-30">
        <div className="learning-manage-toolbar__filters">
          <input
            className="admin-form__input admin-form__input--sm"
            placeholder="Filtrar por nombre…"
            value={nameFilter}
            onChange={(e) => onNameFilterChange(e.target.value)}
          />
        </div>
        <div className="learning-manage-toolbar__actions">
          <button type="button" className="admin-btn admin-btn--primary" onClick={onNew}>
            <Plus size={16} aria-hidden />
            {newLabel}
          </button>
          <button type="button" className="admin-btn admin-btn--ghost" onClick={onRefresh}>
            <RefreshCw size={16} aria-hidden />
            Actualizar
          </button>
        </div>
      </div>

      <div className="card-style admin-data-library mb-30">
        <div className={`admin-data-list ${listClass}`} role="grid">
          <div className="admin-data-list__header" role="row">
            {columns.map((col, i) => (
              <div
                key={col}
                role="columnheader"
                className={
                  col === 'Acciones'
                    ? 'admin-data-list__cell--end'
                    : i >= 2 && col !== 'Nombre' && col !== 'Descripción'
                      ? 'admin-data-list__cell--center'
                      : undefined
                }
              >
                {col}
              </div>
            ))}
          </div>
          <div className="admin-data-list__body">
            {loading ? (
              <div className="admin-data-list__empty">Cargando…</div>
            ) : rows.length === 0 ? (
              <div className="admin-data-list__empty">{emptyMessage}</div>
            ) : (
              rows
            )}
          </div>
        </div>
        {!loading && footerCount > 0 && (
          <footer className="admin-data-library__footer">
            {footerCount === 1 ? `1 ${footerLabel}` : `${footerCount} ${footerLabel}s`}
          </footer>
        )}
      </div>
    </>
  );
}

function CategoryRow({
  name,
  description,
  itemCount,
  itemLabel,
  onEdit,
  onDelete,
  deleteDisabled,
}: {
  name: string;
  description: string | null;
  itemCount: number;
  itemLabel: string;
  onEdit: () => void;
  onDelete: () => void;
  deleteDisabled?: boolean;
}) {
  return (
    <div className="admin-data-list__row" role="row">
      <div className="admin-data-list__name" role="cell">
        <button type="button" className="admin-link-btn" onClick={onEdit}>
          {name}
        </button>
      </div>
      <div className="admin-data-list__desc" role="cell" title={description ?? undefined}>
        {description ?? '—'}
      </div>
      <div className="admin-data-list__count admin-data-list__cell--center" role="cell">
        {itemCount} {itemLabel}
        {itemCount === 1 ? '' : 's'}
      </div>
      <div className="admin-data-list__cell--end admin-data-list__cell--actions" role="cell">
        <div className="admin-row-actions">
          <button
            type="button"
            className="admin-btn admin-btn--ghost admin-btn--sm"
            onClick={onEdit}
          >
            Editar
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--ghost admin-btn--sm"
            onClick={onDelete}
            disabled={deleteDisabled}
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

function AssetCategoryModal({
  mode,
  item,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit';
  item?: AssetInventoryCategory;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(item?.name ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setError('');
    if (!name.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
      };
      if (mode === 'create') {
        await createAssetInventoryCategory(payload);
      } else if (item) {
        await updateAssetInventoryCategory(item.id, payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="admin-modal req-create-modal ti-inv-create-modal card-style"
        role="dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="req-create-modal__header">
          <h2 className="req-create-modal__title">
            {mode === 'create' ? 'Nueva categoría de activo' : 'Editar categoría de activo'}
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
        {error && <div className="admin-alert admin-alert--error mb-10">{error}</div>}
        <label className="admin-form__label">Nombre *</label>
        <input
          className="admin-form__input mb-10"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <label className="admin-form__label">Descripción</label>
        <textarea
          className="admin-form__input mb-10"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="ti-inv-create-modal__footer">
          <button type="button" className="admin-btn admin-btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConsumableCategoryModal({
  mode,
  item,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit';
  item?: ConsumableInventoryCategory;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(item?.name ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setError('');
    if (!name.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
      };
      if (mode === 'create') {
        await createConsumableInventoryCategory(payload);
      } else if (item) {
        await updateConsumableInventoryCategory(item.id, payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="admin-modal req-create-modal ti-inv-create-modal card-style"
        role="dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="req-create-modal__header">
          <h2 className="req-create-modal__title">
            {mode === 'create' ? 'Nueva categoría de consumible' : 'Editar categoría de consumible'}
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
        {error && <div className="admin-alert admin-alert--error mb-10">{error}</div>}
        <label className="admin-form__label">Nombre *</label>
        <input
          className="admin-form__input mb-10"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <label className="admin-form__label">Descripción</label>
        <textarea
          className="admin-form__input mb-10"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="ti-inv-create-modal__footer">
          <button type="button" className="admin-btn admin-btn--ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
