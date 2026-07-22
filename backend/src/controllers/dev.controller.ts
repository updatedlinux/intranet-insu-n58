import type { NextFunction, Request, Response } from 'express';
import { config } from '../config';
import { emailService } from '../services/email.service';
import type { AppError } from '../middlewares/error.middleware';

const TEST_TYPES = ['welcome', 'reset', 'deactivated', 'activated', 'generic'] as const;

type TestEmailType = (typeof TEST_TYPES)[number];

function badRequest(message: string): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 400;
  return error;
}

function isTestEmailType(value: string): value is TestEmailType {
  return (TEST_TYPES as readonly string[]).includes(value);
}

export async function testEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!config.isDevelopment) {
      res.status(404).json({ error: { message: 'No encontrado' } });
      return;
    }

    const { to, type, subject, html } = req.body as {
      to?: string;
      type?: string;
      subject?: string;
      html?: string;
    };

    if (!to?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim())) {
      throw badRequest('Debe indicar un correo "to" válido');
    }

    if (!type || !isTestEmailType(type)) {
      throw badRequest(`"type" debe ser uno de: ${TEST_TYPES.join(', ')}`);
    }

    const recipient = to.trim();
    const nombrePrueba = 'Colaborador de Prueba';

    let sent = false;

    switch (type) {
      case 'welcome':
        sent = await emailService.sendWelcome(recipient, nombrePrueba, 'TempPass123!');
        break;
      case 'reset':
        sent = await emailService.sendPasswordReset(recipient, nombrePrueba, 'ResetPass456!');
        break;
      case 'deactivated':
        sent = await emailService.sendAccountDeactivated(recipient, nombrePrueba);
        break;
      case 'activated':
        sent = await emailService.sendAccountActivated(recipient, nombrePrueba);
        break;
      case 'generic':
        sent = await emailService.sendGeneric(
          recipient,
          subject?.trim() || 'Mensaje de prueba',
          html?.trim() ||
            '<p>Este es un correo genérico de prueba desde el entorno de desarrollo.</p>',
        );
        break;
    }

    res.json({
      ok: sent,
      message: sent
        ? `Correo de prueba "${type}" enviado a ${recipient}`
        : `No se pudo enviar el correo (revise logs y configuración SMTP)`,
      type,
      to: recipient,
    });
  } catch (error) {
    next(error);
  }
}
