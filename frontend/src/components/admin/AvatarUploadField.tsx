import { useEffect, useId, useRef, useState } from 'react';
import { UserAvatar } from './UserAvatar';

const ACCEPT = 'image/jpeg,image/jpg,image/png,image/webp';
const MAX_BYTES = 2 * 1024 * 1024;

interface AvatarUploadFieldProps {
  userId?: number;
  firstName: string;
  lastName: string;
  currentAvatarUrl?: string | null;
  disabled?: boolean;
  onFileChange: (file: File | null) => void;
  onRemoveExisting?: () => void;
  removePending?: boolean;
}

export function AvatarUploadField({
  userId = 0,
  firstName,
  lastName,
  currentAvatarUrl,
  disabled = false,
  onFileChange,
  onRemoveExisting,
  removePending = false,
}: AvatarUploadFieldProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [localError, setLocalError] = useState('');

  const displayUrl = removePending ? null : (previewUrl ?? currentAvatarUrl ?? null);
  const showRemove =
    Boolean(onRemoveExisting) && Boolean(currentAvatarUrl) && !previewUrl && !removePending;

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFile = (file: File | null) => {
    setLocalError('');
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }

    if (!file) {
      onFileChange(null);
      return;
    }

    if (!ACCEPT.split(',').includes(file.type)) {
      setLocalError('Use JPG, PNG o WebP');
      onFileChange(null);
      return;
    }

    if (file.size > MAX_BYTES) {
      setLocalError('La imagen no puede superar 2 MB');
      onFileChange(null);
      return;
    }

    setPreviewUrl(URL.createObjectURL(file));
    onFileChange(file);
  };

  return (
    <div className="avatar-upload-field">
      <div className="avatar-upload-field__preview">
        <UserAvatar
          userId={userId}
          firstName={firstName}
          lastName={lastName}
          avatarUrl={displayUrl}
          size="lg"
        />
      </div>
      <div className="avatar-upload-field__controls">
        <label htmlFor={inputId} className="admin-btn admin-btn--ghost admin-btn--sm">
          {displayUrl ? 'Cambiar foto' : 'Subir foto'}
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={ACCEPT}
          className="avatar-upload-field__input"
          disabled={disabled}
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        {showRemove && (
          <button
            type="button"
            className="admin-btn admin-btn--ghost admin-btn--sm"
            disabled={disabled}
            onClick={() => onRemoveExisting?.()}
          >
            Eliminar foto
          </button>
        )}
        {previewUrl && (
          <button
            type="button"
            className="admin-btn admin-btn--ghost admin-btn--sm"
            disabled={disabled}
            onClick={() => {
              handleFile(null);
              if (inputRef.current) inputRef.current.value = '';
            }}
          >
            Quitar selección
          </button>
        )}
        <p className="avatar-upload-field__hint text-sm text-gray">
          Opcional · JPG, PNG o WebP · máx. 2 MB
        </p>
        {localError && <p className="avatar-upload-field__error">{localError}</p>}
      </div>
    </div>
  );
}
