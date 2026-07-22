import { createContext, useContext, type ReactNode } from 'react';
import { useSidebar } from '../hooks/useSidebar';

type SidebarContextValue = ReturnType<typeof useSidebar>;

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({
  roleName,
  isItAgent,
  canViewMetrics,
  canManageLearningNav,
  children,
}: {
  roleName: string;
  isItAgent: boolean;
  canViewMetrics: boolean;
  canManageLearningNav: boolean;
  children: ReactNode;
}) {
  const value = useSidebar(roleName, isItAgent, canViewMetrics, canManageLearningNav);
  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebarContext() {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    throw new Error('useSidebarContext debe usarse dentro de SidebarProvider');
  }
  return ctx;
}
