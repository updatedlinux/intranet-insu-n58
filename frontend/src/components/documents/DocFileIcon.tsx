import { File, FileImage, FileSpreadsheet, FileText, Folder } from 'lucide-react';
import type { DocumentFileKind } from '../../api/documents.types';

interface DocFileIconProps {
  kind: DocumentFileKind;
  size?: number;
  isFolder?: boolean;
}

const TILE_BG: Record<DocumentFileKind | 'folder', string> = {
  folder: '#fff4ce',
  pdf: '#fde7e9',
  word: '#deecf9',
  excel: '#dff6dd',
  image: '#ede7f6',
  other: '#edebe9',
};

export function DocFileIcon({ kind, size = 20, isFolder }: DocFileIconProps) {
  const props = { size, 'aria-hidden': true as const, className: 'docs-file-icon' };

  if (isFolder) {
    return <Folder {...props} style={{ color: '#d97706', fill: 'rgba(251, 191, 36, 0.45)' }} />;
  }

  switch (kind) {
    case 'pdf':
      return <FileText {...props} style={{ color: '#d13438' }} />;
    case 'word':
      return <FileText {...props} style={{ color: '#185abd' }} />;
    case 'excel':
      return <FileSpreadsheet {...props} style={{ color: '#107c41' }} />;
    case 'image':
      return <FileImage {...props} style={{ color: '#5c2d91' }} />;
    default:
      return <File {...props} style={{ color: '#605e5c' }} />;
  }
}

interface DocFileTileProps {
  kind: DocumentFileKind;
  isFolder?: boolean;
}

/** Icono en mosaico cuadrado, estilo OneDrive */
export function DocFileTile({ kind, isFolder }: DocFileTileProps) {
  const tileKind = isFolder ? 'folder' : kind;
  return (
    <span className="docs-od-tile" style={{ background: TILE_BG[tileKind] }} aria-hidden>
      <DocFileIcon kind={kind} isFolder={isFolder} size={20} />
    </span>
  );
}

export function formatFileSize(bytes: number | null): string {
  if (bytes == null || bytes === 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
