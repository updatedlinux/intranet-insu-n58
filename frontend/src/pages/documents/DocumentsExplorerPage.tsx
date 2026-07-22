import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Check,
  Eye,
  Folder,
  FolderPlus,
  MoreHorizontal,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { ApiError } from '../../api/client';
import {
  approveDocument,
  browseFolder,
  createDocFolder,
  deleteDocFolder,
  deleteDocument,
  rejectDocument,
  uploadDocument,
} from '../../api/documents';
import type {
  DocDocument,
  DocFolder,
  DocTagRef,
  DocumentStatus,
  FolderBrowseResponse,
} from '../../api/documents.types';
import { DOCUMENT_STATUS_LABELS } from '../../api/documents.types';
import { fetchActiveTags } from '../../api/tags';
import type { DocTag } from '../../api/tags.types';
import { ConfirmModal } from '../../components/admin/ConfirmModal';
import {
  DocumentsPendingPanel,
  PendingCountButton,
} from '../../components/documents/DocumentsPendingPanel';
import {
  DocumentPdfPreviewModal,
  openDocumentFile,
} from '../../components/documents/DocumentPdfPreviewModal';
import {
  DocumentsRejectedPanel,
  RejectedCountButton,
} from '../../components/documents/DocumentsRejectedPanel';
import { DocFileTile, formatFileSize } from '../../components/documents/DocFileIcon';
import { PageHeader } from '../../components/layout';
import { MultiSelect } from '../../components/ui/MultiSelect';
import { isAdminRole } from '../../config/roles';
import { useAuth } from '../../context/AuthContext';
import { triggerDocumentDownload } from '../../utils/document-download';

function formatModified(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayDiff = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86400000);

  if (dayDiff === 0) {
    return `Hoy ${d.toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (dayDiff === 1) return 'Ayer';
  if (dayDiff < 7) return `Hace ${dayDiff} días`;
  return d.toLocaleDateString('es-PA', { day: 'numeric', month: 'short', year: 'numeric' });
}

function itemSubline(parts: (string | null | undefined | false)[]) {
  const text = parts.filter(Boolean).join(' · ');
  return text || null;
}

function DocItemSubline({
  kind,
  description,
  tags,
  author,
}: {
  kind: 'folder' | 'file';
  description?: string | null;
  tags?: DocTagRef[];
  author?: string | null;
}) {
  const text = itemSubline([
    kind === 'folder' ? 'Carpeta' : null,
    description,
    tags?.length ? tags.map((t) => t.name).join(', ') : null,
    author ? `Subido por ${author}` : null,
  ]);
  if (!text) return null;
  return <p className="docs-od-subline">{text}</p>;
}

function DocStatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <span className={`docs-status-badge docs-status-badge--${status.toLowerCase()}`}>
      {DOCUMENT_STATUS_LABELS[status]}
    </span>
  );
}

export function DocumentsExplorerPage() {
  const { user } = useAuth();
  const isAdmin = user ? isAdminRole(user.role.name) : false;
  const [data, setData] = useState<FolderBrowseResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showPendingPanel, setShowPendingPanel] = useState(false);
  const [showRejectedPanel, setShowRejectedPanel] = useState(false);

  const [folderName, setFolderName] = useState('');
  const [folderDescription, setFolderDescription] = useState('');

  const [uploadName, setUploadName] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadTagIds, setUploadTagIds] = useState<number[]>([]);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const [availableTags, setAvailableTags] = useState<DocTag[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTagIds, setFilterTagIds] = useState<number[]>([]);
  const [appliedSearch, setAppliedSearch] = useState('');
  const [appliedTagIds, setAppliedTagIds] = useState<number[]>([]);

  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{
    id: number;
    fileName: string;
    title: string;
  } | null>(null);
  const [pendingDeleteFolder, setPendingDeleteFolder] = useState<DocFolder | null>(null);
  const [pendingDeleteDoc, setPendingDeleteDoc] = useState<DocDocument | null>(null);
  const newMenuRef = useRef<HTMLDivElement>(null);
  const [newMenuOpen, setNewMenuOpen] = useState(false);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-docs-actions-menu]')) {
        setOpenMenuKey(null);
      }
      if (newMenuRef.current && !newMenuRef.current.contains(target)) {
        setNewMenuOpen(false);
      }
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const load = useCallback(
    async (folderId?: number, filters?: { q?: string; tagIds?: number[] }) => {
      setLoading(true);
      setError('');
      try {
        const res = await browseFolder(folderId, {
          q: filters?.q,
          tagIds: filters?.tagIds,
        });
        setData(res);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar el repositorio');
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void fetchActiveTags()
      .then((res) => setAvailableTags(res.items))
      .catch(() => setAvailableTags([]));
  }, []);

  useEffect(() => {
    void load(undefined, { q: appliedSearch, tagIds: appliedTagIds });
  }, [load, appliedSearch, appliedTagIds]);

  const applyFilters = () => {
    setAppliedSearch(searchQuery.trim());
    setAppliedTagIds(filterTagIds);
    void load(currentFolderId, { q: searchQuery.trim(), tagIds: filterTagIds });
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilterTagIds([]);
    setAppliedSearch('');
    setAppliedTagIds([]);
    void load(currentFolderId);
  };

  const currentFolderId = data?.folder.id;
  const caps = data?.capabilities;
  const canCreateFolder = caps?.canCreateFolder ?? false;
  const canUpload = caps?.canUpload ?? false;
  const canApprove = caps?.canApprove ?? false;
  const canManage = isAdmin || canApprove;

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;
    setActionLoading(true);
    setError('');
    try {
      await createDocFolder({
        name: folderName.trim(),
        description: folderDescription.trim() || null,
        parentFolderId: data.folder.id,
      });
      setShowFolderModal(false);
      setFolderName('');
      setFolderDescription('');
      await load(currentFolderId, { q: appliedSearch, tagIds: appliedTagIds });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear la carpeta');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || !uploadFile) return;
    setActionLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('folderId', String(data.folder.id));
      formData.append('name', uploadName.trim());
      if (uploadDescription.trim()) formData.append('description', uploadDescription.trim());
      if (uploadTagIds.length > 0) {
        formData.append('tagIds', JSON.stringify(uploadTagIds));
      }

      await uploadDocument(formData);
      setShowUploadModal(false);
      setUploadName('');
      setUploadDescription('');
      setUploadTagIds([]);
      setUploadFile(null);
      await load(currentFolderId, { q: appliedSearch, tagIds: appliedTagIds });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo subir el archivo');
    } finally {
      setActionLoading(false);
    }
  };

  const navigateToFolder = (folderId: number) => {
    setOpenMenuKey(null);
    void load(folderId, { q: appliedSearch, tagIds: appliedTagIds });
  };

  const tagSelectOptions = availableTags.map((t) => ({ value: t.id, label: t.name }));

  const handleOpenDocument = (doc: DocDocument) => {
    setOpenMenuKey(null);
    if (!doc.fileName) return;
    openDocumentFile(doc, (previewDoc) => {
      setPdfPreview({ id: previewDoc.id, fileName: previewDoc.fileName, title: doc.name });
    });
  };

  const handleDeleteFolder = async () => {
    if (!pendingDeleteFolder) return;
    setActionLoading(true);
    try {
      await deleteDocFolder(pendingDeleteFolder.id);
      setPendingDeleteFolder(null);
      await load(currentFolderId, { q: appliedSearch, tagIds: appliedTagIds });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar la carpeta');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteDocument = async () => {
    if (!pendingDeleteDoc) return;
    setActionLoading(true);
    try {
      await deleteDocument(pendingDeleteDoc.id);
      setPendingDeleteDoc(null);
      await load(currentFolderId, { q: appliedSearch, tagIds: appliedTagIds });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar el documento');
    } finally {
      setActionLoading(false);
    }
  };

  const folderTitle = data?.folder.name ?? 'Mis archivos';
  const itemCount = data ? data.subfolders.length + data.documents.length : 0;

  return (
    <>
      <PageHeader title="Documentos" breadcrumbParent="Recursos" breadcrumbCurrent="Documentos" />

      {error && <div className="admin-alert admin-alert--error mb-20">{error}</div>}

      <div className="card-style docs-od mb-30">
        <header className="docs-od-header">
          <div className="docs-od-header__title-block">
            <h1 className="docs-od-title">{folderTitle}</h1>
            {data && data.breadcrumbs.length > 1 && (
              <nav className="docs-od-path" aria-label="Ruta de carpetas">
                {data.breadcrumbs.map((crumb, index) => {
                  const isLast = index === data.breadcrumbs.length - 1;
                  return (
                    <span key={crumb.id} className="docs-od-path__segment">
                      {index > 0 && (
                        <ChevronRight size={12} className="docs-od-path__sep" aria-hidden />
                      )}
                      {isLast ? (
                        <span className="docs-od-path__current">{crumb.name}</span>
                      ) : (
                        <button
                          type="button"
                          className="docs-od-path__link"
                          onClick={() => navigateToFolder(crumb.id)}
                        >
                          {crumb.name}
                        </button>
                      )}
                    </span>
                  );
                })}
              </nav>
            )}
            {data && !loading && (
              <p className="docs-od-count">
                {itemCount === 1 ? '1 elemento' : `${itemCount} elementos`}
              </p>
            )}
          </div>
          <div className="docs-od-header__actions">
            <PendingCountButton
              count={caps?.pendingCount ?? 0}
              onClick={() => setShowPendingPanel(true)}
            />
            <RejectedCountButton
              count={caps?.rejectedCount ?? 0}
              onClick={() => setShowRejectedPanel(true)}
            />
            <button
              type="button"
              className="docs-od-icon-btn"
              title="Actualizar"
              onClick={() =>
                void load(currentFolderId, { q: appliedSearch, tagIds: appliedTagIds })
              }
              disabled={loading}
            >
              <RefreshCw size={18} aria-hidden />
            </button>
            <div className="docs-od-new" ref={newMenuRef}>
              <button
                type="button"
                className="docs-od-new__trigger"
                disabled={!data || loading || (!canCreateFolder && !canUpload)}
                aria-expanded={newMenuOpen}
                aria-haspopup="menu"
                onClick={(e) => {
                  e.stopPropagation();
                  setNewMenuOpen((v) => !v);
                }}
              >
                <span className="docs-od-new__plus">+</span>
                Nuevo
                <ChevronDown size={16} aria-hidden />
              </button>
              {newMenuOpen && (
                <div className="docs-od-new__menu" role="menu">
                  {canCreateFolder && (
                    <button
                      type="button"
                      role="menuitem"
                      className="docs-od-new__item"
                      onClick={() => {
                        setNewMenuOpen(false);
                        setShowFolderModal(true);
                      }}
                    >
                      <FolderPlus size={18} aria-hidden />
                      Carpeta
                    </button>
                  )}
                  {canUpload && (
                    <button
                      type="button"
                      role="menuitem"
                      className="docs-od-new__item"
                      onClick={() => {
                        setNewMenuOpen(false);
                        setShowUploadModal(true);
                      }}
                    >
                      <Upload size={18} aria-hidden />
                      Cargar archivos
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="docs-od-toolbar">
          <div className="docs-od-search">
            <Search size={18} className="docs-od-search__icon" aria-hidden />
            <input
              type="search"
              className="docs-od-search__input"
              placeholder="Filtrar por nombre en esta carpeta"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyFilters();
              }}
            />
          </div>
          <div className="docs-od-toolbar__filters">
            <MultiSelect
              options={tagSelectOptions}
              value={filterTagIds}
              onChange={setFilterTagIds}
              placeholder="Etiquetas"
            />
            <button type="button" className="docs-od-toolbar__btn" onClick={applyFilters}>
              Buscar
            </button>
            {(appliedSearch || appliedTagIds.length > 0) && (
              <button
                type="button"
                className="docs-od-toolbar__btn docs-od-toolbar__btn--ghost"
                onClick={clearFilters}
              >
                <X size={14} aria-hidden />
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

        <div className="docs-od-table" role="grid" aria-label="Contenido de la carpeta">
          <div className="docs-od-table__head" role="row">
            <div role="columnheader">Nombre</div>
            <div className="docs-od-table__col--date" role="columnheader">
              Modificado
            </div>
            <div className="docs-od-table__col--size" role="columnheader">
              Tamaño
            </div>
            <div
              className="docs-od-table__col--actions"
              role="columnheader"
              aria-label="Acciones"
            />
          </div>
          <div className="docs-od-table__body">
            {loading ? (
              <div className="docs-od-empty">Cargando contenido…</div>
            ) : !data ? (
              <div className="docs-od-empty">No hay datos disponibles.</div>
            ) : itemCount === 0 ? (
              <div className="docs-od-empty">
                <Folder size={48} className="docs-od-empty__icon" strokeWidth={1} aria-hidden />
                <p className="docs-od-empty__title">Esta carpeta está vacía</p>
                <p className="docs-od-empty__hint">
                  Seleccione <strong>Nuevo</strong> para crear una carpeta o cargar archivos.
                </p>
              </div>
            ) : (
              <>
                {data.subfolders.map((folder: DocFolder) => (
                  <div key={`folder-${folder.id}`} className="docs-od-row" role="row">
                    <div className="docs-od-row__name" role="cell">
                      <DocFileTile kind="other" isFolder />
                      <div className="docs-od-row__text">
                        <span className="docs-od-row__title-wrap">
                          <button
                            type="button"
                            className="docs-od-row__title"
                            onClick={() => navigateToFolder(folder.id)}
                          >
                            {folder.name}
                          </button>
                          {folder.areaOrphanedAt ? (
                            <span className="admin-badge admin-badge--warning">Área eliminada</span>
                          ) : null}
                        </span>
                        <DocItemSubline kind="folder" description={folder.description} />
                      </div>
                    </div>
                    <div className="docs-od-row__date docs-od-table__col--date" role="cell">
                      —
                    </div>
                    <div className="docs-od-row__size docs-od-table__col--size" role="cell">
                      —
                    </div>
                    <div className="docs-od-row__actions docs-od-table__col--actions" role="cell">
                      {canManage && (
                        <div
                          className={`docs-actions-menu${openMenuKey === `f-${folder.id}` ? ' docs-actions-menu--open' : ''}`}
                          data-docs-actions-menu
                        >
                          <button
                            type="button"
                            className="docs-od-icon-btn"
                            onClick={() =>
                              setOpenMenuKey(
                                openMenuKey === `f-${folder.id}` ? null : `f-${folder.id}`,
                              )
                            }
                            aria-expanded={openMenuKey === `f-${folder.id}`}
                            aria-haspopup="menu"
                            aria-label={`Opciones de ${folder.name}`}
                          >
                            <MoreHorizontal size={18} />
                          </button>
                          {openMenuKey === `f-${folder.id}` && (
                            <div className="docs-actions-menu__panel">
                              <button
                                type="button"
                                className="docs-actions-menu__item docs-actions-menu__item--danger"
                                onClick={() => {
                                  setOpenMenuKey(null);
                                  setPendingDeleteFolder(folder);
                                }}
                              >
                                Eliminar carpeta
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {data.documents.map((doc) => (
                  <div key={`doc-${doc.id}`} className="docs-od-row" role="row">
                    <div className="docs-od-row__name" role="cell">
                      <DocFileTile kind={doc.fileKind} />
                      <div className="docs-od-row__text">
                        <span className="docs-od-row__title-wrap">
                          <button
                            type="button"
                            className="docs-od-row__title"
                            onClick={() => void handleOpenDocument(doc)}
                            disabled={!doc.fileName}
                            title={doc.name}
                          >
                            {doc.name}
                          </button>
                          <DocStatusBadge status={doc.status} />
                        </span>
                        <DocItemSubline
                          kind="file"
                          description={doc.description}
                          tags={doc.tags}
                          author={doc.uploadedByName}
                        />
                      </div>
                    </div>
                    <div className="docs-od-row__date docs-od-table__col--date" role="cell">
                      {formatModified(doc.uploadedAt ?? doc.updatedAt)}
                    </div>
                    <div className="docs-od-row__size docs-od-table__col--size" role="cell">
                      {formatFileSize(doc.fileSize)}
                    </div>
                    <div className="docs-od-row__actions docs-od-table__col--actions" role="cell">
                      <div
                        className={`docs-actions-menu${openMenuKey === `d-${doc.id}` ? ' docs-actions-menu--open' : ''}`}
                        data-docs-actions-menu
                      >
                        <button
                          type="button"
                          className="docs-od-icon-btn"
                          onClick={() =>
                            setOpenMenuKey(openMenuKey === `d-${doc.id}` ? null : `d-${doc.id}`)
                          }
                          aria-expanded={openMenuKey === `d-${doc.id}`}
                          aria-haspopup="menu"
                          aria-label={`Opciones de ${doc.name}`}
                        >
                          <MoreHorizontal size={18} />
                        </button>
                        {openMenuKey === `d-${doc.id}` && (
                          <div className="docs-actions-menu__panel">
                            {doc.fileKind === 'pdf' && (
                              <button
                                type="button"
                                className="docs-actions-menu__item"
                                onClick={() => handleOpenDocument(doc)}
                              >
                                <Eye
                                  size={14}
                                  style={{ marginRight: 6, verticalAlign: 'middle' }}
                                />
                                Ver PDF
                              </button>
                            )}
                            <button
                              type="button"
                              className="docs-actions-menu__item"
                              onClick={() => {
                                setOpenMenuKey(null);
                                if (doc.fileName) triggerDocumentDownload(doc.id, doc.fileName);
                              }}
                            >
                              Descargar
                            </button>
                            {canApprove && doc.status === 'PENDING' && (
                              <>
                                <button
                                  type="button"
                                  className="docs-actions-menu__item"
                                  onClick={async () => {
                                    setOpenMenuKey(null);
                                    setActionLoading(true);
                                    try {
                                      await approveDocument(doc.id);
                                      await load(currentFolderId, {
                                        q: appliedSearch,
                                        tagIds: appliedTagIds,
                                      });
                                    } catch (err) {
                                      setError(
                                        err instanceof ApiError
                                          ? err.message
                                          : 'No se pudo aprobar',
                                      );
                                    } finally {
                                      setActionLoading(false);
                                    }
                                  }}
                                >
                                  <Check
                                    size={14}
                                    style={{ marginRight: 6, verticalAlign: 'middle' }}
                                  />
                                  Aprobar
                                </button>
                                <button
                                  type="button"
                                  className="docs-actions-menu__item docs-actions-menu__item--danger"
                                  onClick={async () => {
                                    setOpenMenuKey(null);
                                    const reason = window.prompt('Motivo del rechazo (opcional):');
                                    if (reason === null) return;
                                    setActionLoading(true);
                                    try {
                                      await rejectDocument(doc.id, reason || null);
                                      await load(currentFolderId, {
                                        q: appliedSearch,
                                        tagIds: appliedTagIds,
                                      });
                                    } catch (err) {
                                      setError(
                                        err instanceof ApiError
                                          ? err.message
                                          : 'No se pudo rechazar',
                                      );
                                    } finally {
                                      setActionLoading(false);
                                    }
                                  }}
                                >
                                  <X
                                    size={14}
                                    style={{ marginRight: 6, verticalAlign: 'middle' }}
                                  />
                                  Rechazar
                                </button>
                              </>
                            )}
                            {canManage && (
                              <button
                                type="button"
                                className="docs-actions-menu__item docs-actions-menu__item--danger"
                                onClick={() => {
                                  setOpenMenuKey(null);
                                  setPendingDeleteDoc(doc);
                                }}
                              >
                                <Trash2
                                  size={14}
                                  style={{ marginRight: 6, verticalAlign: 'middle' }}
                                />
                                Eliminar
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {showFolderModal && data && (
        <div
          className="docs-modal-overlay"
          role="presentation"
          onClick={() => setShowFolderModal(false)}
        >
          <div
            className="docs-modal"
            role="dialog"
            aria-labelledby="folder-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="folder-modal-title" className="docs-modal__title">
              Nueva carpeta en {data.folder.name}
            </h2>
            <form onSubmit={handleCreateFolder}>
              <label className="admin-form__label" htmlFor="newFolderName">
                Nombre
              </label>
              <input
                id="newFolderName"
                className="admin-form__input mb-3"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                required
                minLength={2}
                disabled={actionLoading}
              />
              <label className="admin-form__label" htmlFor="newFolderDesc">
                Descripción (opcional)
              </label>
              <textarea
                id="newFolderDesc"
                className="admin-form__input admin-form__textarea"
                rows={2}
                value={folderDescription}
                onChange={(e) => setFolderDescription(e.target.value)}
                disabled={actionLoading}
              />
              <div className="docs-modal__actions">
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost"
                  onClick={() => setShowFolderModal(false)}
                  disabled={actionLoading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="admin-btn admin-btn--primary"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Guardando…' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showUploadModal && data && (
        <div
          className="docs-modal-overlay"
          role="presentation"
          onClick={() => setShowUploadModal(false)}
        >
          <div
            className="docs-modal"
            role="dialog"
            aria-labelledby="upload-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="upload-modal-title" className="docs-modal__title">
              Subir archivo a {data.folder.name}
            </h2>
            <form onSubmit={handleUpload}>
              <label className="admin-form__label" htmlFor="docFile">
                Archivo (máx. 20 MB)
              </label>
              <input
                id="docFile"
                type="file"
                className="admin-form__input mb-3"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.txt"
                required
                disabled={actionLoading}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setUploadFile(file);
                  if (file && !uploadName) {
                    setUploadName(file.name.replace(/\.[^.]+$/, ''));
                  }
                }}
              />
              <label className="admin-form__label" htmlFor="docName">
                Nombre del documento
              </label>
              <input
                id="docName"
                className="admin-form__input mb-3"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                required
                disabled={actionLoading}
              />
              <label className="admin-form__label" htmlFor="docDesc">
                Descripción (opcional)
              </label>
              <textarea
                id="docDesc"
                className="admin-form__input admin-form__textarea mb-3"
                rows={2}
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                disabled={actionLoading}
              />
              <label className="admin-form__label" htmlFor="docTags">
                Etiquetas (opcional)
              </label>
              <div className="mb-3 docs-modal__multiselect">
                <MultiSelect
                  id="docTags"
                  options={tagSelectOptions}
                  value={uploadTagIds}
                  onChange={setUploadTagIds}
                  placeholder="Seleccionar etiquetas"
                  disabled={actionLoading}
                  usePortal
                />
              </div>
              <div className="docs-modal__actions">
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost"
                  onClick={() => setShowUploadModal(false)}
                  disabled={actionLoading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="admin-btn admin-btn--primary"
                  disabled={actionLoading || !uploadFile}
                >
                  {actionLoading ? 'Subiendo…' : 'Subir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <DocumentsPendingPanel
        open={showPendingPanel}
        onClose={() => setShowPendingPanel(false)}
        onChanged={() => void load(currentFolderId, { q: appliedSearch, tagIds: appliedTagIds })}
      />

      <DocumentsRejectedPanel
        open={showRejectedPanel}
        onClose={() => setShowRejectedPanel(false)}
      />

      <DocumentPdfPreviewModal
        open={pdfPreview != null}
        documentId={pdfPreview?.id ?? 0}
        fileName={pdfPreview?.fileName ?? ''}
        title={pdfPreview?.title}
        onClose={() => setPdfPreview(null)}
      />

      <ConfirmModal
        open={pendingDeleteFolder != null}
        title="Eliminar carpeta"
        message={
          pendingDeleteFolder ? (
            <>
              Se inactivará la carpeta <strong>{pendingDeleteFolder.name}</strong> y todo su
              contenido (subcarpetas y documentos). Esta acción no borra los archivos de MinIO.
            </>
          ) : null
        }
        variant="danger"
        loading={actionLoading}
        confirmLabel="Eliminar"
        onConfirm={handleDeleteFolder}
        onCancel={() => setPendingDeleteFolder(null)}
      />

      <ConfirmModal
        open={pendingDeleteDoc != null}
        title="Eliminar documento"
        message={
          pendingDeleteDoc ? (
            <>
              ¿Confirma eliminar el documento <strong>{pendingDeleteDoc.name}</strong>? El registro
              quedará inactivo en el repositorio.
            </>
          ) : null
        }
        variant="danger"
        loading={actionLoading}
        confirmLabel="Eliminar"
        onConfirm={handleDeleteDocument}
        onCancel={() => setPendingDeleteDoc(null)}
      />
    </>
  );
}
