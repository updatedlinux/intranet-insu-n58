import { lookup } from 'node:dns/promises';
import { createConnection } from 'node:net';
import nodemailer, { type Transporter } from 'nodemailer';
import { config } from './index';

async function probeSmtpRelay(
  connectHost: string,
  port: number,
  heloName: string,
): Promise<string> {
  const resolved = await lookup(connectHost, { family: 4 });
  const targetIp = resolved.address;
  console.log(`[mailer] SMTP destino ${connectHost}:${port} → ${targetIp} (IPv4)`);

  await new Promise<void>((resolve, reject) => {
    const timeoutMs = 15_000;
    let stage = 'tcp';
    let buffer = '';

    const socket = createConnection({ host: targetIp, port, family: 4 });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`SMTP timeout en etapa "${stage}" hacia ${targetIp}:${port}`));
    }, timeoutMs);

    const finish = (error?: Error) => {
      clearTimeout(timer);
      socket.destroy();
      if (error) reject(error);
      else resolve();
    };

    socket.once('error', (error) => finish(error));
    socket.once('connect', () => {
      stage = 'greeting';
    });

    socket.on('data', (chunk) => {
      buffer += chunk.toString('ascii');

      if (stage === 'greeting') {
        const lineEnd = buffer.indexOf('\r\n');
        if (lineEnd === -1) return;

        const line = buffer.slice(0, lineEnd);
        buffer = buffer.slice(lineEnd + 2);

        if (!line.startsWith('220')) {
          finish(new Error(`SMTP saludo inesperado: ${line}`));
          return;
        }

        console.log(`[mailer] SMTP saludo OK (${line.slice(0, 60)})`);
        stage = 'ehlo';
        socket.write(`EHLO ${heloName}\r\n`);
      }

      if (stage === 'ehlo' && /(^|\r\n)250[ -]/.test(buffer)) {
        stage = 'quit';
        socket.write('QUIT\r\n');
        finish();
      }
    });
  });

  return targetIp;
}

class Mailer {
  private transporter: Transporter | null = null;

  isConfigured(): boolean {
    return Boolean(config.smtp.host && config.smtp.fromEmail);
  }

  getFromAddress(): { name: string; address: string } {
    return {
      name: config.smtp.fromName,
      address: config.smtp.fromEmail,
    };
  }

  getTransporter(): Transporter | null {
    if (!this.isConfigured()) {
      return null;
    }

    if (!this.transporter) {
      const { smtp } = config;

      const transportOptions = {
        host: smtp.connectHost,
        port: smtp.port,
        secure: smtp.secure,
        auth: smtp.user
          ? {
              user: smtp.user,
              pass: smtp.password,
            }
          : undefined,
        name: smtp.heloName,
        ignoreTLS: smtp.ignoreTls,
        requireTLS: false,
        family: 4 as const,
        connectionTimeout: 15_000,
        greetingTimeout: 15_000,
        socketTimeout: 30_000,
        logger: smtp.debug,
        debug: smtp.debug,
        tls: {
          rejectUnauthorized: smtp.tlsRejectUnauthorized,
          servername: smtp.host.includes('.') ? smtp.host : undefined,
        },
      };

      this.transporter = nodemailer.createTransport(transportOptions);

      console.log(
        `[mailer] Transporter SMTP listo (connect=${smtp.connectHost}:${smtp.port}, ehlo=${smtp.heloName}, secure=${smtp.secure}, ignoreTLS=${smtp.ignoreTls}, auth=${smtp.user ? 'sí' : 'no'})`,
      );

      if (config.isProduction && !smtp.user) {
        console.warn(
          '[mailer] SMTP_USER vacío en producción — Postal rechazará envíos con 530 Authentication required',
        );
      }
    }

    return this.transporter;
  }

  async verifyConnection(): Promise<void> {
    const transport = this.getTransporter();
    if (!transport) {
      console.warn('[mailer] SMTP no configurado (SMTP_HOST / SMTP_FROM_EMAIL faltantes)');
      return;
    }

    const { smtp } = config;

    try {
      await probeSmtpRelay(smtp.connectHost, smtp.port, smtp.heloName);
      await transport.verify();
      console.log('[mailer] Conexión SMTP verificada correctamente');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[mailer] No se pudo verificar SMTP:', message);
    }
  }
}

export const mailer = new Mailer();
