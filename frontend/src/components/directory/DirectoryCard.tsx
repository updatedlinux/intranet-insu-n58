import { Mail } from 'lucide-react';
import type { DirectoryEntry } from '../../api/directory.types';
import { DirectoryAvatar } from './DirectoryAvatar';

interface DirectoryCardProps {
  entry: DirectoryEntry;
  onSelect: (entry: DirectoryEntry) => void;
}

export function DirectoryCard({ entry, onSelect }: DirectoryCardProps) {
  return (
    <article className="directory-card card-style">
      <button
        type="button"
        className="directory-card__main"
        onClick={() => onSelect(entry)}
        aria-label={`Ver perfil de ${entry.fullName}`}
      >
        <DirectoryAvatar
          firstName={entry.firstName}
          lastName={entry.lastName}
          areaId={entry.areaId}
          avatarUrl={entry.avatarUrl}
          size="md"
        />
        <h3 className="directory-card__name">{entry.fullName}</h3>
        <p className="directory-card__position">{entry.positionName}</p>
        <p className="directory-card__area">{entry.areaName}</p>
      </button>
      <a
        href={`mailto:${entry.email}`}
        className="directory-card__email docs-sp-btn docs-sp-btn--secondary"
        onClick={(e) => e.stopPropagation()}
      >
        <Mail size={16} aria-hidden />
        Correo
      </a>
    </article>
  );
}
