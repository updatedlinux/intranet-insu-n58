export type DocumentFileKind = 'pdf' | 'word' | 'excel' | 'image' | 'other';

export type DocumentStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';

export interface DocTagRef {
  id: number;
  name: string;
}

export interface DocFolder {
  id: number;
  name: string;
  description: string | null;
  parentFolderId: number | null;
  areaId: number | null;
  areaOrphanedAt?: string | null;
}

export interface DocCapabilities {
  isAdmin: boolean;
  isAreaLeader: boolean;
  canCreateFolder: boolean;
  canUpload: boolean;
  canApprove: boolean;
  readableAreaIds: number[];
  pendingCount: number;
  rejectedCount: number;
}

export interface DocDocument {
  id: number;
  folderId: number;
  name: string;
  description: string | null;
  tags: DocTagRef[];
  status: DocumentStatus;
  fileKind: DocumentFileKind;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  areaId: number | null;
  areaName: string | null;
  uploadedByName: string | null;
  uploadedAt: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  isOwnUpload: boolean;
}

export interface FolderBrowseResponse {
  folder: DocFolder;
  breadcrumbs: DocFolder[];
  subfolders: DocFolder[];
  documents: DocDocument[];
  capabilities: DocCapabilities;
}

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
  ARCHIVED: 'Archivado',
};
