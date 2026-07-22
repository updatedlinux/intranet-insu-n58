import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Megaphone, RefreshCw, Search, Settings } from 'lucide-react';
import { ApiError } from '../../api/client';
import { fetchAnnouncementCapabilities, fetchAnnouncements } from '../../api/announcements';
import {
  ANNOUNCEMENT_CATEGORY_LABELS,
  type Announcement,
  type AnnouncementCategory,
} from '../../api/announcements.types';
import { AnnouncementCard } from '../../components/announcements/AnnouncementCard';
import { PageHeader } from '../../components/layout';
import { Select } from '../../components/ui/Select';

export function AnnouncementsFeedPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [canManage, setCanManage] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [appliedCategory, setAppliedCategory] = useState<AnnouncementCategory | undefined>();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchAnnouncements({
        search: appliedSearch || undefined,
        category: appliedCategory,
      });
      setItems(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar los comunicados');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, appliedCategory]);

  useEffect(() => {
    void fetchAnnouncementCapabilities()
      .then((r) => setCanManage(r.canManage))
      .catch(() => setCanManage(false));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const applyFilters = () => {
    setAppliedSearch(searchInput.trim());
    setAppliedCategory(categoryFilter ? (categoryFilter as AnnouncementCategory) : undefined);
  };

  return (
    <>
      <PageHeader
        title="Comunicados"
        breadcrumbParent="Comunicación"
        breadcrumbCurrent="Comunicados"
        breadcrumbParentHref="/comunicados"
      />

      <div className="announcements-toolbar card-style mb-30">
        <div className="announcements-toolbar__search">
          <Search size={18} className="announcements-toolbar__icon" aria-hidden />
          <input
            type="search"
            className="admin-form__input announcements-toolbar__input"
            placeholder="Buscar comunicados…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
          />
        </div>
        <Select
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={[
            { value: '', label: 'Todas las categorías' },
            ...Object.entries(ANNOUNCEMENT_CATEGORY_LABELS).map(([key, label]) => ({
              value: key,
              label,
            })),
          ]}
        />
        <div className="announcements-toolbar__actions">
          <button type="button" className="docs-sp-btn docs-sp-btn--primary" onClick={applyFilters}>
            Buscar
          </button>
          <button
            type="button"
            className="docs-sp-btn docs-sp-btn--secondary"
            onClick={() => void load()}
          >
            <RefreshCw size={16} aria-hidden />
          </button>
          {canManage && (
            <Link to="/comunicados/gestion" className="docs-sp-btn docs-sp-btn--secondary">
              <Settings size={16} aria-hidden />
              Gestionar
            </Link>
          )}
        </div>
      </div>

      {error && <div className="admin-alert admin-alert--error mb-20">{error}</div>}

      {loading ? (
        <div className="announcements-empty card-style">
          <Loader />
          <p>Cargando comunicados…</p>
        </div>
      ) : items.length === 0 ? (
        <div className="announcements-empty card-style">
          <Megaphone size={48} className="announcements-empty__icon" aria-hidden />
          <h3>Sin comunicados</h3>
          <p>
            {appliedSearch || appliedCategory
              ? 'No hay resultados con esos filtros. Prueba otra búsqueda.'
              : 'Aún no hay comunicados publicados para su área.'}
          </p>
        </div>
      ) : (
        <div className="announcements-grid">
          {items.map((item) => (
            <AnnouncementCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </>
  );
}

function Loader() {
  return <span className="announcement-spin announcement-spin--lg" aria-hidden />;
}
