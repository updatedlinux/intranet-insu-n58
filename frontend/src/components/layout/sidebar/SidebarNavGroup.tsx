import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import type { NavChildItem, NavMenuItem } from '../../../config/navigation';
import { isChildPathActive } from '../../../config/navigation';

interface SidebarNavGroupProps {
  item: NavMenuItem;
  collapsed: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}

function SubLink({ child, onNavigate }: { child: NavChildItem; onNavigate?: () => void }) {
  const location = useLocation();
  const active = isChildPathActive(location.pathname, child.path);
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    setNavigating(false);
  }, [location.pathname]);

  const className = [
    'intranet-sidebar__sublink',
    active && 'is-active',
    navigating && 'is-navigating',
    !child.ready && 'is-disabled',
  ]
    .filter(Boolean)
    .join(' ');

  if (!child.ready) {
    return (
      <li className="intranet-sidebar__submenu-item">
        <span className={className}>
          <span className="intranet-sidebar__sublink-dot" aria-hidden />
          {child.label}
          <span className="intranet-sidebar__badge">Próx.</span>
        </span>
      </li>
    );
  }

  return (
    <li className="intranet-sidebar__submenu-item">
      <Link
        to={child.path}
        className={className}
        onClick={() => {
          setNavigating(true);
          onNavigate?.();
        }}
      >
        <span className="intranet-sidebar__sublink-dot" aria-hidden />
        {child.label}
      </Link>
    </li>
  );
}

export function SidebarNavGroup({
  item,
  collapsed,
  isOpen,
  onToggle,
  onNavigate,
}: SidebarNavGroupProps) {
  const location = useLocation();
  const itemRef = useRef<HTMLLIElement>(null);
  const [flyoutOpen, setFlyoutOpen] = useState(false);

  const childActive = item.children?.some((c) => isChildPathActive(location.pathname, c.path));
  const Icon = item.icon;
  const expanded = isOpen && !collapsed;

  useEffect(() => {
    if (!collapsed) setFlyoutOpen(false);
  }, [collapsed]);

  useEffect(() => {
    const closeFlyout = (e: MouseEvent) => {
      if (!itemRef.current?.contains(e.target as Node)) {
        setFlyoutOpen(false);
      }
    };
    if (flyoutOpen) {
      document.addEventListener('click', closeFlyout);
      return () => document.removeEventListener('click', closeFlyout);
    }
  }, [flyoutOpen]);

  const handleTriggerClick = () => {
    if (collapsed) {
      setFlyoutOpen((v) => !v);
    } else {
      onToggle();
    }
  };

  const triggerClass = [
    'intranet-sidebar__group-trigger',
    childActive && 'is-parent-active',
    childActive && 'is-active',
    expanded && 'is-expanded',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <li className="intranet-sidebar__item" ref={itemRef}>
      <button
        type="button"
        className={triggerClass}
        onClick={handleTriggerClick}
        aria-expanded={collapsed ? flyoutOpen : expanded}
        title={collapsed ? item.label : undefined}
      >
        <span className="intranet-sidebar__icon" aria-hidden>
          <Icon size={20} strokeWidth={1.75} />
        </span>
        <span className="intranet-sidebar__label">{item.label}</span>
        <ChevronDown className="intranet-sidebar__chevron" size={18} strokeWidth={2} aria-hidden />
      </button>

      {!collapsed && (
        <ul className={`intranet-sidebar__submenu${expanded ? ' is-open' : ''}`}>
          {item.children?.map((child) => (
            <SubLink key={child.id} child={child} onNavigate={onNavigate} />
          ))}
        </ul>
      )}

      {collapsed && flyoutOpen && item.children && (
        <div className="intranet-sidebar__flyout" role="menu">
          <div className="intranet-sidebar__flyout-title">{item.label}</div>
          <ul className="intranet-sidebar__flyout-list">
            {item.children.map((child) => (
              <SubLink key={child.id} child={child} onNavigate={onNavigate} />
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}
