export const DOCUMENT_LOG_ACTIONS = {
  DOWNLOAD: 'DOWNLOAD',
  VIEW: 'VIEW',
  UPLOAD: 'UPLOAD',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
} as const;

export type DocumentLogAction = (typeof DOCUMENT_LOG_ACTIONS)[keyof typeof DOCUMENT_LOG_ACTIONS];
