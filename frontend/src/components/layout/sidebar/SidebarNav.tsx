import { Link } from 'react-router-dom';
import { ChevronsLeft } from 'lucide-react';
import { BRAND_ISOTYPE_SRC } from '../../../config/brand';
import { useSidebarContext } from '../../../context/SidebarContext';
import { SidebarNavLink } from './SidebarNavLink';
import { SidebarNavGroup } from './SidebarNavGroup';

interface SidebarNavProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function SidebarNav({ mobileOpen = false, onMobileClose }: SidebarNavProps) {
  const { navItems, collapsed, toggleCollapsed, toggleSubmenu, isSubmenuOpen } =
    useSidebarContext();

  const handleNavigate = () => {
    onMobileClose?.();
  };

  const sidebarClass = [
    'intranet-sidebar',
    collapsed && 'is-collapsed',
    mobileOpen && 'is-mobile-open',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <aside className={sidebarClass} aria-label="Menú principal">
      <div className="intranet-sidebar__header">
        <Link to="/" className="intranet-sidebar__brand" onClick={handleNavigate}>
          <span className="intranet-sidebar__brand-mark">
            <img
              src={BRAND_ISOTYPE_SRC}
              alt=""
              className="intranet-sidebar__brand-isotype"
              aria-hidden
            />
          </span>
          <span className="intranet-sidebar__brand-text">
            <span className="intranet-sidebar__brand-name">Insular</span>
            <span className="intranet-sidebar__brand-tag">Cambios</span>
          </span>
        </Link>
        <button
          type="button"
          className="intranet-sidebar__collapse-btn"
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          <ChevronsLeft size={20} strokeWidth={2} />
        </button>
      </div>

      <nav className="intranet-sidebar__nav">
        <ul className="intranet-sidebar__nav-list">
          {navItems.map((item) =>
            item.children && item.children.length > 0 ? (
              <SidebarNavGroup
                key={item.id}
                item={item}
                collapsed={collapsed}
                isOpen={isSubmenuOpen(item.id)}
                onToggle={() => toggleSubmenu(item.id)}
                onNavigate={handleNavigate}
              />
            ) : (
              <SidebarNavLink
                key={item.id}
                item={item}
                collapsed={collapsed}
                onNavigate={handleNavigate}
              />
            ),
          )}
        </ul>
      </nav>
    </aside>
  );
}
