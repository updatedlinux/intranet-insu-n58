import { useState } from 'react';
import { ChevronDown, ChevronRight, Package, Boxes } from 'lucide-react';
import { ApiError } from '../../api/client';
import {
  fetchUserAssets,
  fetchTicketConsumableUsage,
  stockOut,
  fetchConsumables,
} from '../../api/inventory';
import { ASSET_STATUS_LABELS } from '../../api/inventory';
import type { Asset, Consumable, StockMovement } from '../../api/inventory.types';
import { AssetPhotoThumb } from '../ti-inventory/AssetPhotoThumb';
import { Select } from '../ui/Select';

interface TicketInventoryPanelsProps {
  ticketId: number;
  requesterId: number;
  ticketCode: string;
}

function CollapsibleSection({
  title,
  icon,
  children,
  onOpen,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onOpen?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ti-inv-ticket-section">
      <button
        type="button"
        className="ti-inv-ticket-section__toggle"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => {
            const next = !v;
            if (next) onOpen?.();
            return next;
          });
        }}
      >
        {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        {icon}
        <span>{title}</span>
      </button>
      {open && <div className="ti-inv-ticket-section__body">{children}</div>}
    </div>
  );
}

function RequesterAssetsPanel({ requesterId }: { requesterId: number }) {
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Asset[]>([]);
  const [error, setError] = useState('');

  function load() {
    if (loaded || loading) return;
    setLoading(true);
    void fetchUserAssets(requesterId)
      .then((res) => {
        setItems(res.items);
        setLoaded(true);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Error al cargar activos'))
      .finally(() => setLoading(false));
  }

  return (
    <CollapsibleSection
      title="Activos del solicitante"
      icon={<Package size={18} aria-hidden />}
      onOpen={load}
    >
      {loaded && (
        <button
          type="button"
          className="admin-btn admin-btn--ghost admin-btn--sm mb-10"
          onClick={load}
        >
          Actualizar
        </button>
      )}
      {loading && <p className="text-gray">Cargando…</p>}
      {error && <div className="admin-alert admin-alert--error">{error}</div>}
      {loaded && items.length === 0 && <p className="text-gray">Sin activos asignados.</p>}
      {loaded && items.length > 0 && (
        <ul className="ti-inv-ticket-list">
          {items.map((a) => (
            <li key={a.id} className="ti-inv-ticket-list__item">
              <AssetPhotoThumb assetId={a.id} name={a.name} photoUrl={a.photoUrl} size="sm" />
              <div>
                <strong>{a.name}</strong>
                <span className="ti-inv-ticket-list__meta">
                  {a.code} · {a.categoryName} · {ASSET_STATUS_LABELS[a.status]}
                  {a.serial ? ` · S/N ${a.serial}` : ''}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </CollapsibleSection>
  );
}

function ConsumablesUsedPanel({ ticketId, ticketCode }: { ticketId: number; ticketCode: string }) {
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState<StockMovement[]>([]);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<Consumable[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [qty, setQty] = useState('1');
  const [saving, setSaving] = useState(false);

  function loadUsage() {
    setLoading(true);
    void fetchTicketConsumableUsage(ticketId)
      .then((res) => {
        setUsage(res.items);
        setLoaded(true);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : 'Error al cargar consumibles'),
      )
      .finally(() => setLoading(false));
  }

  function searchConsumables(term: string) {
    setSearch(term);
    if (term.trim().length < 2) {
      setOptions([]);
      return;
    }
    void fetchConsumables({ search: term })
      .then((res) => setOptions(res.items.slice(0, 8)))
      .catch(() => setOptions([]));
  }

  async function registerUse() {
    const id = Number.parseInt(selectedId, 10);
    const quantity = Number.parseInt(qty, 10);
    if (!Number.isInteger(id) || !Number.isInteger(quantity) || quantity <= 0) return;
    setSaving(true);
    setError('');
    try {
      await stockOut(id, quantity, `Uso en ticket ${ticketCode}`, ticketId);
      setShowForm(false);
      setSelectedId('');
      setSearch('');
      loadUsage();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo registrar salida');
    } finally {
      setSaving(false);
    }
  }

  return (
    <CollapsibleSection
      title="Consumibles utilizados"
      icon={<Boxes size={18} aria-hidden />}
      onOpen={loadUsage}
    >
      <div className="mb-10">
        {loaded && (
          <button
            type="button"
            className="admin-btn admin-btn--ghost admin-btn--sm"
            onClick={loadUsage}
          >
            Actualizar lista
          </button>
        )}
        <button
          type="button"
          className="admin-btn admin-btn--primary admin-btn--sm ml-10"
          onClick={() => setShowForm((v) => !v)}
        >
          Registrar uso de consumible
        </button>
      </div>

      {showForm && (
        <div className="ti-inv-ticket-form card-style mb-15">
          <input
            className="admin-form__input mb-10"
            placeholder="Buscar por nombre o SKU…"
            value={search}
            onChange={(e) => searchConsumables(e.target.value)}
          />
          {options.length > 0 && (
            <Select
              className="mb-10"
              value={selectedId}
              onChange={setSelectedId}
              placeholder="Seleccione consumible"
              options={options.map((c) => ({
                value: String(c.id),
                label: `${c.sku} — ${c.name} (stock: ${c.currentStock})`,
              }))}
            />
          )}
          <input
            type="number"
            min={1}
            className="admin-form__input mb-10"
            placeholder="Cantidad"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            disabled={saving || !selectedId}
            onClick={() => void registerUse()}
          >
            Confirmar salida
          </button>
        </div>
      )}

      {loading && <p className="text-gray">Cargando…</p>}
      {error && <div className="admin-alert admin-alert--error mb-10">{error}</div>}
      {loaded && usage.length === 0 && (
        <p className="text-gray">Ningún consumible registrado en este ticket.</p>
      )}
      {usage.length > 0 && (
        <ul className="ti-inv-ticket-list">
          {usage.map((m) => (
            <li key={m.id}>
              <strong>{m.consumableName}</strong> ({m.consumableSku}) × {m.quantity}
              <span className="ti-inv-ticket-list__meta">
                {m.performerName} · {new Date(m.createdAt).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </CollapsibleSection>
  );
}

export function TicketInventoryPanels({
  ticketId,
  requesterId,
  ticketCode,
}: TicketInventoryPanelsProps) {
  return (
    <div className="ti-inv-ticket-panels mt-20">
      <RequesterAssetsPanel requesterId={requesterId} />
      <ConsumablesUsedPanel ticketId={ticketId} ticketCode={ticketCode} />
    </div>
  );
}
