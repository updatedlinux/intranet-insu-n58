import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { ArrowLeft, Plus, RefreshCw } from 'lucide-react';
import { ApiError } from '../../api/client';
import {
  archiveAnnouncement,
  fetchManageAnnouncements,
  publishAnnouncement,
} from '../../api/announcements';
import type { Announcement, AnnouncementStatus } from '../../api/announcements.types';
import { ConfirmModal } from '../../components/admin/ConfirmModal';
import { AdminGovernanceBanner } from '../../components/admin/AdminGovernanceBanner';
import { PageHeader } from '../../components/layout';
import { AnnouncementManageGuard } from '../../components/announcements/AnnouncementManageGuard';

function StatusBadge({ status, label }: { status: AnnouncementStatus; label: string }) {
  return (
    <span className={`announcement-status announcement-status--${status.toLowerCase()}`}>
      {label}
    </span>
  );
}

export function AnnouncementsManagePage() {
  return (
    <AnnouncementManageGuard>
      <ManageContent />
    </AnnouncementManageGuard>
  );
}

function ManageContent() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [pendingArchive, setPendingArchive] = useState<Announcement | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchManageAnnouncements();
      setItems(res.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cargar el listado');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const runPublish = async (item: Announcement) => {
    setActionLoading(true);
    setError('');
    try {
      await publishAnnouncement(item.id);
      await loadList();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo publicar');
    } finally {
      setActionLoading(false);
    }
  };

  const runArchive = async (item: Announcement) => {
    setActionLoading(true);
    setError('');
    try {
      await archiveAnnouncement(item.id);
      await loadList();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo archivar');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Gestión de comunicados"
        breadcrumbParent="Comunicados"
        breadcrumbCurrent="Gestión"
        breadcrumbParentHref="/comunicados"
      />

      <AdminGovernanceBanner title="Comunicados corporativos" variant="support-ti">
        <p>
          Cree, edite y publique comunicados para la intranet. Los borradores no son visibles hasta
          publicarlos; los archivados dejan de mostrarse en el feed.
        </p>
      </AdminGovernanceBanner>

      <div className="learning-manage-toolbar card-style mb-30">
        <Link to="/comunicados" className="admin-btn admin-btn--ghost">
          <ArrowLeft size={16} aria-hidden />
          Ver feed
        </Link>
        <div className="learning-manage-toolbar__actions">
          <Link to="/comunicados/gestion/nuevo" className="admin-btn admin-btn--primary">
            <Plus size={16} aria-hidden />
            Nuevo comunicado
          </Link>
          <button
            type="button"
            className="admin-btn admin-btn--ghost"
            onClick={() => void loadList()}
          >
            <RefreshCw size={16} aria-hidden />
            Actualizar
          </button>
        </div>
      </div>

      {error && <div className="admin-alert admin-alert--error mb-20">{error}</div>}

      <div className="card-style mb-30">
        <div className="table-responsive">
          <table className="table top-selling-table admin-table">
            <thead>
              <tr>
                <th>Título</th>
                <th>Categoría</th>
                <th>Audiencia</th>
                <th>Estado</th>
                <th>Publicado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6}>Cargando…</td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6}>No hay comunicados registrados.</td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <button
                        type="button"
                        className="admin-link-btn"
                        onClick={() => navigate(`/comunicados/gestion/${item.id}/editar`)}
                      >
                        {item.title}
                      </button>
                    </td>
                    <td>{item.categoryLabel}</td>
                    <td>{item.audienceLabel}</td>
                    <td>
                      <StatusBadge status={item.status} label={item.statusLabel} />
                    </td>
                    <td>
                      {item.publishedAt
                        ? new Date(item.publishedAt).toLocaleDateString('es-PA')
                        : '—'}
                    </td>
                    <td>
                      <div className="admin-row-actions">
                        <Link
                          to={`/comunicados/${item.id}`}
                          className="admin-btn admin-btn--ghost admin-btn--sm"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Eye size={14} aria-hidden />
                          Ver
                        </Link>
                        <button
                          type="button"
                          className="admin-btn admin-btn--ghost admin-btn--sm"
                          onClick={() => navigate(`/comunicados/gestion/${item.id}/editar`)}
                        >
                          Editar
                        </button>
                        {item.status === 'DRAFT' && (
                          <button
                            type="button"
                            className="admin-btn admin-btn--ghost admin-btn--sm"
                            onClick={() => void runPublish(item)}
                            disabled={actionLoading}
                          >
                            Publicar
                          </button>
                        )}
                        {item.status !== 'ARCHIVED' && (
                          <button
                            type="button"
                            className="admin-btn admin-btn--ghost admin-btn--sm"
                            onClick={() => setPendingArchive(item)}
                            disabled={actionLoading}
                          >
                            Archivar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        open={pendingArchive != null}
        title="Archivar comunicado"
        message={
          pendingArchive ? (
            <>
              ¿Archivar <strong>{pendingArchive.title}</strong>? Dejará de ser visible en el feed.
            </>
          ) : null
        }
        variant="danger"
        loading={actionLoading}
        confirmLabel="Archivar"
        onConfirm={async () => {
          if (!pendingArchive) return;
          const item = pendingArchive;
          setPendingArchive(null);
          await runArchive(item);
        }}
        onCancel={() => setPendingArchive(null)}
      />
    </>
  );
}
