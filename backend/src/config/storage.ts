import {
  CreateBucketCommand,
  HeadBucketCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { config } from './index';

function isBucketMissingError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return (
    err.name === 'NotFound' || err.name === 'NoSuchBucket' || err.$metadata?.httpStatusCode === 404
  );
}

class ObjectStorage {
  private client: S3Client | null = null;

  isEnabled(): boolean {
    return config.storage.enabled;
  }

  private assertEnabled(): void {
    if (!config.storage.enabled) {
      throw new Error(
        'MinIO está deshabilitado (MINIO_ENABLED=false). Active MinIO o suba MINIO_ENABLED=true para usar archivos.',
      );
    }
  }

  private buildEndpoint(): string {
    const protocol = config.storage.useSSL ? 'https' : 'http';
    return `${protocol}://${config.storage.endpoint}:${config.storage.port}`;
  }

  private getClient(): S3Client {
    if (!this.client) {
      const clientConfig: S3ClientConfig = {
        endpoint: this.buildEndpoint(),
        region: 'us-east-1',
        credentials: {
          accessKeyId: config.storage.accessKey,
          secretAccessKey: config.storage.secretKey,
        },
        forcePathStyle: true,
      };
      this.client = new S3Client(clientConfig);
    }
    return this.client;
  }

  async initialize(): Promise<void> {
    if (!config.storage.enabled) {
      console.warn(
        '[storage] MinIO omitido (MINIO_ENABLED=false). Documentos, learning y adjuntos no persistirán archivos.',
      );
      return;
    }

    const { bucket } = config.storage;
    const client = this.getClient();

    console.log(
      `[storage] Verificando bucket "${bucket}" en ${this.buildEndpoint()} (${config.env})...`,
    );

    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
      console.log(`[storage] Bucket "${bucket}" disponible`);
    } catch (error) {
      if (isBucketMissingError(error)) {
        console.log(`[storage] Bucket "${bucket}" no existe; creando...`);
        try {
          await client.send(new CreateBucketCommand({ Bucket: bucket }));
          console.log(`[storage] Bucket "${bucket}" creado correctamente`);
        } catch (createError) {
          const message = createError instanceof Error ? createError.message : String(createError);
          console.error('[storage] Error al crear bucket:', message);
          throw createError;
        }
        return;
      }

      const message = error instanceof Error ? error.message : String(error);
      console.error('[storage] Error al verificar bucket:', message);
      if (error instanceof Error && error.stack && config.isDevelopment) {
        console.error(error.stack);
      }
      throw error;
    }
  }

  async ping(): Promise<{ status: 'up' | 'down'; message?: string }> {
    if (!config.storage.enabled) {
      return { status: 'down', message: 'MinIO deshabilitado (MINIO_ENABLED=false)' };
    }
    try {
      await this.getClient().send(new HeadBucketCommand({ Bucket: config.storage.bucket }));
      return { status: 'up' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[storage] Health check falló:', message);
      return { status: 'down', message };
    }
  }

  getS3Client(): S3Client {
    this.assertEnabled();
    return this.getClient();
  }

  getBucketName(): string {
    return config.storage.bucket;
  }
}

/** Singleton del cliente de almacenamiento (MinIO vía S3 API) */
export const storage = new ObjectStorage();
