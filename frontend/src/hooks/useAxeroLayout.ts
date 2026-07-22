import { useCallback, useEffect, useState } from 'react';

export function useAxeroLayout() {
  const [preloaderVisible, setPreloaderVisible] = useState(true);
  const [sidebarActive, setSidebarActive] = useState(false);
  const [mainActive, setMainActive] = useState(false);
  const [overlayActive, setOverlayActive] = useState(false);
  const [menuIcon, setMenuIcon] = useState<'lni-chevron-left' | 'lni-menu'>('lni-chevron-left');

  useEffect(() => {
    const hidePreloader = () => setPreloaderVisible(false);
    if (document.readyState === 'complete') {
      hidePreloader();
    } else {
      window.addEventListener('load', hidePreloader);
      return () => window.removeEventListener('load', hidePreloader);
    }
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const header = document.querySelector('.header');
      if (!header) return;
      if (window.scrollY > 0) {
        (header as HTMLElement).style.boxShadow = '0px 0px 30px 0px rgba(200, 208, 216, 0.30)';
      } else {
        (header as HTMLElement).style.boxShadow = 'none';
      }
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const toggleMenu = useCallback(() => {
    setSidebarActive((prev) => !prev);
    setOverlayActive(true);
    setMainActive((prev) => !prev);

    if (document.body.clientWidth > 1200) {
      setMenuIcon((icon) => (icon === 'lni-chevron-left' ? 'lni-menu' : 'lni-chevron-left'));
    } else {
      setMenuIcon((icon) => (icon === 'lni-chevron-left' ? 'lni-menu' : icon));
    }
  }, []);

  const closeOverlay = useCallback(() => {
    setSidebarActive(false);
    setOverlayActive(false);
    setMainActive(false);
  }, []);

  return {
    preloaderVisible,
    sidebarActive,
    mainActive,
    overlayActive,
    menuIcon,
    toggleMenu,
    closeOverlay,
  };
}
