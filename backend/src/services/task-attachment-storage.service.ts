import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';
import { storage } from '../config/storage';
import {
  buildTaskAttachmentFileKey,
  resolveTaskAttachmentExtension,
  validateTaskAttachmentMimeType,
} from '../utils/task-files';

export interface TaskAttachmentObject {
  stream: Readable;
  contentType: string;
  contentLength?: number;
}

export async function uploadTaskAttachmentObject(
  taskId: number,
  buffer: Buffer,
  mimeType: string,
  originalName: string,
): Promise<{ fileKey: string }> {
  if (!validateTaskAttachmentMimeType(mimeType, originalName)) {
    throw new Error('Tipo de archivo no permitido');
  }

  const extension = resolveTaskAttachmentExtension(mimeType, originalName);
  const fileKey = buildTaskAttachmentFileKey(taskId, extension);
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

export async function getTaskAttachmentObject(fileKey: string): Promise<TaskAttachmentObject> {
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

export async function deleteTaskAttachmentObject(fileKey: string): Promise<void> {
  const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
  const client = storage.getS3Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: storage.getBucketName(),
      Key: fileKey,
    }),
  );
}
