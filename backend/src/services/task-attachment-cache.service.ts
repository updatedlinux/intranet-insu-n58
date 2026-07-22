import { getRedis, redis } from '../config/redis';

const CACHE_PREFIX = 'task-att:';
const MAX_CACHE_BYTES = 1024 * 1024;
const CACHE_TTL_SECONDS = 15 * 60;

export interface CachedTaskAttachment {
  buffer: Buffer;
  contentType: string;
  fileName: string;
}

function cacheKey(attachmentId: number): string {
  return `${CACHE_PREFIX}${attachmentId}`;
}

export async function getCachedTaskAttachment(
  attachmentId: number,
): Promise<CachedTaskAttachment | null> {
  if (!redis.isReady()) return null;

  const key = cacheKey(attachmentId);
  const [data, contentType, fileName] = await getRedis().hmget(
    key,
    'data',
    'contentType',
    'fileName',
  );
  if (!data || !contentType || !fileName) return null;

  return {
    buffer: Buffer.isBuffer(data) ? data : Buffer.from(data),
    contentType,
    fileName,
  };
}

export async function setCachedTaskAttachment(
  attachmentId: number,
  payload: CachedTaskAttachment,
): Promise<void> {
  if (!redis.isReady() || payload.buffer.length > MAX_CACHE_BYTES) return;

  const key = cacheKey(attachmentId);
  await getRedis()
    .multi()
    .hset(key, {
      data: payload.buffer,
      contentType: payload.contentType,
      fileName: payload.fileName,
    })
    .expire(key, CACHE_TTL_SECONDS)
    .exec();
}
