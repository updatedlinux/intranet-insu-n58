import { Outlet, useLocation } from 'react-router-dom';
import { useAxeroLayout } from '../../hooks/useAxeroLayout';
import { useAuth } from '../../context/AuthContext';
import { NotificationProvider } from '../../context/NotificationContext';
import { ChatProvider } from '../../context/ChatContext';
import { SidebarProvider, useSidebarContext } from '../../context/SidebarContext';
import { canManageLearning, canViewActivityMetrics } from '../../config/roles';
import { ChatWidget } from '../chat/ChatWidget';
import { Header } from './Header';
import { Footer } from './Footer';
import { Preloader } from './Preloader';
import { SidebarNav } from './sidebar/SidebarNav';

function AppLayoutContent() {
  const location = useLocation();

  const { collapsed, toggleCollapsed } = useSidebarContext();

  const {
    preloaderVisible,
    sidebarActive,
    mainActive,
    overlayActive,
    menuIcon,
    toggleMenu,
    closeOverlay,
  } = useAxeroLayout();

  const handleMenuToggle = () => {
    if (window.matchMedia('(max-width: 1199px)').matches) {
      toggleMenu();
    } else {
      toggleCollapsed();
    }
  };

  const layoutClass = ['intranet-layout', collapsed && 'sidebar-collapsed']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={layoutClass}>
      <Preloader visible={preloaderVisible} />
      <SidebarNav mobileOpen={sidebarActive} onMobileClose={closeOverlay} />
      <div
        className={`overlay${overlayActive ? ' active' : ''}`}
        onClick={closeOverlay}
        onKeyDown={(e) => e.key === 'Escape' && closeOverlay()}
        role="button"
        tabIndex={0}
        aria-label="Cerrar menú"
      />
      <main className={`main-wrapper${mainActive ? ' active' : ''}`}>
        <Header menuIcon={menuIcon} onMenuToggle={handleMenuToggle} />
        <section className="section">
          <div className="container-fluid">
            <div className="intranet-page-transition" key={location.pathname}>
              <Outlet />
            </div>
          </div>
        </section>
        <Footer />
      </main>
      <ChatWidget />
    </div>
  );
}

export function AppLayout() {
  const { user } = useAuth();
  const roleName = user?.role.name ?? 'colaborador';
  const isItAgent = user ? user.isItSupportAgent : false;
  const canViewMetrics = user ? canViewActivityMetrics(user) : false;
  const canManageLearningNav = user ? canManageLearning(user) : false;

  return (
    <NotificationProvider>
      <ChatProvider>
        <SidebarProvider
          roleName={roleName}
          isItAgent={isItAgent}
          canViewMetrics={canViewMetrics}
          canManageLearningNav={canManageLearningNav}
        >
          <AppLayoutContent />
        </SidebarProvider>
      </ChatProvider>
    </NotificationProvider>
  );
}
