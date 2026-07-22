import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';
import { storage } from '../config/storage';
import type { ByteRange } from '../utils/range-parser';

export interface LearningObjectResult {
  stream: Readable;
  contentType: string;
  contentLength: number;
  contentRange?: { start: number; end: number; total: number };
  isPartial: boolean;
}

export async function uploadLearningObject(
  fileKey: string,
  buffer: Buffer,
  mimeType: string,
): Promise<void> {
  const client = storage.getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: storage.getBucketName(),
      Key: fileKey,
      Body: buffer,
      ContentType: mimeType,
    }),
  );
}

export async function headLearningObject(fileKey: string): Promise<number> {
  const client = storage.getS3Client();
  const response = await client.send(
    new HeadObjectCommand({
      Bucket: storage.getBucketName(),
      Key: fileKey,
    }),
  );
  return response.ContentLength ?? 0;
}

export async function getLearningObject(
  fileKey: string,
  range?: ByteRange,
  fallbackMime = 'application/octet-stream',
  totalFileSize?: number,
): Promise<LearningObjectResult> {
  const client = storage.getS3Client();
  const commandInput: ConstructorParameters<typeof GetObjectCommand>[0] = {
    Bucket: storage.getBucketName(),
    Key: fileKey,
  };

  if (range) {
    commandInput.Range = `bytes=${range.start}-${range.end}`;
  }

  const response = await client.send(new GetObjectCommand(commandInput));

  if (!response.Body) {
    throw new Error('Archivo no disponible en almacenamiento');
  }

  const contentLength =
    range != null ? range.end - range.start + 1 : (response.ContentLength ?? totalFileSize ?? 0);

  const total = totalFileSize ?? contentLength;

  return {
    stream: response.Body as Readable,
    contentType: response.ContentType ?? fallbackMime,
    contentLength,
    contentRange: range != null ? { start: range.start, end: range.end, total } : undefined,
    isPartial: range != null,
  };
}

export async function deleteLearningObject(fileKey: string): Promise<void> {
  const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
  const client = storage.getS3Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: storage.getBucketName(),
      Key: fileKey,
    }),
  );
}
