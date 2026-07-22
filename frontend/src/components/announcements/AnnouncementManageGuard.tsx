import { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { fetchAnnouncementCapabilities } from '../../api/announcements';

export function AnnouncementManageGuard({ children }: { children: ReactNode }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    void fetchAnnouncementCapabilities()
      .then((r) => setAllowed(r.canManage))
      .catch(() => setAllowed(false));
  }, []);

  if (allowed === null) {
    return <p className="text-gray">Verificando permisos…</p>;
  }

  if (!allowed) {
    return <Navigate to="/comunicados" replace />;
  }

  return children;
}
