import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { RefreshCw, Search, Users } from 'lucide-react';
import { ApiError } from '../../api/client';
import { fetchDirectory } from '../../api/directory';
import type { DirectoryEntry, DirectoryPositionOption } from '../../api/directory.types';
import { DirectoryCard } from '../../components/directory/DirectoryCard';
import { DirectoryProfileModal } from '../../components/directory/DirectoryProfileModal';
import { PageHeader } from '../../components/layout';
import { Select } from '../../components/ui/Select';

export function DirectoryPage() {
  const [items, setItems] = useState<DirectoryEntry[]>([]);
  const [areas, setAreas] = useState<{ id: number; name: string }[]>([]);
  const [allPositions, setAllPositions] = useState<DirectoryPositionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchInput, setSearchInput] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [appliedAreaId, setAppliedAreaId] = useState<number | undefined>();
  const [appliedPositionId, setAppliedPositionId] = useState<number | undefined>();

  const [selected, setSelected] = useState<DirectoryEntry | null>(null);

  const positionOptions = useMemo(() => {
    if (!appliedAreaId) return allPositions;
    return allPositions.filter((p) => p.areaId === appliedAreaId);
  }, [allPositions, appliedAreaId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchDirectory({
        name: appliedSearch || undefined,
        areaId: appliedAreaId,
        positionId: appliedPositionId,
      });
      setItems(res.items);
      setAreas(res.filterOptions.areas);
      setAllPositions(res.filterOptions.positions);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar el directorio');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, appliedAreaId, appliedPositionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyFilters = () => {
    setAppliedSearch(searchInput.trim());
    setAppliedAreaId(areaFilter ? Number.parseInt(areaFilter, 10) : undefined);
    setAppliedPositionId(positionFilter ? Number.parseInt(positionFilter, 10) : undefined);
  };

  const handleSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') applyFilters();
  };

  const handleAreaChange = (value: string) => {
    setAreaFilter(value);
    setPositionFilter('');
    setAppliedAreaId(value ? Number.parseInt(value, 10) : undefined);
    setAppliedPositionId(undefined);
  };

  const hasActiveFilters = Boolean(appliedSearch || appliedAreaId || appliedPositionId);

  const clearFilters = () => {
    setSearchInput('');
    setAreaFilter('');
    setPositionFilter('');
    setAppliedSearch('');
    setAppliedAreaId(undefined);
    setAppliedPositionId(undefined);
  };

  return (
    <>
      <PageHeader
        title="Directorio"
        breadcrumbParent="Recursos"
        breadcrumbCurrent="Directorio"
        breadcrumbParentHref="/directorio"
      />

      {error && <div className="admin-alert admin-alert--error mb-20">{error}</div>}

      <div className="directory-toolbar card-style mb-30">
        <div className="directory-toolbar__search">
          <Search size={18} className="directory-toolbar__search-icon" aria-hidden />
          <input
            type="search"
            className="admin-form__input directory-toolbar__input"
            placeholder="Buscar por nombre…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKey}
            aria-label="Buscar colaborador"
          />
        </div>
        <Select
          value={areaFilter}
          onChange={handleAreaChange}
          options={[
            { value: '', label: 'Todas las áreas' },
            ...areas.map((area) => ({ value: String(area.id), label: area.name })),
          ]}
        />
        <Select
          value={positionFilter}
          onChange={setPositionFilter}
          disabled={positionOptions.length === 0}
          options={[
            { value: '', label: 'Todos los cargos' },
            ...positionOptions.map((pos) => ({ value: String(pos.id), label: pos.name })),
          ]}
        />
        <div className="directory-toolbar__actions">
          <button type="button" className="docs-sp-btn docs-sp-btn--primary" onClick={applyFilters}>
            Buscar
          </button>
          <button
            type="button"
            className="docs-sp-btn docs-sp-btn--secondary"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw size={16} aria-hidden />
            Actualizar
          </button>
        </div>
      </div>

      <div className="directory-meta mb-20">
        {!loading && (
          <span className="directory-meta__count">
            {items.length === 1 ? '1 colaborador' : `${items.length} colaboradores`}
          </span>
        )}
        {hasActiveFilters && (
          <button type="button" className="directory-meta__clear" onClick={clearFilters}>
            Limpiar filtros
          </button>
        )}
      </div>

      {loading ? (
        <div className="directory-empty card-style">
          <p>Cargando directorio…</p>
        </div>
      ) : items.length === 0 ? (
        <div className="directory-empty card-style">
          <Users size={48} className="directory-empty__icon" aria-hidden />
          <h3 className="directory-empty__title">Sin resultados</h3>
          <p className="directory-empty__text">
            {hasActiveFilters
              ? 'No encontramos colaboradores con esos criterios. Prueba otro nombre o ajusta los filtros.'
              : 'Aún no hay colaboradores activos en el directorio.'}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              className="docs-sp-btn docs-sp-btn--secondary mt-3"
              onClick={clearFilters}
            >
              Ver todos
            </button>
          )}
        </div>
      ) : (
        <div className="directory-grid">
          {items.map((entry) => (
            <DirectoryCard
              key={`${entry.email}-${entry.fullName}`}
              entry={entry}
              onSelect={setSelected}
            />
          ))}
        </div>
      )}

      <DirectoryProfileModal entry={selected} onClose={() => setSelected(null)} />
    </>
  );
}
