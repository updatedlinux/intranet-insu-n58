import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';
import { storage } from '../config/storage';
import {
  buildTicketAttachmentFileKey,
  resolveTicketAttachmentExtension,
  validateTicketAttachmentMimeType,
} from '../utils/ticket-files';

export interface TicketAttachmentObject {
  stream: Readable;
  contentType: string;
  contentLength?: number;
}

export async function uploadTicketAttachmentObject(
  buffer: Buffer,
  mimeType: string,
  originalName: string,
): Promise<{ fileKey: string }> {
  if (!validateTicketAttachmentMimeType(mimeType, originalName)) {
    throw new Error('Tipo de archivo no permitido');
  }

  const extension = resolveTicketAttachmentExtension(mimeType, originalName);
  const fileKey = buildTicketAttachmentFileKey(extension);
  const client = storage.getS3Client();

  await client.send(
    new PutObjectCommand({
      Bucket: storage.getBucketName(),
      Key: fileKey,
      Body: buffer,
      ContentType: mimeType,
    }),
  );

  return { fileKey };
}

export async function getTicketAttachmentObject(fileKey: string): Promise<TicketAttachmentObject> {
  const client = storage.getS3Client();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: storage.getBucketName(),
      Key: fileKey,
    }),
  );

  if (!response.Body) {
    throw new Error('El adjunto no está disponible en almacenamiento');
  }

  return {
    stream: response.Body as Readable,
    contentType: response.ContentType ?? 'application/octet-stream',
    contentLength: response.ContentLength,
  };
}
