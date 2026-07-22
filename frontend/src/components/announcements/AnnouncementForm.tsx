import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import {
  ANNOUNCEMENT_CATEGORY_LABELS,
  type AnnouncementCategory,
} from '../../api/announcements.types';
import { uploadAnnouncementImage } from '../../api/announcements';
import { ApiError } from '../../api/client';
import type { Area } from '../../api/areas.types';
import { TipTapEditor } from './TipTapEditor';
import { Select } from '../ui/Select';
import { hasMeaningfulHtml } from '../../utils/sanitize-html';

const SUMMARY_MAX = 300;

export interface AnnouncementFormValues {
  title: string;
  summary: string;
  content: string;
  category: AnnouncementCategory;
  targetAreaId: string;
  imageUrl: string | null;
  publishNow: boolean;
}

interface AnnouncementFormProps {
  areas: Area[];
  canTargetCompany: boolean;
  initialValues?: Partial<AnnouncementFormValues>;
  initialImagePreviewUrl?: string | null;
  loading?: boolean;
  onSaveDraft: (values: AnnouncementFormValues) => void | Promise<void>;
  onPublish: (values: AnnouncementFormValues) => void | Promise<void>;
  onCancel: () => void;
  showPublishButton?: boolean;
}

const defaults: AnnouncementFormValues = {
  title: '',
  summary: '',
  content: '',
  category: 'NOTICIA',
  targetAreaId: '',
  imageUrl: null,
  publishNow: false,
};

const categories = Object.entries(ANNOUNCEMENT_CATEGORY_LABELS) as [AnnouncementCategory, string][];

export function AnnouncementForm({
  areas,
  canTargetCompany,
  initialValues,
  initialImagePreviewUrl,
  loading = false,
  onSaveDraft,
  onPublish,
  onCancel,
  showPublishButton = true,
}: AnnouncementFormProps) {
  const [values, setValues] = useState<AnnouncementFormValues>({ ...defaults, ...initialValues });
  const [imagePreview, setImagePreview] = useState<string | null>(initialImagePreviewUrl ?? null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState('');
  const [formError, setFormError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialValues) {
      setValues((v) => ({ ...defaults, ...v, ...initialValues }));
    }
  }, [initialValues]);

  const validate = (): boolean => {
    setFormError('');
    if (!values.title.trim()) {
      setFormError('El título es obligatorio');
      return false;
    }
    if (!values.summary.trim() || values.summary.length > SUMMARY_MAX) {
      setFormError(`El resumen debe tener entre 10 y ${SUMMARY_MAX} caracteres`);
      return false;
    }
    if (!hasMeaningfulHtml(values.content)) {
      setFormError('El contenido del comunicado no puede estar vacío');
      return false;
    }
    if (!canTargetCompany && !values.targetAreaId) {
      setFormError('Seleccione el área destino');
      return false;
    }
    return true;
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageError('');
    setUploadingImage(true);
    try {
      const res = await uploadAnnouncementImage(file);
      setValues((v) => ({ ...v, imageUrl: res.imageKey }));
      setImagePreview(URL.createObjectURL(file));
    } catch (err) {
      setImageError(err instanceof ApiError ? err.message : 'No se pudo subir la imagen');
    } finally {
      setUploadingImage(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    void onSaveDraft({ ...values, publishNow: false });
  };

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    void onPublish({ ...values, publishNow: true });
  };

  return (
    <form className="admin-form card-style mb-30 announcement-form">
      {formError && <div className="admin-alert admin-alert--error mb-20">{formError}</div>}

      <div className="admin-form__grid">
        <div className="admin-form__field admin-form__field--full">
          <label className="admin-form__label" htmlFor="annTitle">
            Título
          </label>
          <input
            id="annTitle"
            className="admin-form__input"
            value={values.title}
            onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
            required
            maxLength={255}
          />
        </div>

        <div className="admin-form__field">
          <label className="admin-form__label" htmlFor="annCategory">
            Categoría
          </label>
          <Select
            id="annCategory"
            value={values.category}
            onChange={(v) =>
              setValues((prev) => ({ ...prev, category: v as AnnouncementCategory }))
            }
            options={categories.map(([key, label]) => ({ value: key, label }))}
          />
        </div>

        <div className="admin-form__field">
          <label className="admin-form__label" htmlFor="annArea">
            Área destino
          </label>
          <Select
            id="annArea"
            value={values.targetAreaId}
            onChange={(v) => setValues((prev) => ({ ...prev, targetAreaId: v }))}
            required={!canTargetCompany}
            options={[
              ...(canTargetCompany ? [{ value: '', label: 'Toda la empresa' }] : []),
              ...areas.map((area) => ({ value: String(area.id), label: area.name })),
            ]}
          />
        </div>

        <div className="admin-form__field admin-form__field--full">
          <label className="admin-form__label" htmlFor="annSummary">
            Resumen
            <span className="announcement-form__counter">
              {values.summary.length}/{SUMMARY_MAX}
            </span>
          </label>
          <textarea
            id="annSummary"
            className="admin-form__input"
            rows={3}
            value={values.summary}
            onChange={(e) =>
              setValues((v) => ({ ...v, summary: e.target.value.slice(0, SUMMARY_MAX) }))
            }
            required
            minLength={10}
            maxLength={SUMMARY_MAX}
            placeholder="Breve adelanto para tarjetas y correo de notificación (sin el contenido completo)"
          />
        </div>

        <div className="admin-form__field admin-form__field--full">
          <label className="admin-form__label">Contenido</label>
          <TipTapEditor
            value={values.content}
            onChange={(html) => setValues((v) => ({ ...v, content: html }))}
            disabled={loading || uploadingImage}
          />
        </div>

        <div className="admin-form__field admin-form__field--full">
          <span className="admin-form__label">Imagen destacada (opcional)</span>
          <div className="announcement-form__image-row">
            {imagePreview && (
              <img src={imagePreview} alt="" className="announcement-form__preview" />
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              id="annImage"
              onChange={(e) => void handleImageChange(e)}
            />
            <button
              type="button"
              className="docs-sp-btn docs-sp-btn--secondary"
              onClick={() => fileRef.current?.click()}
              disabled={uploadingImage || loading}
            >
              {uploadingImage ? (
                <Loader2 size={16} className="announcement-spin" aria-hidden />
              ) : (
                <ImagePlus size={16} aria-hidden />
              )}
              {values.imageUrl ? 'Cambiar imagen' : 'Subir imagen'}
            </button>
          </div>
          {imageError && <p className="admin-form__error">{imageError}</p>}
        </div>
      </div>

      <div className="admin-form__actions">
        <button
          type="button"
          className="admin-btn admin-btn--ghost"
          onClick={onCancel}
          disabled={loading}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="admin-btn admin-btn--ghost"
          onClick={handleDraft}
          disabled={loading || uploadingImage}
        >
          {loading ? 'Guardando…' : 'Guardar como borrador'}
        </button>
        {showPublishButton && (
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            onClick={handlePublish}
            disabled={loading || uploadingImage}
          >
            {loading ? 'Publicando…' : 'Publicar'}
          </button>
        )}
      </div>
    </form>
  );
}
