import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getOpenMenuIds, getNavForUser } from '../config/navigation';

const STORAGE_KEY = 'intranet-sidebar-collapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function useSidebar(
  roleName: string,
  isItAgent: boolean,
  canViewMetrics: boolean,
  canManageLearningNav: boolean,
) {
  const location = useLocation();
  const navItems = useMemo(
    () => getNavForUser(roleName, isItAgent, canViewMetrics, canManageLearningNav),
    [roleName, isItAgent, canViewMetrics, canManageLearningNav],
  );

  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [openMenus, setOpenMenus] = useState<Set<string>>(() => {
    return new Set(getOpenMenuIds(location.pathname, navItems));
  });

  useEffect(() => {
    const ids = getOpenMenuIds(location.pathname, navItems);
    if (ids.length === 0) return;
    setOpenMenus((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, [location.pathname, navItems]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const toggleSubmenu = useCallback((id: string) => {
    setOpenMenus((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const isSubmenuOpen = useCallback((id: string) => openMenus.has(id), [openMenus]);

  return {
    navItems,
    collapsed,
    toggleCollapsed,
    toggleSubmenu,
    isSubmenuOpen,
  };
}
