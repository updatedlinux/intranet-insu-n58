import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ApiError } from '../../api/client';
import { fetchAnnouncement } from '../../api/announcements';
import type { Announcement } from '../../api/announcements.types';
import { AnnouncementContent } from '../../components/announcements/AnnouncementContent';
import { PageHeader } from '../../components/layout';
import { formatPublishedDate } from '../../utils/announcement-content';

export function AnnouncementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const announcementId = Number.parseInt(id ?? '', 10);
  const [item, setItem] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (Number.isNaN(announcementId)) {
      setError('Comunicado no válido');
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const res = await fetchAnnouncement(announcementId);
        setItem(res.item);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar el comunicado');
      } finally {
        setLoading(false);
      }
    })();
  }, [announcementId]);

  if (loading) {
    return <p className="text-gray">Cargando comunicado…</p>;
  }

  if (error || !item) {
    return (
      <>
        <Link to="/comunicados" className="announcement-back-link">
          <ArrowLeft size={16} aria-hidden />
          Volver al feed
        </Link>
        <div className="admin-alert admin-alert--error">{error || 'Comunicado no encontrado'}</div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={item.title}
        breadcrumbParent="Comunicados"
        breadcrumbCurrent="Detalle"
        breadcrumbParentHref="/comunicados"
      />

      <Link to="/comunicados" className="announcement-back-link mb-20">
        <ArrowLeft size={16} aria-hidden />
        Volver al feed
      </Link>

      <article className="announcement-detail card-style">
        {item.imageUrl && <img src={item.imageUrl} alt="" className="announcement-detail__hero" />}
        <div className="announcement-detail__header">
          <span className={`announcement-badge announcement-badge--${item.category.toLowerCase()}`}>
            {item.categoryLabel}
          </span>
          <p className="announcement-detail__meta">
            {item.audienceLabel}
            {item.publishedAt && (
              <>
                {' · '}
                <time dateTime={item.publishedAt}>{formatPublishedDate(item.publishedAt)}</time>
              </>
            )}
            {' · '}
            {item.authorName}
          </p>
        </div>
        <p className="announcement-detail__summary">{item.summary}</p>
        <AnnouncementContent content={item.content} className="announcement-detail__body" />
      </article>
    </>
  );
}
