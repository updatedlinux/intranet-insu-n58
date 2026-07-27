import axios, { type AxiosInstance } from 'axios';
import iconv from 'iconv-lite';
import { CookieJar } from 'tough-cookie';
import { solveCaptcha } from './captcha';

const BASE_URL = 'http://contribuyente.seniat.gob.ve/BuscaRif';
const MAX_CAPTCHA_RETRIES = 12;
const REQUEST_TIMEOUT_MS = 25000;

export type SeniatLookupSuccess = { rif: string; nombre: string };
export type SeniatLookupFailure = { error: string };
export type SeniatLookupResult = SeniatLookupSuccess | SeniatLookupFailure;

function createClient(): { client: AxiosInstance; jar: CookieJar } {
  const jar = new CookieJar();
  const client = axios.create({
    timeout: REQUEST_TIMEOUT_MS,
    validateStatus: () => true,
    responseType: 'arraybuffer',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  client.interceptors.request.use(async (config) => {
    const url = axios.getUri(config);
    const cookie = await jar.getCookieString(url);
    if (cookie) {
      config.headers.set('Cookie', cookie);
    }
    return config;
  });

  client.interceptors.response.use(async (response) => {
    const url = axios.getUri(response.config);
    const setCookie = response.headers['set-cookie'];
    if (setCookie) {
      const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
      for (const c of cookies) {
        await jar.setCookie(c, url);
      }
    }
    return response;
  });

  return { client, jar };
}

function decodeHtml(data: unknown): string {
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
  return iconv.decode(buffer, 'windows-1252');
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function parseSeniatHtml(html: string): SeniatLookupResult {
  if (/no coincide/i.test(html)) {
    return { error: 'captcha' };
  }

  const normalized = html.replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ');

  const match =
    normalized.match(
      /<font[^>]*>\s*((?:V|E|J|G|P)\d{9})\s+([A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜa-záéíóúñü .'-]{2,80})\s*<\/b>/i,
    ) ||
    normalized.match(/\b((?:V|E|J|G|P)\d{9})\s+([A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜa-záéíóúñü .'-]{2,80})/);

  if (match) {
    return {
      rif: match[1].trim().toUpperCase(),
      nombre: match[2].trim().replace(/\s+/g, ' '),
    };
  }

  if (/no se encontr|no existe|sin informaci/i.test(html)) {
    return { error: 'not_found' };
  }

  return { error: 'parse' };
}

export async function lookupCedulaOnSeniat(cedula: string): Promise<SeniatLookupResult> {
  const cedulaStr = String(cedula).replace(/\D/g, '');
  if (!cedulaStr) return { error: 'invalid_cedula' };

  for (let attempt = 1; attempt <= MAX_CAPTCHA_RETRIES; attempt++) {
    const { client } = createClient();

    try {
      await client.get(`${BASE_URL}/BuscaRif.jsp`);
      const captchaRes = await client.get(`${BASE_URL}/Captcha.jpg`);
      const code = await solveCaptcha(Buffer.from(captchaRes.data as ArrayBuffer));

      if (!code || code.length < 4) {
        await sleep(300);
        continue;
      }

      const body = new URLSearchParams({
        p_rif: '',
        p_cedula: cedulaStr,
        codigo: code,
        busca: ' Buscar ',
      });

      const res = await client.post(`${BASE_URL}/BuscaRif.jsp`, body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      const html = decodeHtml(res.data);
      const parsed = parseSeniatHtml(html);

      if ('error' in parsed && parsed.error === 'captcha') {
        await sleep(250);
        continue;
      }

      return parsed;
    } catch (err) {
      if (attempt === MAX_CAPTCHA_RETRIES) {
        const message = err instanceof Error ? err.message : 'network';
        return { error: `network: ${message}` };
      }
      await sleep(500);
    }
  }

  return { error: 'captcha_retries_exhausted' };
}
