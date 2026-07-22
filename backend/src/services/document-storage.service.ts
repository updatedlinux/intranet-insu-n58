import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';
import { storage } from '../config/storage';
import {
  buildDocumentFileKey,
  resolveDocumentExtension,
  validateDocumentMimeType,
} from '../utils/document-files';

export interface DocumentObject {
  stream: Readable;
  contentType: string;
  contentLength?: number;
}

export async function uploadDocumentObject(
  buffer: Buffer,
  mimeType: string,
  originalName?: string,
): Promise<{ fileKey: string; extension: string }> {
  if (!validateDocumentMimeType(mimeType)) {
    throw new Error('Tipo de archivo no permitido');
  }

  const extension = resolveDocumentExtension(mimeType, originalName);
  const fileKey = buildDocumentFileKey(extension);
  const client = storage.getS3Client();

  await client.send(
    new PutObjectCommand({
      Bucket: storage.getBucketName(),
      Key: fileKey,
      Body: buffer,
      ContentType: mimeType,
    }),
  );

  return { fileKey, extension };
}

export async function getDocumentObject(fileKey: string): Promise<DocumentObject> {
  const client = storage.getS3Client();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: storage.getBucketName(),
      Key: fileKey,
    }),
  );

  if (!response.Body) {
    throw new Error('El documento no está disponible en almacenamiento');
  }

  return {
    stream: response.Body as Readable,
    contentType: response.ContentType ?? 'application/octet-stream',
    contentLength: response.ContentLength,
  };
}

const DEFAULT_SIGNED_URL_TTL_SECONDS = 15 * 60;

/** URL firmada temporal (p. ej. imágenes embebidas en comunicados). */
export async function getSignedDownloadUrl(
  fileKey: string,
  expiresInSeconds = DEFAULT_SIGNED_URL_TTL_SECONDS,
  options?: { inline?: boolean; fileName?: string },
): Promise<string> {
  const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
  const client = storage.getS3Client();
  const commandInput: ConstructorParameters<typeof GetObjectCommand>[0] = {
    Bucket: storage.getBucketName(),
    Key: fileKey,
  };

  if (options?.inline && options.fileName) {
    const safeName = options.fileName.replace(/[^\w.\-() ]/g, '_');
    commandInput.ResponseContentDisposition = `inline; filename="${safeName}"`;
  }

  const command = new GetObjectCommand(commandInput);

  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

export { DEFAULT_SIGNED_URL_TTL_SECONDS };
