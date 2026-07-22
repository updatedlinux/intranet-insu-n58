import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { NavMenuItem } from '../../../config/navigation';
import { isPathActive } from '../../../config/navigation';

interface SidebarNavLinkProps {
  item: NavMenuItem;
  collapsed: boolean;
  onNavigate?: () => void;
}

export function SidebarNavLink({ item, collapsed, onNavigate }: SidebarNavLinkProps) {
  const location = useLocation();
  const active = isPathActive(location.pathname, item);
  const [navigating, setNavigating] = useState(false);
  const Icon = item.icon;

  useEffect(() => {
    setNavigating(false);
  }, [location.pathname]);

  if (!item.path) return null;

  const handleClick = () => {
    if (!item.ready) return;
    setNavigating(true);
    onNavigate?.();
  };

  const className = [
    'intranet-sidebar__link',
    active && 'is-active',
    navigating && 'is-navigating',
    !item.ready && 'is-disabled',
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      <span className="intranet-sidebar__icon" aria-hidden>
        <Icon size={20} strokeWidth={1.75} />
      </span>
      <span className="intranet-sidebar__label">{item.label}</span>
      {!item.ready && <span className="intranet-sidebar__badge">Próx.</span>}
    </>
  );

  if (!item.ready) {
    return (
      <li className="intranet-sidebar__item">
        <span className={`${className} is-disabled`} title={collapsed ? item.label : undefined}>
          {content}
        </span>
      </li>
    );
  }

  return (
    <li className="intranet-sidebar__item">
      <Link
        to={item.path}
        className={className}
        title={collapsed ? item.label : undefined}
        onClick={handleClick}
      >
        {content}
      </Link>
    </li>
  );
}
