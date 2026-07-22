import { Link } from 'react-router-dom';
import type { Announcement } from '../../api/announcements.types';
import { formatPublishedDate } from '../../utils/announcement-content';

interface AnnouncementCardProps {
  item: Announcement;
  compact?: boolean;
}

function CategoryBadge({ category, label }: { category: Announcement['category']; label: string }) {
  return (
    <span className={`announcement-badge announcement-badge--${category.toLowerCase()}`}>
      {label}
    </span>
  );
}

export function AnnouncementCard({ item, compact = false }: AnnouncementCardProps) {
  return (
    <article
      className={`announcement-card card-style ${compact ? 'announcement-card--compact' : ''}`}
    >
      <Link to={`/comunicados/${item.id}`} className="announcement-card__link">
        <div className="announcement-card__media">
          {item.imageUrl ? (
            <img src={item.imageUrl} alt="" className="announcement-card__image" loading="lazy" />
          ) : (
            <div className="announcement-card__placeholder" aria-hidden>
              <span>{item.categoryLabel.charAt(0)}</span>
            </div>
          )}
          <CategoryBadge category={item.category} label={item.categoryLabel} />
        </div>
        <div className="announcement-card__body">
          <h3 className="announcement-card__title">{item.title}</h3>
          {!compact && <p className="announcement-card__summary">{item.summary}</p>}
          <div className="announcement-card__meta">
            {item.status !== 'PUBLISHED' && (
              <>
                <span
                  className={`announcement-status announcement-status--${item.status.toLowerCase()}`}
                >
                  {item.statusLabel}
                </span>
                <span aria-hidden>·</span>
              </>
            )}
            <span>{item.audienceLabel}</span>
            {item.publishedAt && (
              <>
                <span aria-hidden>·</span>
                <time dateTime={item.publishedAt}>{formatPublishedDate(item.publishedAt)}</time>
              </>
            )}
          </div>
        </div>
      </Link>
    </article>
  );
}
