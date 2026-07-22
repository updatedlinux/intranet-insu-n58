import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, X } from 'lucide-react';
import { Select } from '../../components/ui/Select';
import { ApiError } from '../../api/client';
import {
  ASSET_STATUS_LABELS,
  CONSUMABLE_UNIT_LABELS,
  assignAsset,
  createAsset,
  createConsumable,
  deleteAssetPhoto,
  deleteConsumablePhoto,
  fetchAsset,
  fetchAssetCategories,
  fetchAssets,
  fetchConsumable,
  fetchConsumableCategories,
  fetchConsumables,
  fetchInventoryDashboard,
  fetchInventoryReports,
  stockAdjust,
  stockIn,
  stockOut,
  unassignAsset,
  updateAssetStatus,
  uploadAssetPhoto,
  uploadConsumablePhoto,
} from '../../api/inventory';
import type {
  Asset,
  AssetListFilters,
  AssetStatus,
  Consumable,
  InventoryDashboard,
} from '../../api/inventory.types';
import { PageHeader } from '../../components/layout';
import { fetchDirectory } from '../../api/directory';
import {
  AssetPhotoThumb,
  InventoryPhotoThumb,
} from '../../components/ti-inventory/AssetPhotoThumb';

type Tab = 'assets' | 'consumables' | 'reports';

export function InventoryPage() {
  const [tab, setTab] = useState<Tab>('assets');
  const [dash, setDash] = useState<InventoryDashboard | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [consumables, setConsumables] = useState<Consumable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);
  const [selectedConsumableId, setSelectedConsumableId] = useState<number | null>(null);
  const [assetModal, setAssetModal] = useState(false);
  const [consumableModal, setConsumableModal] = useState(false);
  const [assetFilters, setAssetFilters] = useState<AssetListFilters>({});
  const [groupByCategory, setGroupByCategory] = useState(false);
  const [assetCategories, setAssetCategories] = useState<{ id: number; name: string }[]>([]);

  const loadDash = useCallback(async () => {
    const d = await fetchInventoryDashboard();
    setDash(d);
  }, []);

  const loadAssets = useCallback(async () => {
    const res = await fetchAssets(assetFilters);
    setAssets(res.items);
  }, [assetFilters]);

  const loadConsumables = useCallback(async () => {
    const res = await fetchConsumables();
    setConsumables(res.items);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await loadDash();
      if (tab === 'assets') await loadAssets();
      else if (tab === 'consumables') await loadConsumables();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al cargar inventario');
    } finally {
      setLoading(false);
    }
  }, [tab, loadDash, loadAssets, loadConsumables]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (tab === 'assets') {
      void fetchAssetCategories().then((r) => setAssetCategories(r.items));
    }
  }, [tab]);

  return (
    <>
      <PageHeader
        title="Inventario TI"
        breadcrumbParent="Soporte TI"
        breadcrumbCurrent="Inventario"
        breadcrumbParentHref="/service-desk"
      />

      {dash && (
        <div className="ti-inv-cards mb-30">
          <div className="ti-inv-card">
            <span className="ti-inv-card__label">Activos</span>
            <strong className="ti-inv-card__value">{dash.totalAssets}</strong>
          </div>
          <div className="ti-inv-card">
            <span className="ti-inv-card__label">Asignados</span>
            <strong className="ti-inv-card__value">{dash.assignedAssets}</strong>
          </div>
          <div className="ti-inv-card">
            <span className="ti-inv-card__label">Disponibles</span>
            <strong className="ti-inv-card__value">{dash.availableAssets}</strong>
          </div>
          <div className="ti-inv-card">
            <span className="ti-inv-card__label">En mantenimiento</span>
            <strong className="ti-inv-card__value">{dash.maintenanceAssets}</strong>
          </div>
          <div className={`ti-inv-card${dash.hasLowStockAlert ? ' ti-inv-card--alert' : ''}`}>
            <span className="ti-inv-card__label">Stock crítico</span>
            <strong className="ti-inv-card__value">{dash.lowStockConsumables}</strong>
          </div>
        </div>
      )}

      <div className="req-toolbar card-style mb-20">
        <div className="req-tabs">
          {(['assets', 'consumables', 'reports'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`req-tabs__btn${tab === t ? ' is-active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'assets' ? 'Activos' : t === 'consumables' ? 'Consumibles' : 'Reportes'}
            </button>
          ))}
        </div>
        <div className="req-toolbar__actions">
          <button
            type="button"
            className="admin-btn admin-btn--ghost"
            onClick={() => void refresh()}
          >
            <RefreshCw size={16} /> Actualizar
          </button>
          {tab === 'assets' && (
            <button
              type="button"
              className="admin-btn admin-btn--primary"
              onClick={() => setAssetModal(true)}
            >
              <Plus size={16} /> Nuevo activo
            </button>
          )}
          {tab === 'consumables' && (
            <button
              type="button"
              className="admin-btn admin-btn--primary"
              onClick={() => setConsumableModal(true)}
            >
              <Plus size={16} /> Nuevo consumible
            </button>
          )}
        </div>
      </div>

      {error && <div className="admin-alert admin-alert--error mb-20">{error}</div>}
      {loading && <p className="text-gray">Cargando…</p>}

      {!loading && tab === 'assets' && (
        <>
          <AssetsFiltersBar
            categories={assetCategories}
            filters={assetFilters}
            groupByCategory={groupByCategory}
            onFiltersChange={setAssetFilters}
            onGroupByCategoryChange={setGroupByCategory}
            onApply={() => void loadAssets()}
            onClear={() => {
              setAssetFilters({});
              setGroupByCategory(false);
              void fetchAssets().then((r) => setAssets(r.items));
            }}
          />
          <AssetsTable
            items={assets}
            groupByCategory={groupByCategory}
            onSelect={setSelectedAssetId}
            selectedId={selectedAssetId}
            onChanged={() => void refresh()}
          />
        </>
      )}
      {!loading && tab === 'consumables' && (
        <ConsumablesTable
          items={consumables}
          onSelect={setSelectedConsumableId}
          selectedId={selectedConsumableId}
          onChanged={() => void refresh()}
        />
      )}
      {!loading && tab === 'reports' && <ReportsTab />}

      {assetModal && (
        <AssetCreateModal
          onClose={() => setAssetModal(false)}
          onCreated={() => {
            setAssetModal(false);
            void refresh();
          }}
        />
      )}
      {consumableModal && (
        <ConsumableCreateModal
          onClose={() => setConsumableModal(false)}
          onCreated={() => {
            setConsumableModal(false);
            void refresh();
          }}
        />
      )}
    </>
  );
}

function groupAssetsByCategory(items: Asset[]): { categoryName: string; items: Asset[] }[] {
  const map = new Map<string, Asset[]>();
  for (const a of items) {
    const key = a.categoryName || 'Sin categoría';
    const list = map.get(key) ?? [];
    list.push(a);
    map.set(key, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'es'))
    .map(([categoryName, groupItems]) => ({ categoryName, items: groupItems }));
}

function AssetTableRows({
  items,
  selectedId,
  onSelect,
  showCategoryColumn,
}: {
  items: Asset[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  showCategoryColumn: boolean;
}) {
  return items.map((a) => (
    <tr
      key={a.id}
      className={selectedId === a.id ? 'ti-inv-row--selected' : ''}
      onClick={() => onSelect(a.id)}
      style={{ cursor: 'pointer' }}
    >
      <td>
        <AssetPhotoThumb assetId={a.id} name={a.name} photoUrl={a.photoUrl} size="sm" />
      </td>
      <td>{a.code}</td>
      <td>
        <span className="ti-inv-table-name">{a.name}</span>
      </td>
      {showCategoryColumn && <td>{a.categoryName}</td>}
      <td>{a.serial ?? '—'}</td>
      <td>{ASSET_STATUS_LABELS[a.status]}</td>
      <td>{a.assigneeName ?? '—'}</td>
      <td>{a.purchaseDate ? new Date(a.purchaseDate).toLocaleDateString('es') : '—'}</td>
    </tr>
  ));
}

function AssetsTable({
  items,
  groupByCategory,
  selectedId,
  onSelect,
  onChanged,
}: {
  items: Asset[];
  groupByCategory: boolean;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onChanged: () => void;
}) {
  const groups = useMemo(
    () => (groupByCategory ? groupAssetsByCategory(items) : null),
    [groupByCategory, items],
  );
  const showCategoryColumn = !groupByCategory;

  const tableHead = (
    <thead>
      <tr>
        <th aria-label="Foto" />
        <th>Código</th>
        <th>Nombre</th>
        {showCategoryColumn && <th>Categoría</th>}
        <th>Serial</th>
        <th>Estado</th>
        <th>Asignado</th>
        <th>Compra</th>
      </tr>
    </thead>
  );

  const splitClass = selectedId != null ? 'ti-inv-split ti-inv-split--with-panel' : 'ti-inv-split';

  return (
    <div className={splitClass}>
      <div className="card-style table-responsive ti-inv-table-card">
        {items.length === 0 && <p className="p-20 text-gray">No hay activos con estos filtros.</p>}
        {items.length > 0 && !groups && (
          <table className="req-table">
            {tableHead}
            <tbody>
              <AssetTableRows
                items={items}
                selectedId={selectedId}
                onSelect={onSelect}
                showCategoryColumn={showCategoryColumn}
              />
            </tbody>
          </table>
        )}
        {groups?.map((g) => (
          <div key={g.categoryName}>
            <h3 className="ti-inv-group-title">
              {g.categoryName} <span className="text-gray">({g.items.length})</span>
            </h3>
            <table className="req-table mb-20">
              {tableHead}
              <tbody>
                <AssetTableRows
                  items={g.items}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  showCategoryColumn={false}
                />
              </tbody>
            </table>
          </div>
        ))}
      </div>
      {selectedId != null && (
        <AssetDetailPanel
          assetId={selectedId}
          onClose={() => onSelect(null)}
          onChanged={onChanged}
        />
      )}
    </div>
  );
}

function AssetsFiltersBar({
  categories,
  filters,
  groupByCategory,
  onFiltersChange,
  onGroupByCategoryChange,
  onApply,
  onClear,
}: {
  categories: { id: number; name: string }[];
  filters: AssetListFilters;
  groupByCategory: boolean;
  onFiltersChange: (f: AssetListFilters) => void;
  onGroupByCategoryChange: (v: boolean) => void;
  onApply: () => void;
  onClear: () => void;
}) {
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [assigneeOptions, setAssigneeOptions] = useState<{ id: number; name: string }[]>([]);

  const patch = (partial: Partial<AssetListFilters>) => {
    onFiltersChange({ ...filters, ...partial });
  };

  return (
    <div className="card-style mb-20">
      <div className="ti-inv-filters">
        <div>
          <label className="admin-form__label">Buscar</label>
          <input
            className="admin-form__input"
            placeholder="Código, nombre, serial…"
            value={filters.search ?? ''}
            onChange={(e) => patch({ search: e.target.value || undefined })}
          />
        </div>
        <div>
          <label className="admin-form__label">Categoría</label>
          <Select
            value={filters.categoryId != null ? String(filters.categoryId) : ''}
            onChange={(v) =>
              patch({
                categoryId: v ? Number.parseInt(v, 10) : undefined,
              })
            }
            placeholder="Todas"
            options={[
              { value: '', label: 'Todas' },
              ...categories.map((c) => ({ value: String(c.id), label: c.name })),
            ]}
          />
        </div>
        <div>
          <label className="admin-form__label">Estado</label>
          <Select
            value={filters.status ?? ''}
            onChange={(v) => patch({ status: (v || undefined) as AssetStatus | undefined })}
            placeholder="Todos"
            options={[
              { value: '', label: 'Todos' },
              ...Object.entries(ASSET_STATUS_LABELS).map(([k, v]) => ({ value: k, label: v })),
            ]}
          />
        </div>
        <div>
          <label className="admin-form__label">Asignado a</label>
          <input
            className="admin-form__input"
            placeholder="Buscar colaborador…"
            value={assigneeSearch}
            onChange={(e) => {
              setAssigneeSearch(e.target.value);
              if (e.target.value.length >= 2) {
                void fetchDirectory({ name: e.target.value }).then((r) =>
                  setAssigneeOptions(r.items.map((u) => ({ id: u.id, name: u.fullName }))),
                );
              } else {
                setAssigneeOptions([]);
              }
            }}
          />
          <Select
            className="mt-10"
            value={filters.assignedTo != null ? String(filters.assignedTo) : ''}
            onChange={(v) => {
              const id = v ? Number.parseInt(v, 10) : undefined;
              patch({ assignedTo: id, unassignedOnly: undefined });
            }}
            placeholder="Cualquiera"
            options={[
              { value: '', label: 'Cualquiera' },
              ...assigneeOptions.map((u) => ({ value: String(u.id), label: u.name })),
            ]}
          />
        </div>
        <div>
          <label className="admin-form__label">Compra desde</label>
          <input
            type="date"
            className="admin-form__input"
            value={filters.purchaseDateFrom ?? ''}
            onChange={(e) => patch({ purchaseDateFrom: e.target.value || undefined })}
          />
        </div>
        <div>
          <label className="admin-form__label">Compra hasta</label>
          <input
            type="date"
            className="admin-form__input"
            value={filters.purchaseDateTo ?? ''}
            onChange={(e) => patch({ purchaseDateTo: e.target.value || undefined })}
          />
        </div>
        <div>
          <label className="admin-form__label">Alta desde</label>
          <input
            type="date"
            className="admin-form__input"
            value={filters.createdFrom ?? ''}
            onChange={(e) => patch({ createdFrom: e.target.value || undefined })}
          />
        </div>
        <div>
          <label className="admin-form__label">Alta hasta</label>
          <input
            type="date"
            className="admin-form__input"
            value={filters.createdTo ?? ''}
            onChange={(e) => patch({ createdTo: e.target.value || undefined })}
          />
        </div>
        <div>
          <label className="admin-form__label">Asignación desde</label>
          <input
            type="date"
            className="admin-form__input"
            value={filters.assignedFrom ?? ''}
            onChange={(e) => patch({ assignedFrom: e.target.value || undefined })}
          />
        </div>
        <div>
          <label className="admin-form__label">Asignación hasta</label>
          <input
            type="date"
            className="admin-form__input"
            value={filters.assignedUntil ?? ''}
            onChange={(e) => patch({ assignedUntil: e.target.value || undefined })}
          />
        </div>
        <div className="ti-inv-filters__actions">
          <label className="ti-inv-filters__toggle">
            <input
              type="checkbox"
              checked={filters.unassignedOnly ?? false}
              onChange={(e) =>
                patch({
                  unassignedOnly: e.target.checked || undefined,
                  assignedTo: e.target.checked ? undefined : filters.assignedTo,
                })
              }
            />
            Solo sin asignar
          </label>
          <label className="ti-inv-filters__toggle">
            <input
              type="checkbox"
              checked={groupByCategory}
              onChange={(e) => onGroupByCategoryChange(e.target.checked)}
            />
            Agrupar por categoría
          </label>
          <button
            type="button"
            className="admin-btn admin-btn--primary admin-btn--sm"
            onClick={onApply}
          >
            Aplicar filtros
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--ghost admin-btn--sm"
            onClick={onClear}
          >
            Limpiar
          </button>
        </div>
      </div>
    </div>
  );
}

function AssetDetailPanel({
  assetId,
  onClose,
  onChanged,
}: {
  assetId: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof fetchAsset>> | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [users, setUsers] = useState<{ id: number; name: string }[]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);

  const load = useCallback(() => {
    void fetchAsset(assetId).then(setDetail);
  }, [assetId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!detail) return <aside className="ti-inv-panel card-style">Cargando…</aside>;

  const { item } = detail;

  return (
    <aside className="ti-inv-panel card-style">
      <button
        type="button"
        className="admin-btn admin-btn--ghost admin-btn--sm mb-10"
        onClick={onClose}
      >
        Cerrar
      </button>
      <div className="ti-inv-detail-photo">
        <AssetPhotoThumb assetId={item.id} name={item.name} photoUrl={item.photoUrl} size="lg" />
        <div className="mt-10">
          <label className="admin-form__label">Foto del activo</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="ti-inv-photo-field__input"
            disabled={photoBusy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setPhotoBusy(true);
              void uploadAssetPhoto(assetId, file)
                .then(() => {
                  load();
                  onChanged();
                })
                .finally(() => {
                  setPhotoBusy(false);
                  e.target.value = '';
                });
            }}
          />
          {item.photoUrl && (
            <button
              type="button"
              className="admin-btn admin-btn--ghost admin-btn--sm mt-10"
              disabled={photoBusy}
              onClick={() =>
                void deleteAssetPhoto(assetId).then(() => {
                  load();
                  onChanged();
                })
              }
            >
              Quitar foto
            </button>
          )}
        </div>
      </div>
      <h3>{item.code}</h3>
      <p>
        <strong>{item.name}</strong>
      </p>
      <p className="text-gray">
        {item.categoryName} · {ASSET_STATUS_LABELS[item.status]}
      </p>
      {item.serial && <p>Serial: {item.serial}</p>}
      {item.purchaseDate && <p>Compra: {new Date(item.purchaseDate).toLocaleDateString('es')}</p>}
      {item.assignedAt && <p>Asignado: {new Date(item.assignedAt).toLocaleDateString('es')}</p>}

      <div className="mt-15">
        <label className="admin-form__label">Asignar a colaborador</label>
        <input
          className="admin-form__input"
          placeholder="Buscar…"
          value={userSearch}
          onChange={(e) => {
            setUserSearch(e.target.value);
            if (e.target.value.length >= 2) {
              void fetchDirectory({ name: e.target.value }).then((r) =>
                setUsers(r.items.map((u) => ({ id: u.id, name: u.fullName }))),
              );
            }
          }}
        />
        {users.length > 0 && (
          <Select
            className="mt-10"
            value=""
            onChange={(uid) => {
              const id = Number.parseInt(uid, 10);
              if (id > 0) {
                void assignAsset(assetId, id).then(() => {
                  load();
                  onChanged();
                });
              }
            }}
            placeholder="Seleccionar…"
            options={users.map((u) => ({ value: String(u.id), label: u.name }))}
          />
        )}
        {item.assignedTo && (
          <button
            type="button"
            className="admin-btn admin-btn--ghost mt-10"
            onClick={() =>
              void unassignAsset(assetId).then(() => {
                load();
                onChanged();
              })
            }
          >
            Desasignar
          </button>
        )}
      </div>

      <div className="mt-15">
        <label className="admin-form__label">Estado</label>
        <Select
          value={item.status}
          onChange={(v) =>
            void updateAssetStatus(assetId, v as AssetStatus).then(() => {
              load();
              onChanged();
            })
          }
          options={Object.entries(ASSET_STATUS_LABELS).map(([k, v]) => ({ value: k, label: v }))}
        />
      </div>

      <h4 className="mt-20">Historial asignaciones</h4>
      <ul className="ti-inv-mini-list">
        {detail.assignments.map((a) => (
          <li key={a.id}>
            {a.userName} · {new Date(a.assignedAt).toLocaleDateString()}
          </li>
        ))}
      </ul>

      <h4 className="mt-15">Mantenimientos</h4>
      <ul className="ti-inv-mini-list">
        {detail.maintenance.map((m) => (
          <li key={m.id}>
            {m.type} — {m.description.slice(0, 60)}
          </li>
        ))}
      </ul>
    </aside>
  );
}

function ConsumablesTable({
  items,
  selectedId,
  onSelect,
  onChanged,
}: {
  items: Consumable[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onChanged: () => void;
}) {
  const splitClass = selectedId != null ? 'ti-inv-split ti-inv-split--with-panel' : 'ti-inv-split';

  return (
    <div className={splitClass}>
      <div className="card-style table-responsive ti-inv-table-card">
        {items.length === 0 && <p className="p-20 text-gray">No hay consumibles registrados.</p>}
        {items.length > 0 && (
          <table className="req-table">
            <thead>
              <tr>
                <th aria-label="Foto" />
                <th>SKU</th>
                <th>Nombre</th>
                <th>Stock</th>
                <th>Mín.</th>
                <th>Unidad</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr
                  key={c.id}
                  className={selectedId === c.id ? 'ti-inv-row--selected' : ''}
                  onClick={() => onSelect(c.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <InventoryPhotoThumb
                      kind="consumable"
                      itemId={c.id}
                      name={c.name}
                      photoUrl={c.photoUrl}
                      size="sm"
                    />
                  </td>
                  <td>{c.sku}</td>
                  <td>
                    {c.name}
                    {c.isLowStock && (
                      <span
                        className="req-badge req-badge--status req-badge--rejected"
                        style={{ marginLeft: 8 }}
                      >
                        Bajo
                      </span>
                    )}
                  </td>
                  <td>{c.currentStock}</td>
                  <td>{c.minimumStock}</td>
                  <td>{CONSUMABLE_UNIT_LABELS[c.unit]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {selectedId != null && (
        <ConsumableDetailPanel
          consumableId={selectedId}
          onClose={() => onSelect(null)}
          onChanged={onChanged}
        />
      )}
    </div>
  );
}

function ConsumableDetailPanel({
  consumableId,
  onClose,
  onChanged,
}: {
  consumableId: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof fetchConsumable>> | null>(null);
  const [qty, setQty] = useState('1');
  const [reason, setReason] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);

  const load = useCallback(() => {
    void fetchConsumable(consumableId).then(setDetail);
  }, [consumableId]);

  useEffect(() => {
    load();
  }, [load]);

  if (!detail) return <aside className="ti-inv-panel card-style">Cargando…</aside>;

  const { item } = detail;

  const run = async (action: 'in' | 'out' | 'adjust') => {
    const q = Number.parseInt(qty, 10);
    if (action === 'adjust') {
      await stockAdjust(consumableId, q, reason || 'Ajuste');
    } else if (action === 'in') {
      await stockIn(consumableId, q, reason);
    } else {
      await stockOut(consumableId, q, reason);
    }
    load();
    onChanged();
  };

  return (
    <aside className="ti-inv-panel card-style">
      <button
        type="button"
        className="admin-btn admin-btn--ghost admin-btn--sm mb-10"
        onClick={onClose}
      >
        Cerrar
      </button>
      <div className="ti-inv-detail-photo">
        <InventoryPhotoThumb
          kind="consumable"
          itemId={item.id}
          name={item.name}
          photoUrl={item.photoUrl}
          size="lg"
        />
        <div className="mt-10">
          <label className="admin-form__label">Foto del consumible</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="ti-inv-photo-field__input"
            disabled={photoBusy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setPhotoBusy(true);
              void uploadConsumablePhoto(consumableId, file)
                .then(() => {
                  load();
                  onChanged();
                })
                .finally(() => {
                  setPhotoBusy(false);
                  e.target.value = '';
                });
            }}
          />
          {item.photoUrl && (
            <button
              type="button"
              className="admin-btn admin-btn--ghost admin-btn--sm mt-10"
              disabled={photoBusy}
              onClick={() =>
                void deleteConsumablePhoto(consumableId).then(() => {
                  load();
                  onChanged();
                })
              }
            >
              Quitar foto
            </button>
          )}
        </div>
      </div>
      <h3>{item.sku}</h3>
      <p>
        <strong>{item.name}</strong>
      </p>
      <p>
        Stock: {item.currentStock} / mín. {item.minimumStock}
      </p>
      <input
        className="admin-form__input mt-10"
        type="number"
        min={0}
        value={qty}
        onChange={(e) => setQty(e.target.value)}
      />
      <input
        className="admin-form__input mt-10"
        placeholder="Razón"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="ti-inv-stock-btns mt-10">
        <button
          type="button"
          className="admin-btn admin-btn--primary admin-btn--sm"
          onClick={() => void run('in')}
        >
          Entrada
        </button>
        <button
          type="button"
          className="admin-btn admin-btn--ghost admin-btn--sm"
          onClick={() => void run('out')}
        >
          Salida
        </button>
        <button
          type="button"
          className="admin-btn admin-btn--ghost admin-btn--sm"
          onClick={() => void run('adjust')}
        >
          Ajuste
        </button>
      </div>
      <h4 className="mt-20">Movimientos</h4>
      <ul className="ti-inv-mini-list">
        {detail.movements.slice(0, 15).map((m) => (
          <li key={m.id}>
            {m.type} {m.quantity} → {m.newStock} ({new Date(m.createdAt).toLocaleDateString()})
          </li>
        ))}
      </ul>
    </aside>
  );
}

function ReportsTab() {
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchInventoryReports>> | null>(null);
  useEffect(() => {
    void fetchInventoryReports().then(setData);
  }, []);
  if (!data) return <p className="text-gray">Cargando reportes…</p>;
  return (
    <div className="ti-inv-reports">
      <section className="card-style mb-20">
        <h3>Activos por colaborador</h3>
        <ul>
          {data.assetsByUser.map((r) => (
            <li key={r.userId}>
              {r.userName}: {r.assetCount}
            </li>
          ))}
        </ul>
      </section>
      <section className="card-style mb-20">
        <h3>Garantía próximos 30 días</h3>
        <ul>
          {data.warrantyExpiring.map((a) => (
            <li key={a.id}>
              {a.code} {a.name} — {a.warrantyExpiry}
            </li>
          ))}
        </ul>
      </section>
      <section className="card-style">
        <h3>Movimientos último mes</h3>
        <ul>
          {data.recentMovements.slice(0, 20).map((m) => (
            <li key={m.id}>
              {m.consumableSku} {m.type} ×{m.quantity}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function AssetCreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [cats, setCats] = useState<{ id: number; name: string }[]>([]);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [serial, setSerial] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void fetchAssetCategories().then((r) => setCats(r.items));
  }, []);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const handlePhoto = (file: File | null) => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  };

  const save = async () => {
    setError('');
    const cat = Number.parseInt(categoryId, 10);
    if (!name.trim() || !Number.isInteger(cat) || cat <= 0) {
      setError('Nombre y categoría son obligatorios');
      return;
    }
    setSaving(true);
    try {
      const { item } = await createAsset({
        name: name.trim(),
        categoryId: cat,
        serial: serial.trim() || null,
        purchaseDate: purchaseDate || null,
      });
      if (photoFile) {
        await uploadAssetPhoto(item.id, photoFile);
      }
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el activo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="admin-modal req-create-modal ti-inv-create-modal card-style"
        role="dialog"
        aria-labelledby="ti-inv-asset-create-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="req-create-modal__header">
          <h2 id="ti-inv-asset-create-title" className="req-create-modal__title">
            Nuevo activo
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

        <label className="admin-form__label">Serial</label>
        <input
          className="admin-form__input mb-10"
          value={serial}
          onChange={(e) => setSerial(e.target.value)}
        />

        <label className="admin-form__label">Fecha de compra</label>
        <input
          type="date"
          className="admin-form__input mb-10"
          value={purchaseDate}
          onChange={(e) => setPurchaseDate(e.target.value)}
        />

        <label className="admin-form__label">Categoría *</label>
        <Select
          className="mb-10"
          value={categoryId}
          onChange={setCategoryId}
          placeholder="Seleccionar…"
          options={cats.map((c) => ({ value: String(c.id), label: c.name }))}
        />

        <div className="ti-inv-photo-field">
          <label className="admin-form__label">Foto (opcional)</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="ti-inv-photo-field__input"
            onChange={(e) => handlePhoto(e.target.files?.[0] ?? null)}
          />
          {photoPreview && (
            <div className="ti-inv-photo-field__preview">
              <img
                src={photoPreview}
                alt=""
                className="ti-inv-photo ti-inv-photo--md"
                width={72}
                height={72}
              />
              <button
                type="button"
                className="admin-btn admin-btn--ghost admin-btn--sm"
                onClick={() => handlePhoto(null)}
              >
                Quitar
              </button>
            </div>
          )}
        </div>

        <div className="ti-inv-create-modal__footer">
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

function ConsumableCreateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [cats, setCats] = useState<{ id: number; name: string }[]>([]);
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void fetchConsumableCategories().then((r) => setCats(r.items));
  }, []);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const handlePhoto = (file: File | null) => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  };

  const save = async () => {
    setError('');
    const cat = Number.parseInt(categoryId, 10);
    if (!sku.trim() || !name.trim() || !Number.isInteger(cat) || cat <= 0) {
      setError('SKU, nombre y categoría son obligatorios');
      return;
    }
    setSaving(true);
    try {
      const { item } = await createConsumable({
        sku: sku.trim(),
        name: name.trim(),
        categoryId: cat,
      });
      if (photoFile) {
        await uploadConsumablePhoto(item.id, photoFile);
      }
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el consumible');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="admin-modal req-create-modal ti-inv-create-modal card-style"
        role="dialog"
        aria-labelledby="ti-inv-consumable-create-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="req-create-modal__header">
          <h2 id="ti-inv-consumable-create-title" className="req-create-modal__title">
            Nuevo consumible
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

        <label className="admin-form__label">SKU *</label>
        <input
          className="admin-form__input mb-10"
          value={sku}
          onChange={(e) => setSku(e.target.value)}
        />

        <label className="admin-form__label">Nombre *</label>
        <input
          className="admin-form__input mb-10"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <label className="admin-form__label">Categoría *</label>
        <Select
          className="mb-10"
          value={categoryId}
          onChange={setCategoryId}
          placeholder="Seleccionar…"
          options={cats.map((c) => ({ value: String(c.id), label: c.name }))}
        />

        <div className="ti-inv-photo-field">
          <label className="admin-form__label">Foto (opcional)</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="ti-inv-photo-field__input"
            onChange={(e) => handlePhoto(e.target.files?.[0] ?? null)}
          />
          {photoPreview && (
            <div className="ti-inv-photo-field__preview">
              <img
                src={photoPreview}
                alt=""
                className="ti-inv-photo ti-inv-photo--md"
                width={72}
                height={72}
              />
              <button
                type="button"
                className="admin-btn admin-btn--ghost admin-btn--sm"
                onClick={() => handlePhoto(null)}
              >
                Quitar
              </button>
            </div>
          )}
        </div>

        <div className="ti-inv-create-modal__footer">
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
