import './load-env';

export type AppEnvironment = 'development' | 'test' | 'production';

export interface DatabaseConfig {
  server: string;
  port: number;
  database: string;
  user: string;
  password: string;
  encrypt: boolean;
}

export interface StorageConfig {
  /** Si es false, no se conecta a MinIO al arrancar (útil en dev sin VPN/red al bucket). */
  enabled: boolean;
  endpoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
  /** URL base accesible desde el navegador (opcional; si no se define, se arma con endpoint:puerto/bucket) */
  publicBaseUrl?: string;
}

export interface JwtConfig {
  secret: string;
  expiresIn: string;
  cookieName: string;
}

export interface RedisConfig {
  /** Si es false, no se usa Redis (sesiones solo JWT; sin rate limit en caché). */
  enabled: boolean;
  host: string;
  port: number;
  password?: string;
}

export interface SmtpConfig {
  host: string;
  /** IP/host del socket TCP (evita DNS público en red host de Nomad). */
  connectHost: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromName: string;
  fromEmail: string;
  tlsRejectUnauthorized: boolean;
  /** Evita STARTTLS (relay interno en :25 sin cifrado). */
  ignoreTls: boolean;
  /** Nombre EHLO/HELO hacia el relay. */
  heloName: string;
  debug: boolean;
}

export interface AppConfig {
  env: AppEnvironment;
  port: number;
  corsOrigin: string;
  /** URL pública de la intranet (enlaces en correos) */
  appUrl: string;
  isDevelopment: boolean;
  isTest: boolean;
  isProduction: boolean;
  db: DatabaseConfig;
  storage: StorageConfig;
  jwt: JwtConfig;
  redis: RedisConfig;
  smtp: SmtpConfig;
}

function parseNodeEnv(): AppEnvironment {
  const raw = process.env.NODE_ENV ?? 'development';
  if (raw === 'development' || raw === 'test' || raw === 'production') {
    return raw;
  }
  console.warn(`[config] NODE_ENV="${raw}" no reconocido; usando "development"`);
  return 'development';
}

function requireEnv(key: string, env: AppEnvironment): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(
      `[config] Variable requerida "${key}" no definida (NODE_ENV=${env}). Revise su archivo .env`,
    );
  }
  return value;
}

function optionalEnv(key: string, fallback: string): string {
  const value = process.env[key]?.trim();
  return value && value.length > 0 ? value : fallback;
}

function parseBoolean(key: string, fallback: boolean): boolean {
  const value = process.env[key]?.trim().toLowerCase();
  if (value === undefined || value === '') return fallback;
  return value === 'true' || value === '1' || value === 'yes';
}

function parsePort(key: string, fallback: number): number {
  const raw = process.env[key]?.trim();
  if (!raw) return fallback;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`[config] "${key}" debe ser un puerto válido (1-65535), recibido: ${raw}`);
  }
  return port;
}

function smtpHeloName(appUrl: string): string {
  try {
    return new URL(appUrl).hostname;
  } catch {
    return 'intranet.insularcambios.com';
  }
}

function smtpConnectHost(host: string, connectHostOverride: string): string {
  const override = connectHostOverride.trim();
  if (override) return override;
  const trimmedHost = host.trim();
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(trimmedHost)) return trimmedHost;
  return trimmedHost;
}

function buildConfig(): AppConfig {
  const env = parseNodeEnv();

  const corsDefaults: Record<AppEnvironment, string> = {
    development: 'http://localhost:5173',
    test: 'http://localhost:5173',
    production: '',
  };

  const corsOrigin =
    env === 'production'
      ? requireEnv('CORS_ORIGIN', env)
      : optionalEnv('CORS_ORIGIN', corsDefaults[env]);

  const appUrl = (process.env.APP_URL?.trim() || corsOrigin).replace(/\/$/, '');

  return {
    env,
    port: parsePort('PORT', 3000),
    corsOrigin,
    appUrl,
    isDevelopment: env === 'development',
    isTest: env === 'test',
    isProduction: env === 'production',
    db: {
      server: requireEnv('DB_SERVER', env),
      port: parsePort('DB_PORT', 1433),
      database: requireEnv('DB_NAME', env),
      user: requireEnv('DB_USER', env),
      password: requireEnv('DB_PASSWORD', env),
      encrypt: parseBoolean('DB_ENCRYPT', false),
    },
    storage: {
      enabled: parseBoolean('MINIO_ENABLED', true),
      endpoint: optionalEnv('MINIO_ENDPOINT', '127.0.0.1'),
      port: parsePort('MINIO_PORT', 9000),
      useSSL: parseBoolean('MINIO_USE_SSL', false),
      accessKey: optionalEnv('MINIO_ACCESS_KEY', 'minioadmin'),
      secretKey: optionalEnv('MINIO_SECRET_KEY', 'minioadmin'),
      bucket: optionalEnv('MINIO_BUCKET', 'insular-docs'),
      publicBaseUrl: process.env.MINIO_PUBLIC_BASE_URL?.trim() || undefined,
    },
    jwt: {
      secret: requireEnv('JWT_SECRET', env),
      expiresIn: optionalEnv('JWT_EXPIRES_IN', '8h'),
      cookieName: optionalEnv('AUTH_COOKIE_NAME', 'intranet_session'),
    },
    redis: {
      enabled: parseBoolean('REDIS_ENABLED', true),
      host: optionalEnv('REDIS_HOST', '127.0.0.1'),
      port: parsePort('REDIS_PORT', 6379),
      password: process.env.REDIS_PASSWORD?.trim() || undefined,
    },
    smtp: (() => {
      const port = parsePort('SMTP_PORT', 25);
      const secure = parseBoolean('SMTP_SECURE', false);
      const host = optionalEnv('SMTP_HOST', '');
      const connectHost = smtpConnectHost(host, optionalEnv('SMTP_CONNECT_HOST', ''));
      return {
        host,
        connectHost,
        port,
        secure,
        user: optionalEnv('SMTP_USER', ''),
        password: process.env.SMTP_PASSWORD?.trim() || '',
        fromName: optionalEnv('SMTP_FROM_NAME', 'Insular Cambios'),
        fromEmail: optionalEnv('SMTP_FROM_EMAIL', ''),
        tlsRejectUnauthorized: parseBoolean('SMTP_TLS_REJECT_UNAUTHORIZED', false),
        ignoreTls: parseBoolean('SMTP_IGNORE_TLS', port === 25 && !secure),
        heloName: smtpHeloName(appUrl),
        debug: parseBoolean('SMTP_DEBUG', false),
      };
    })(),
  };
}

export const config: AppConfig = buildConfig();

export { database, getPool } from './database';
export { storage } from './storage';
