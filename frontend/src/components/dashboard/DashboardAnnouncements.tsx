import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Megaphone } from 'lucide-react';
import { fetchLatestAnnouncements } from '../../api/announcements';
import type { Announcement } from '../../api/announcements.types';
import { AnnouncementCard } from '../announcements/AnnouncementCard';

export function DashboardAnnouncements() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchLatestAnnouncements(3)
      .then((res) => setItems(res.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="card-style mb-30 dashboard-announcements">
      <div className="title d-flex flex-wrap align-items-center justify-content-between mb-20">
        <div className="left d-flex align-items-center gap-2">
          <Megaphone size={20} className="dashboard-announcements__icon" aria-hidden />
          <h6 className="text-medium mb-0">Últimos comunicados</h6>
        </div>
        <Link to="/comunicados" className="dashboard-announcements__link">
          Ver todos
        </Link>
      </div>

      {loading ? (
        <p className="text-gray mb-0">Cargando comunicados…</p>
      ) : items.length === 0 ? (
        <p className="text-gray mb-0">No hay comunicados recientes para su área.</p>
      ) : (
        <div className="dashboard-announcements__grid">
          {items.map((item) => (
            <AnnouncementCard key={item.id} item={item} compact />
          ))}
        </div>
      )}
    </div>
  );
}
