import { Mail, X } from 'lucide-react';
import type { DirectoryEntry } from '../../api/directory.types';
import { DirectoryAvatar } from './DirectoryAvatar';

interface DirectoryProfileModalProps {
  entry: DirectoryEntry | null;
  onClose: () => void;
}

export function DirectoryProfileModal({ entry, onClose }: DirectoryProfileModalProps) {
  if (!entry) return null;

  return (
    <div className="directory-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="directory-modal card-style"
        role="dialog"
        aria-modal="true"
        aria-labelledby="directory-profile-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="directory-modal__close"
          onClick={onClose}
          aria-label="Cerrar"
        >
          <X size={20} aria-hidden />
        </button>

        <div className="directory-modal__header">
          <DirectoryAvatar
            firstName={entry.firstName}
            lastName={entry.lastName}
            areaId={entry.areaId}
            avatarUrl={entry.avatarUrl}
            size="lg"
          />
          <div>
            <h3 id="directory-profile-title" className="directory-modal__name">
              {entry.fullName}
            </h3>
            <p className="directory-modal__role">{entry.positionName}</p>
            <p className="directory-modal__area">{entry.areaName}</p>
          </div>
        </div>

        <div className="directory-modal__body">
          <dl className="directory-modal__details">
            <div>
              <dt>Correo corporativo</dt>
              <dd>
                <a href={`mailto:${entry.email}`}>{entry.email}</a>
              </dd>
            </div>
            <div>
              <dt>Área</dt>
              <dd>{entry.areaName}</dd>
            </div>
            <div>
              <dt>Cargo</dt>
              <dd>{entry.positionName}</dd>
            </div>
          </dl>
        </div>

        <div className="directory-modal__actions">
          <a href={`mailto:${entry.email}`} className="docs-sp-btn docs-sp-btn--primary">
            <Mail size={16} aria-hidden />
            Enviar correo
          </a>
        </div>
      </div>
    </div>
  );
}
