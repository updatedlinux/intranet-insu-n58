import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

function isRed(r: number, g: number, b: number): boolean {
  return r > 70 && r > g + 30 && r > b + 30 && g < 130 && b < 130;
}

async function preprocessCaptcha(buffer: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const pixels = Buffer.from(data);

  const get = (x: number, y: number): [number, number, number] => {
    const i = (y * w + x) * 4;
    return [pixels[i], pixels[i + 1], pixels[i + 2]];
  };

  const set = (x: number, y: number, rgb: [number, number, number]) => {
    const i = (y * w + x) * 4;
    pixels[i] = rgb[0];
    pixels[i + 1] = rgb[1];
    pixels[i + 2] = rgb[2];
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!isRed(...get(x, y))) continue;
      let replacement: [number, number, number] = [0, 0, 0];
      for (const dy of [-1, 1, -2, 2, -3, 3]) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        const neighbor = get(x, ny);
        if (!isRed(...neighbor)) {
          replacement = neighbor;
          break;
        }
      }
      set(x, y, replacement);
    }
  }

  for (let i = 0; i < pixels.length; i += 4) {
    const lum = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
    const v = lum > 110 ? 0 : 255;
    pixels[i] = pixels[i + 1] = pixels[i + 2] = v;
    pixels[i + 3] = 255;
  }

  const core = await sharp(pixels, { raw: { width: w, height: h, channels: 4 } })
    .resize(w * 5, h * 5, { kernel: 'nearest' })
    .png()
    .toBuffer();

  return sharp(core)
    .extend({ top: 20, bottom: 20, left: 20, right: 20, background: '#fff' })
    .png()
    .toBuffer();
}

function runTesseract(imagePath: string): string {
  const votes: Record<string, number> = {};

  for (const psm of ['7', '8', '13']) {
    let raw = '';
    try {
      raw = execFileSync(
        'tesseract',
        [
          imagePath,
          'stdout',
          '--dpi',
          '300',
          '-c',
          'tessedit_char_whitelist=abcdefghijklmnopqrstuvwxyz0123456789',
          '--psm',
          psm,
        ],
        { encoding: 'utf8' },
      );
    } catch (err) {
      const failed = err as { stdout?: string };
      raw = failed.stdout?.toString() || '';
    }

    const out = raw.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (out) votes[out] = (votes[out] || 0) + 1;
  }

  const ranked = Object.entries(votes).sort((a, b) => {
    const a6 = a[0].length === 6 ? 1 : 0;
    const b6 = b[0].length === 6 ? 1 : 0;
    if (a6 !== b6) return b6 - a6;
    return b[1] - a[1];
  });

  return ranked[0]?.[0] || '';
}

export async function solveCaptcha(imageBuffer: Buffer): Promise<string> {
  const processed = await preprocessCaptcha(imageBuffer);
  const tmp = path.join(os.tmpdir(), `seniat-captcha-${process.pid}-${Date.now()}.png`);
  fs.writeFileSync(tmp, processed);

  try {
    return runTesseract(tmp);
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}
