import { PutObjectCommand } from '@aws-sdk/client-s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';
import { CHAT_ALLOWED_MIMES, buildChatFileKey } from '../constants/chat';
import { storage } from '../config/storage';

export async function uploadChatFile(
  roomId: number,
  buffer: Buffer,
  mimeType: string,
  originalName: string,
): Promise<{ fileKey: string; fileName: string; fileType: string }> {
  if (!CHAT_ALLOWED_MIMES.has(mimeType)) {
    throw Object.assign(new Error('Tipo de archivo no permitido. Use imagen o PDF.'), {
      statusCode: 400,
    });
  }

  const fileKey = buildChatFileKey(roomId, originalName);
  const client = storage.getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: storage.getBucketName(),
      Key: fileKey,
      Body: buffer,
      ContentType: mimeType,
    }),
  );

  return { fileKey, fileName: originalName, fileType: mimeType };
}

export async function getChatFileStream(
  fileKey: string,
): Promise<{ stream: Readable; contentType: string }> {
  const client = storage.getS3Client();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: storage.getBucketName(),
      Key: fileKey,
    }),
  );
  if (!response.Body) {
    throw Object.assign(new Error('Archivo no disponible'), { statusCode: 404 });
  }
  return {
    stream: response.Body as Readable,
    contentType: response.ContentType ?? 'application/octet-stream',
  };
}
