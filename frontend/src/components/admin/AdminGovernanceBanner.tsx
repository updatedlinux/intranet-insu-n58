import { CircleHelp } from 'lucide-react';

interface AdminGovernanceBannerProps {
  title: string;
  variant?: 'inventory' | 'support-ti';
  children: React.ReactNode;
}

export function AdminGovernanceBanner({
  title,
  variant = 'inventory',
  children,
}: AdminGovernanceBannerProps) {
  return (
    <aside
      className={`admin-governance-banner admin-governance-banner--${variant} mb-20`}
      role="note"
      aria-label={title}
    >
      <span className="admin-governance-banner__icon" aria-hidden>
        <CircleHelp size={22} />
      </span>
      <div className="admin-governance-banner__text">
        <strong className="admin-governance-banner__title">{title}</strong>
        <div className="admin-governance-banner__body">{children}</div>
      </div>
    </aside>
  );
}
