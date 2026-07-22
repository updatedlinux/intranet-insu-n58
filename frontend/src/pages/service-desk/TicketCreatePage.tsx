import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Paperclip, X } from 'lucide-react';
import { ApiError } from '../../api/client';
import { fetchActiveTicketCategories } from '../../api/ticket-categories';
import type { TicketCategory } from '../../api/ticket-categories.types';
import { createTicket } from '../../api/tickets';
import type { TicketPriority } from '../../api/tickets.types';
import { PageHeader } from '../../components/layout';
import { Select } from '../../components/ui/Select';

const MAX_FILES = 5;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'svg'];
const ACCEPT_ATTR = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.svg';

const priorities: { value: TicketPriority; label: string }[] = [
  { value: 'Low', label: 'Baja' },
  { value: 'Medium', label: 'Media' },
  { value: 'High', label: 'Alta' },
  { value: 'Critical', label: 'Crítica' },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isAllowedFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return ACCEPTED_EXTENSIONS.includes(ext);
}

export function TicketCreatePage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('Medium');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [error, setError] = useState('');

  const handleFilesSelected = (fileList: FileList | null) => {
    if (!fileList?.length) return;
    setError('');

    const next = [...attachments];
    for (const file of Array.from(fileList)) {
      if (next.length >= MAX_FILES) {
        setError(`Puede adjuntar hasta ${MAX_FILES} archivos`);
        break;
      }
      if (!isAllowedFile(file)) {
        setError(`"${file.name}" no es un tipo permitido (PDF, Word, JPG, PNG o SVG)`);
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        setError(`"${file.name}" supera el tamaño máximo de 20 MB`);
        continue;
      }
      if (next.some((existing) => existing.name === file.name && existing.size === file.size)) {
        continue;
      }
      next.push(file);
    }
    setAttachments(next);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetchActiveTicketCategories();
        setCategories(res.items);
        if (res.items[0]) setCategoryId(String(res.items[0].id));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudieron cargar las categorías');
      } finally {
        setLoadingCategories(false);
      }
    })();
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!title.trim() || !description.trim() || !categoryId) {
      setError('Complete título, categoría y descripción');
      return;
    }
    setLoading(true);
    void (async () => {
      try {
        const res = await createTicket(
          {
            title: title.trim(),
            description: description.trim(),
            categoryId: Number.parseInt(categoryId, 10),
            priority,
          },
          attachments,
        );
        navigate(`/service-desk/${res.item.id}`);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo crear el ticket');
      } finally {
        setLoading(false);
      }
    })();
  };

  return (
    <>
      <PageHeader
        title="Nuevo requerimiento"
        breadcrumbParent="Solicitud de Soporte TI"
        breadcrumbCurrent="Alta"
        breadcrumbParentHref="/service-desk"
      />

      {loadingCategories ? (
        <p className="text-gray">Cargando categorías…</p>
      ) : categories.length === 0 ? (
        <div className="admin-alert admin-alert--error mb-20">
          No hay categorías activas. Un administrador debe configurarlas en Administración →
          Categorías Soporte TI.
        </div>
      ) : null}

      <form className="admin-form card-style mb-30" onSubmit={handleSubmit}>
        {error && <div className="admin-alert admin-alert--error mb-20">{error}</div>}

        <div className="admin-form__grid">
          <div className="admin-form__field admin-form__field--full">
            <label className="admin-form__label" htmlFor="sdTitle">
              Título
            </label>
            <input
              id="sdTitle"
              className="admin-form__input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={255}
            />
          </div>

          <div className="admin-form__field">
            <label className="admin-form__label" htmlFor="sdCategory">
              Categoría
            </label>
            <Select
              id="sdCategory"
              value={categoryId}
              onChange={setCategoryId}
              placeholder="Seleccionar…"
              disabled={loadingCategories || categories.length === 0}
              options={categories.map((c) => ({ value: String(c.id), label: c.name }))}
            />
          </div>

          <div className="admin-form__field">
            <label className="admin-form__label" htmlFor="sdPriority">
              Prioridad
            </label>
            <Select
              id="sdPriority"
              value={priority}
              onChange={(v) => setPriority(v as TicketPriority)}
              options={priorities.map((p) => ({ value: p.value, label: p.label }))}
            />
          </div>

          <div className="admin-form__field admin-form__field--full">
            <label className="admin-form__label" htmlFor="sdDesc">
              Descripción
            </label>
            <textarea
              id="sdDesc"
              className="admin-form__input"
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              placeholder="Describa el incidente o solicitud con el mayor detalle posible"
            />
          </div>

          <div className="admin-form__field admin-form__field--full">
            <label className="admin-form__label" htmlFor="sdFiles">
              Adjuntos <span className="text-gray">(opcional)</span>
            </label>
            <p className="sd-attachments-hint">
              Hasta {MAX_FILES} archivos, 20 MB cada uno. PDF, Word, JPG, PNG o SVG.
            </p>
            <input
              ref={fileInputRef}
              id="sdFiles"
              type="file"
              className="admin-form__input"
              accept={ACCEPT_ATTR}
              multiple
              disabled={loading || attachments.length >= MAX_FILES}
              onChange={(e) => handleFilesSelected(e.target.files)}
            />
            {attachments.length > 0 && (
              <ul className="sd-attachments-list">
                {attachments.map((file, index) => (
                  <li
                    key={`${file.name}-${file.size}-${index}`}
                    className="sd-attachments-list__item"
                  >
                    <Paperclip size={14} aria-hidden />
                    <span className="sd-attachments-list__name">{file.name}</span>
                    <span className="sd-attachments-list__size">{formatFileSize(file.size)}</span>
                    <button
                      type="button"
                      className="sd-attachments-list__remove"
                      onClick={() => removeAttachment(index)}
                      aria-label={`Quitar ${file.name}`}
                    >
                      <X size={14} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="admin-form__actions">
          <button
            type="button"
            className="admin-btn admin-btn--ghost"
            onClick={() => navigate('/service-desk')}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="admin-btn admin-btn--primary"
            disabled={loading || loadingCategories || categories.length === 0}
          >
            {loading ? 'Enviando…' : 'Enviar ticket'}
          </button>
        </div>
      </form>
    </>
  );
}
