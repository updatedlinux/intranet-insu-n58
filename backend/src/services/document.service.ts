import { DOCUMENT_LOG_ACTIONS, type DocumentLogAction } from '../constants/document-log-actions';
import { DOCUMENT_STATUS, type DocumentStatus } from '../constants/document-status';
import { NOTIFICATION_RESOURCE_TYPES, NOTIFICATION_TYPES } from '../constants/notification-type';
import type { Readable } from 'node:stream';
import { buffer as streamToBuffer } from 'node:stream/consumers';
import type { AppError } from '../middlewares/error.middleware';
import {
  buildCapabilities,
  canApproveInArea,
  canCreateFolderIn,
  canDownloadDocument,
  canManageFolder,
  canReadFolder,
  canUploadToFolder,
  clearAreaAccessCache,
  getReadableAreaIds,
  initialDocumentStatus,
  isAreaLeader,
  isSystemAdmin,
  loadAreaAccess,
  resolveFolderAreaId,
  type DocumentCapabilities,
} from '../policies/document-access.policy';
import { findAreaLeaderEmails } from '../repositories/area-access.repository';
import { insertDocumentLog } from '../repositories/document-log.repository';
import {
  findActiveTagsByIds,
  listTagsForDocuments,
  replaceDocumentTags,
} from '../repositories/document-tag.repository';
import {
  approveDocument,
  countPendingInAreas,
  countRejectedDocuments,
  createDocument,
  createFolder,
  deactivateDocument,
  deactivateFolderTree,
  findDocumentById,
  findDocumentListRowById,
  findFolderById,
  findAreaRootFolder,
  findRootFolder,
  folderNameExistsInParent,
  getFolderAncestors,
  isRootFolder,
  listChildFolders,
  listDocumentsInFolder,
  listMyUploads,
  listPendingDocuments,
  listRejectedDocuments,
  rejectDocument,
  type DocumentListFilters,
  type DocumentListRow,
  type DocumentVisibilityContext,
  type FolderRow,
} from '../repositories/document.repository';
import { findUserById } from '../repositories/user.repository';
import type { AuditContext } from '../types/audit';
import { getDocumentObject, uploadDocumentObject } from './document-storage.service';
import { displayName, emailService, notifyEmail } from './email.service';
import { createNotification, createNotificationsForUsers } from './notification.service';
import type { AuthenticatedUser } from '../types/auth';
import { classifyFileKind, type DocumentFileKind } from '../utils/document-files';

export interface PublicFolder {
  id: number;
  name: string;
  description: string | null;
  parentFolderId: number | null;
  areaId: number | null;
  areaOrphanedAt: string | null;
}

export interface PublicDocumentTag {
  id: number;
  name: string;
}

export interface PublicDocument {
  id: number;
  folderId: number;
  name: string;
  description: string | null;
  tags: PublicDocumentTag[];
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

export interface FolderBrowseResult {
  folder: PublicFolder;
  breadcrumbs: PublicFolder[];
  subfolders: PublicFolder[];
  documents: PublicDocument[];
  capabilities: DocumentCapabilities & { pendingCount: number; rejectedCount: number };
}

export interface ServedDocument {
  fileName: string;
  mimeType: string;
  buffer?: Buffer;
  stream?: Readable;
}

function notFound(message = 'Recurso no encontrado'): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 404;
  return error;
}

function forbidden(message: string): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 403;
  return error;
}

function conflict(message: string): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 409;
  return error;
}

function badRequest(message: string): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 400;
  return error;
}

function toPublicFolder(row: FolderRow): PublicFolder {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    parentFolderId: row.parentFolderId,
    areaId: row.areaId,
    areaOrphanedAt: row.areaOrphanedAt?.toISOString() ?? null,
  };
}

function personName(first: string | null, last: string | null): string | null {
  const name = `${first ?? ''} ${last ?? ''}`.trim();
  return name || null;
}

function toPublicDocument(
  row: DocumentListRow,
  tagMap: Map<number, PublicDocumentTag[]>,
  userId: number,
): PublicDocument {
  return {
    id: row.id,
    folderId: row.folderId,
    name: row.name,
    description: row.description,
    tags: tagMap.get(row.id) ?? [],
    status: row.status,
    fileKind: classifyFileKind(row.mimeType ?? '', row.fileName ?? undefined),
    fileName: row.fileName,
    mimeType: row.mimeType,
    fileSize: row.fileSize != null ? Number(row.fileSize) : null,
    areaId: row.areaId,
    areaName: row.areaName,
    uploadedByName: personName(row.uploadedByFirstName, row.uploadedByLastName),
    uploadedAt: row.createdAt.toISOString(),
    approvedByName: personName(row.approvedByFirstName, row.approvedByLastName),
    approvedAt: row.approvedAt?.toISOString() ?? null,
    rejectionReason: row.rejectionReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    isOwnUpload: row.createdBy === userId,
  };
}

async function logDocumentAction(
  documentId: number,
  userId: number,
  action: DocumentLogAction,
  auditContext?: AuditContext,
): Promise<void> {
  try {
    await insertDocumentLog({
      documentId,
      userId,
      action,
      ipAddress: auditContext?.ipAddress,
      userAgent: auditContext?.userAgent,
    });
  } catch (error) {
    console.error('[documents] No se pudo registrar DocumentLog:', error);
  }
}

async function buildDocumentTagMap(
  documentIds: number[],
): Promise<Map<number, PublicDocumentTag[]>> {
  const links = await listTagsForDocuments(documentIds);
  const map = new Map<number, PublicDocumentTag[]>();
  for (const link of links) {
    const list = map.get(link.documentId) ?? [];
    list.push({ id: link.tagId, name: link.tagName });
    map.set(link.documentId, list);
  }
  return map;
}

async function assertValidTagIds(tagIds: number[]): Promise<void> {
  if (tagIds.length === 0) return;
  const active = await findActiveTagsByIds(tagIds);
  if (active.length !== tagIds.length) {
    throw badRequest('Una o más etiquetas no existen o están inactivas');
  }
}

async function getApprovableAreaIds(user: AuthenticatedUser): Promise<number[]> {
  if (isSystemAdmin(user)) return [];
  const ids = new Set<number>();
  for (const id of user.ledAreaIds) ids.add(id);
  if (user.position.isLeader) ids.add(user.area.id);
  const grants = await loadAreaAccess(user.area.id);
  for (const g of grants) {
    if (g.isActive && g.canApprove) ids.add(g.targetAreaId);
  }
  return [...ids];
}

function pendingScope(user: AuthenticatedUser, approvableAreaIds: number[]): number[] | null {
  if (isSystemAdmin(user)) return null;
  return approvableAreaIds;
}

function rejectedScope(
  user: AuthenticatedUser,
  approvableAreaIds: number[],
): {
  userId: number;
  isAdmin: boolean;
  approvableAreaIds: number[];
} {
  return {
    userId: user.id,
    isAdmin: isSystemAdmin(user),
    approvableAreaIds: isSystemAdmin(user) ? [] : approvableAreaIds,
  };
}

async function buildVisibilityContext(user: AuthenticatedUser): Promise<DocumentVisibilityContext> {
  const readableAreaIds = isSystemAdmin(user) ? [] : await getReadableAreaIds(user);
  const approvableAreaIds = await getApprovableAreaIds(user);
  return {
    userId: user.id,
    userAreaId: user.area.id,
    isAdmin: isSystemAdmin(user),
    isAreaLeader: isAreaLeader(user),
    readableAreaIds,
    approvableAreaIds,
  };
}

async function resolveFolder(folderId: number | null, user: AuthenticatedUser): Promise<FolderRow> {
  if (folderId != null) {
    const folder = await findFolderById(folderId);
    if (!folder) throw notFound('Carpeta no encontrada');
    return folder;
  }

  if (isSystemAdmin(user)) {
    const root = await findRootFolder();
    if (!root) throw notFound('Carpeta raíz no configurada');
    return root;
  }

  const areaFolder = await findAreaRootFolder(user.area.id);
  if (!areaFolder) throw notFound('No hay repositorio configurado para su área');
  return areaFolder;
}

async function assertFolderReadable(user: AuthenticatedUser, folder: FolderRow): Promise<void> {
  if (!(await canReadFolder(user, folder))) {
    throw forbidden('No tiene permisos para acceder a esta carpeta');
  }
}

export async function browseFolderService(
  user: AuthenticatedUser,
  folderId: number | null,
  filters: DocumentListFilters = {},
): Promise<FolderBrowseResult> {
  const folder = await resolveFolder(folderId, user);
  await assertFolderReadable(user, folder);

  const visibility = await buildVisibilityContext(user);
  const readableAreaIds = isSystemAdmin(user) ? null : await getReadableAreaIds(user);
  const approvableAreaIds = await getApprovableAreaIds(user);

  const scope = rejectedScope(user, approvableAreaIds);

  const [subfolders, documents, ancestors, capabilities, pendingCount, rejectedCount] =
    await Promise.all([
      listChildFolders(folder.id, readableAreaIds),
      listDocumentsInFolder(folder.id, filters, visibility),
      getFolderAncestors(folder.id),
      buildCapabilities(user, folder),
      countPendingInAreas(pendingScope(user, approvableAreaIds)),
      countRejectedDocuments(scope.userId, scope.isAdmin, scope.approvableAreaIds),
    ]);

  const tagMap = await buildDocumentTagMap(documents.map((d) => d.id));

  return {
    folder: toPublicFolder(folder),
    breadcrumbs: ancestors.map(toPublicFolder),
    subfolders: subfolders.map(toPublicFolder),
    documents: documents.map((row) => toPublicDocument(row, tagMap, user.id)),
    capabilities: { ...capabilities, pendingCount, rejectedCount },
  };
}

export async function createFolderService(
  user: AuthenticatedUser,
  data: {
    name: string;
    description: string | null;
    parentFolderId: number;
    areaId: number | null;
  },
): Promise<PublicFolder> {
  const parent = await findFolderById(data.parentFolderId);
  if (!parent || !parent.isActive) throw notFound('Carpeta padre no encontrada');
  await assertFolderReadable(user, parent);

  if (!(await canCreateFolderIn(user, parent))) {
    throw forbidden('Solo un gerente de área o administrador puede crear carpetas');
  }

  const areaId = resolveFolderAreaId(parent, user, data.areaId);
  if (areaId == null && !isSystemAdmin(user)) {
    throw badRequest('Debe crear carpetas dentro del repositorio de su área');
  }

  if (await folderNameExistsInParent(data.name, data.parentFolderId)) {
    throw conflict('Ya existe una carpeta con ese nombre en esta ubicación');
  }

  const id = await createFolder({ ...data, areaId });
  const created = await findFolderById(id);
  if (!created) throw notFound();
  return toPublicFolder(created);
}

export interface UploadFileInput {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

export async function uploadDocumentService(
  user: AuthenticatedUser,
  meta: {
    folderId: number;
    name: string;
    description: string | null;
    tagIds: number[];
  },
  file: UploadFileInput,
  auditContext?: AuditContext,
): Promise<{ document: PublicDocument }> {
  const folder = await findFolderById(meta.folderId);
  if (!folder || !folder.isActive) throw notFound('Carpeta destino no encontrada');
  await assertFolderReadable(user, folder);

  if (!(await canUploadToFolder(user, folder))) {
    throw forbidden('No tiene permisos para subir archivos en esta carpeta');
  }

  if (!file.buffer?.length) throw badRequest('No se recibió ningún archivo');
  await assertValidTagIds(meta.tagIds);

  const areaId = folder.areaId ?? user.area.id;
  const status = initialDocumentStatus(user);
  const autoApprove = status === DOCUMENT_STATUS.APPROVED;

  try {
    const { fileKey } = await uploadDocumentObject(file.buffer, file.mimetype, file.originalname);
    const documentId = await createDocument({
      folderId: meta.folderId,
      name: meta.name,
      description: meta.description,
      areaId,
      status,
      fileName: file.originalname,
      fileKey,
      fileSize: file.size,
      mimeType: file.mimetype,
      createdBy: user.id,
      approvedBy: autoApprove ? user.id : null,
      approvedAt: autoApprove ? new Date() : null,
    });

    if (meta.tagIds.length > 0) {
      await replaceDocumentTags(documentId, meta.tagIds);
    }

    await logDocumentAction(documentId, user.id, DOCUMENT_LOG_ACTIONS.UPLOAD, auditContext);

    if (status === DOCUMENT_STATUS.PENDING && areaId != null) {
      notifyAreaLeadersPendingUpload(areaId, documentId, meta.name, user);
    }

    const row = await findDocumentListRowById(documentId);
    const tagMap = await buildDocumentTagMap([documentId]);
    if (!row) throw notFound();

    return { document: toPublicDocument(row, tagMap, user.id) };
  } catch (error) {
    if ((error as AppError).statusCode) throw error;
    console.error('[documents] Error al subir documento:', error);
    throw badRequest(error instanceof Error ? error.message : 'No se pudo guardar el archivo');
  }
}

function notifyAreaLeadersPendingUpload(
  areaId: number,
  documentId: number,
  documentName: string,
  uploader: AuthenticatedUser,
): void {
  void (async () => {
    try {
      const leaders = await findAreaLeaderEmails(areaId);
      const leaderIds = leaders.map((l) => l.id).filter((id) => id !== uploader.id);
      if (leaderIds.length === 0) return;

      const uploaderName = displayName(uploader.firstName, uploader.lastName);
      await createNotificationsForUsers(
        leaderIds,
        NOTIFICATION_TYPES.DOCUMENT_PENDING,
        'Documento pendiente de aprobación',
        `${uploaderName} subió "${documentName}" en ${uploader.area.name}`,
        NOTIFICATION_RESOURCE_TYPES.DOCUMENT,
        documentId,
      );
    } catch (error) {
      console.error(
        `[notifications] Error pending-upload area=${areaId}:`,
        error instanceof Error ? error.message : error,
      );
    }
  })();

  notifyEmail(async () => {
    const leaders = await findAreaLeaderEmails(areaId);
    if (leaders.length === 0) return false;
    const uploaderName = displayName(uploader.firstName, uploader.lastName);
    let sent = false;
    for (const leader of leaders) {
      const ok = await emailService.sendDocumentPendingApproval(
        leader.email,
        displayName(leader.firstName, leader.lastName),
        documentName,
        uploaderName,
        uploader.area.name,
      );
      sent = sent || ok;
    }
    return sent;
  }, `pending-upload area=${areaId} doc=${documentName}`);
}

export async function serveDocumentService(
  user: AuthenticatedUser,
  documentId: number,
  action: DocumentLogAction,
  auditContext?: AuditContext,
): Promise<ServedDocument> {
  const document = await findDocumentById(documentId);
  if (!document || !document.isActive) throw notFound('Documento no encontrado');

  if (!(await canDownloadDocument(user, document))) {
    throw forbidden('No tiene permisos para descargar este documento');
  }

  if (!document.fileKey || !document.fileName || !document.mimeType) {
    throw notFound('El documento no tiene archivo disponible');
  }

  await logDocumentAction(documentId, user.id, action, auditContext);

  const object = await getDocumentObject(document.fileKey);
  const knownSize = document.fileSize ?? object.contentLength ?? 0;

  if (knownSize > 0 && knownSize <= 1024 * 1024) {
    const buffer = await streamToBuffer(object.stream);
    return {
      fileName: document.fileName,
      mimeType: document.mimeType,
      buffer,
    };
  }

  return {
    fileName: document.fileName,
    mimeType: document.mimeType,
    stream: object.stream,
  };
}

export async function approveDocumentService(
  user: AuthenticatedUser,
  documentId: number,
  auditContext?: AuditContext,
): Promise<PublicDocument> {
  const document = await findDocumentById(documentId);
  if (!document || !document.isActive) throw notFound('Documento no encontrado');
  if (document.status !== DOCUMENT_STATUS.PENDING) {
    throw badRequest('Solo se pueden aprobar documentos pendientes');
  }
  if (document.areaId == null || !(await canApproveInArea(user, document.areaId))) {
    throw forbidden('No tiene permisos para aprobar documentos de esta área');
  }

  await approveDocument(documentId, user.id);
  await logDocumentAction(documentId, user.id, DOCUMENT_LOG_ACTIONS.UPDATE, auditContext);

  const uploader = await findUserById(document.createdBy);
  if (uploader) {
    void createNotification(
      uploader.id,
      NOTIFICATION_TYPES.DOCUMENT_APPROVED,
      'Documento aprobado',
      `Su documento "${document.name}" fue aprobado`,
      NOTIFICATION_RESOURCE_TYPES.DOCUMENT,
      documentId,
    ).catch((error) => {
      console.error(
        `[notifications] Error approved doc=${documentId}:`,
        error instanceof Error ? error.message : error,
      );
    });

    notifyEmail(
      () =>
        emailService.sendDocumentApproved(
          uploader.email,
          displayName(uploader.firstName, uploader.lastName),
          document.name,
        ),
      `approved doc=${documentId}`,
    );
  }

  const row = await findDocumentListRowById(documentId);
  const tagMap = await buildDocumentTagMap([documentId]);
  if (!row) throw notFound();
  return toPublicDocument(row, tagMap, user.id);
}

export async function rejectDocumentService(
  user: AuthenticatedUser,
  documentId: number,
  reason: string | null,
  auditContext?: AuditContext,
): Promise<PublicDocument> {
  const document = await findDocumentById(documentId);
  if (!document || !document.isActive) throw notFound('Documento no encontrado');
  if (document.status !== DOCUMENT_STATUS.PENDING) {
    throw badRequest('Solo se pueden rechazar documentos pendientes');
  }
  if (document.areaId == null || !(await canApproveInArea(user, document.areaId))) {
    throw forbidden('No tiene permisos para rechazar documentos de esta área');
  }

  await rejectDocument(documentId, user.id, reason);
  await logDocumentAction(documentId, user.id, DOCUMENT_LOG_ACTIONS.UPDATE, auditContext);

  const uploader = await findUserById(document.createdBy);
  if (uploader) {
    const reasonText = reason?.trim() ? ` Motivo: ${reason.trim()}` : '';
    void createNotification(
      uploader.id,
      NOTIFICATION_TYPES.DOCUMENT_REJECTED,
      'Documento rechazado',
      `Su documento "${document.name}" fue rechazado.${reasonText}`,
      NOTIFICATION_RESOURCE_TYPES.DOCUMENT,
      documentId,
    ).catch((error) => {
      console.error(
        `[notifications] Error rejected doc=${documentId}:`,
        error instanceof Error ? error.message : error,
      );
    });

    notifyEmail(
      () =>
        emailService.sendDocumentRejected(
          uploader.email,
          displayName(uploader.firstName, uploader.lastName),
          document.name,
          reason,
        ),
      `rejected doc=${documentId}`,
    );
  }

  const row = await findDocumentListRowById(documentId);
  const tagMap = await buildDocumentTagMap([documentId]);
  if (!row) throw notFound();
  return toPublicDocument(row, tagMap, user.id);
}

export async function listPendingDocumentsService(
  user: AuthenticatedUser,
): Promise<PublicDocument[]> {
  const approvableAreaIds = await getApprovableAreaIds(user);
  if (!isSystemAdmin(user) && approvableAreaIds.length === 0) {
    throw forbidden('No tiene permisos para ver pendientes de aprobación');
  }

  const rows = await listPendingDocuments(pendingScope(user, approvableAreaIds));
  const tagMap = await buildDocumentTagMap(rows.map((r) => r.id));
  return rows.map((row) => toPublicDocument(row, tagMap, user.id));
}

export async function listRejectedDocumentsService(
  user: AuthenticatedUser,
): Promise<PublicDocument[]> {
  const approvableAreaIds = await getApprovableAreaIds(user);
  const scope = rejectedScope(user, approvableAreaIds);
  const rows = await listRejectedDocuments(scope.userId, scope.isAdmin, scope.approvableAreaIds);
  const tagMap = await buildDocumentTagMap(rows.map((r) => r.id));
  return rows.map((row) => toPublicDocument(row, tagMap, user.id));
}

export async function listMyUploadsService(user: AuthenticatedUser): Promise<PublicDocument[]> {
  const rows = await listMyUploads(user.id);
  const tagMap = await buildDocumentTagMap(rows.map((r) => r.id));
  return rows.map((row) => toPublicDocument(row, tagMap, user.id));
}

export async function deleteDocumentService(
  user: AuthenticatedUser,
  documentId: number,
  auditContext?: AuditContext,
): Promise<void> {
  const document = await findDocumentById(documentId);
  if (!document || !document.isActive) throw notFound('Documento no encontrado');

  const folder = await findFolderById(document.folderId);
  if (!folder) throw notFound();

  const canDelete =
    isSystemAdmin(user) || (document.areaId != null && (await canManageFolder(user, folder)));

  if (!canDelete) {
    throw forbidden('No tiene permisos para eliminar este documento');
  }

  await deactivateDocument(documentId);
  await logDocumentAction(documentId, user.id, DOCUMENT_LOG_ACTIONS.DELETE, auditContext);
}

export async function deleteFolderService(
  user: AuthenticatedUser,
  folderId: number,
  auditContext?: AuditContext,
): Promise<void> {
  const folder = await findFolderById(folderId);
  if (!folder || !folder.isActive) throw notFound('Carpeta no encontrada');

  if (await isRootFolder(folderId)) {
    throw forbidden('No se puede eliminar la carpeta raíz del repositorio');
  }

  const canDelete = isSystemAdmin(user) || (await canManageFolder(user, folder));
  if (!canDelete) {
    throw forbidden('No tiene permisos para eliminar esta carpeta');
  }

  const documents = await listDocumentsInFolder(folderId, {}, await buildVisibilityContext(user));
  await deactivateFolderTree(folderId);

  for (const doc of documents) {
    await logDocumentAction(doc.id, user.id, DOCUMENT_LOG_ACTIONS.DELETE, auditContext);
  }
}

export { clearAreaAccessCache };
