import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../config';
import { mailer } from '../config/mailer';

const BRAND = 'Insular Cambios';
const BRAND_COLOR = '#002b4e';
/** Content-ID del logo embebido (cid:) — compatible con Gmail, Outlook, YOPmail, etc. */
const EMAIL_LOGO_CID = 'insular-logo@insularcambios';

function loadEmailLogoPath(): string {
  const candidates = [
    join(process.cwd(), 'assets', 'insular-negative.png'),
    join(process.cwd(), '..', 'frontend', 'public', 'insular-negative.png'),
  ];

  for (const filePath of candidates) {
    try {
      readFileSync(filePath);
      return filePath;
    } catch {
      // intentar siguiente ruta
    }
  }

  console.warn('[email] Logo insular-negative.png no encontrado; se usará encabezado solo texto');
  return '';
}

const EMAIL_LOGO_PATH = loadEmailLogoPath();

function emailLogoAttachments(): Array<{
  filename: string;
  path: string;
  cid: string;
}> {
  if (!EMAIL_LOGO_PATH) return [];
  return [
    {
      filename: 'insular-negative.png',
      path: EMAIL_LOGO_PATH,
      cid: EMAIL_LOGO_CID,
    },
  ];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function intranetAppUrl(): string {
  return config.appUrl || config.corsOrigin || 'http://localhost:5173';
}

function emailHeaderHtml(): string {
  if (EMAIL_LOGO_PATH) {
    return `
          <tr>
            <td style="background-color:${BRAND_COLOR};padding:22px 24px 18px;text-align:center;">
              <img src="cid:${EMAIL_LOGO_CID}" alt="${escapeHtml(BRAND)}" width="200" height="44" style="display:block;margin:0 auto;max-width:200px;height:auto;border:0;outline:none;text-decoration:none;" />
              <p style="margin:10px 0 0;font-size:0.8125rem;color:#cbd5e1;">Intranet corporativa</p>
            </td>
          </tr>`;
  }

  return `
          <tr>
            <td style="background-color:${BRAND_COLOR};padding:20px 24px;">
              <h1 style="margin:0;font-size:1.25rem;font-weight:600;color:#ffffff;">${BRAND}</h1>
              <p style="margin:6px 0 0;font-size:0.8125rem;color:#cbd5e1;">Intranet corporativa</p>
            </td>
          </tr>`;
}

function wrapCorporateEmail(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#374151;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f3f4f6;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
          ${emailHeaderHtml()}
          <tr>
            <td style="padding:24px;">
              <h2 style="margin:0 0 16px;font-size:1.125rem;color:${BRAND_COLOR};">${escapeHtml(title)}</h2>
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:0.75rem;color:#6b7280;">
              Este mensaje fue enviado automáticamente. No responda a este correo.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

class EmailService {
  private async deliver(to: string, subject: string, html: string): Promise<boolean> {
    const transport = mailer.getTransporter();
    if (!transport) {
      console.warn(`[email] SMTP no configurado; no se envió "${subject}" a ${to}`);
      return false;
    }

    try {
      const info = await transport.sendMail({
        from: mailer.getFromAddress(),
        to,
        subject: `[${BRAND}] ${subject}`,
        html,
        attachments: emailLogoAttachments(),
      });
      console.log(`[email] Enviado "${subject}" a ${to} (messageId: ${info.messageId ?? 'n/a'})`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[email] Error al enviar "${subject}" a ${to}:`, message);
      if (error instanceof Error && error.stack && config.isDevelopment) {
        console.error(error.stack);
      }
      return false;
    }
  }

  async sendWelcome(to: string, nombre: string, passwordTemporal: string): Promise<boolean> {
    const safeName = escapeHtml(nombre);
    const safePassword = escapeHtml(passwordTemporal);
    const loginUrl = escapeHtml(intranetAppUrl());

    const body = `
      <p style="margin:0 0 12px;line-height:1.5;">Hola <strong>${safeName}</strong>,</p>
      <p style="margin:0 0 12px;line-height:1.5;">Se ha creado su cuenta en la intranet de ${BRAND}. A continuación encontrará sus credenciales de acceso iniciales:</p>
      <table role="presentation" cellspacing="0" cellpadding="0" style="margin:16px 0;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;width:100%;">
        <tr>
          <td style="padding:12px 16px;font-size:0.875rem;">
            <strong>Contraseña temporal:</strong><br />
            <code style="font-size:1rem;color:${BRAND_COLOR};">${safePassword}</code>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 12px;line-height:1.5;">Por seguridad, deberá cambiar esta contraseña en su primer inicio de sesión.</p>
      <p style="margin:0 0 16px;line-height:1.5;">
        <a href="${loginUrl}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Acceder a la intranet</a>
      </p>
      <p style="margin:0;font-size:0.8125rem;color:#6b7280;">Si no esperaba este correo, contacte al administrador del sistema.</p>
    `;

    return this.deliver(
      to,
      'Bienvenida — credenciales de acceso',
      wrapCorporateEmail('Bienvenido/a a la intranet', body),
    );
  }

  async sendPasswordReset(to: string, nombre: string, passwordTemporal: string): Promise<boolean> {
    const safeName = escapeHtml(nombre);
    const safePassword = escapeHtml(passwordTemporal);
    const loginUrl = escapeHtml(intranetAppUrl());

    const body = `
      <p style="margin:0 0 12px;line-height:1.5;">Hola <strong>${safeName}</strong>,</p>
      <p style="margin:0 0 12px;line-height:1.5;">Un administrador ha restablecido la contraseña de su cuenta en la intranet de ${BRAND}.</p>
      <table role="presentation" cellspacing="0" cellpadding="0" style="margin:16px 0;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;width:100%;">
        <tr>
          <td style="padding:12px 16px;font-size:0.875rem;">
            <strong>Nueva contraseña temporal:</strong><br />
            <code style="font-size:1rem;color:${BRAND_COLOR};">${safePassword}</code>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 12px;line-height:1.5;">Deberá cambiarla al iniciar sesión.</p>
      <p style="margin:0 0 16px;line-height:1.5;">
        <a href="${loginUrl}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Iniciar sesión</a>
      </p>
      <p style="margin:0;font-size:0.8125rem;color:#6b7280;">Si no solicitó este cambio, contacte de inmediato al área de soporte o administración.</p>
    `;

    return this.deliver(
      to,
      'Contraseña restablecida',
      wrapCorporateEmail('Contraseña restablecida', body),
    );
  }

  async sendForgotPasswordLink(to: string, nombre: string, resetUrl: string): Promise<boolean> {
    const safeName = escapeHtml(nombre);
    const safeUrl = escapeHtml(resetUrl);

    const body = `
      <p style="margin:0 0 12px;line-height:1.5;">Hola <strong>${safeName}</strong>,</p>
      <p style="margin:0 0 12px;line-height:1.5;">Recibimos una solicitud para restablecer la contraseña de su cuenta en la intranet de ${BRAND}.</p>
      <p style="margin:0 0 16px;line-height:1.5;">Use el siguiente enlace (válido por 1 hora):</p>
      <p style="margin:0 0 16px;line-height:1.5;">
        <a href="${safeUrl}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Restablecer contraseña</a>
      </p>
      <p style="margin:0 0 12px;font-size:0.8125rem;color:#6b7280;word-break:break-all;">${safeUrl}</p>
      <p style="margin:0;font-size:0.8125rem;color:#6b7280;">Si no solicitó este cambio, ignore este mensaje. Su contraseña actual seguirá siendo válida.</p>
    `;

    return this.deliver(
      to,
      'Recuperación de contraseña',
      wrapCorporateEmail('Recuperar contraseña', body),
    );
  }

  async sendAccountDeactivated(to: string, nombre: string): Promise<boolean> {
    const safeName = escapeHtml(nombre);

    const body = `
      <p style="margin:0 0 12px;line-height:1.5;">Hola <strong>${safeName}</strong>,</p>
      <p style="margin:0 0 12px;line-height:1.5;">Le informamos que su cuenta en la intranet de ${BRAND} ha sido <strong>desactivada</strong>.</p>
      <p style="margin:0 0 12px;line-height:1.5;">Ya no podrá acceder a la plataforma hasta que un administrador reactive su cuenta.</p>
      <p style="margin:0;font-size:0.8125rem;color:#6b7280;">Si considera que se trata de un error, comuníquese con el administrador de su área.</p>
    `;

    return this.deliver(to, 'Cuenta desactivada', wrapCorporateEmail('Cuenta desactivada', body));
  }

  async sendAccountActivated(to: string, nombre: string): Promise<boolean> {
    const safeName = escapeHtml(nombre);
    const loginUrl = escapeHtml(intranetAppUrl());

    const body = `
      <p style="margin:0 0 12px;line-height:1.5;">Hola <strong>${safeName}</strong>,</p>
      <p style="margin:0 0 12px;line-height:1.5;">Su cuenta en la intranet de ${BRAND} ha sido <strong>reactivada</strong>.</p>
      <p style="margin:0 0 16px;line-height:1.5;">Ya puede volver a acceder con sus credenciales habituales.</p>
      <p style="margin:0 0 16px;line-height:1.5;">
        <a href="${loginUrl}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Acceder a la intranet</a>
      </p>
      <p style="margin:0;font-size:0.8125rem;color:#6b7280;">Si no puede iniciar sesión, contacte al administrador del sistema.</p>
    `;

    return this.deliver(to, 'Cuenta reactivada', wrapCorporateEmail('Cuenta reactivada', body));
  }

  async sendDocumentPendingApproval(
    to: string,
    leaderName: string,
    documentName: string,
    uploaderName: string,
    areaName: string,
  ): Promise<boolean> {
    const loginUrl = escapeHtml(`${intranetAppUrl()}/documentos`);
    const body = `
      <p style="margin:0 0 12px;line-height:1.5;">Hola <strong>${escapeHtml(leaderName)}</strong>,</p>
      <p style="margin:0 0 12px;line-height:1.5;"><strong>${escapeHtml(uploaderName)}</strong> subió el documento <strong>${escapeHtml(documentName)}</strong> en el área <strong>${escapeHtml(areaName)}</strong> y requiere su aprobación.</p>
      <p style="margin:0 0 16px;line-height:1.5;">
        <a href="${loginUrl}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Revisar pendientes</a>
      </p>
    `;
    return this.deliver(
      to,
      'Documento pendiente de aprobación',
      wrapCorporateEmail('Aprobación requerida', body),
    );
  }

  async sendDocumentApproved(to: string, nombre: string, documentName: string): Promise<boolean> {
    const loginUrl = escapeHtml(`${intranetAppUrl()}/documentos`);
    const body = `
      <p style="margin:0 0 12px;line-height:1.5;">Hola <strong>${escapeHtml(nombre)}</strong>,</p>
      <p style="margin:0 0 12px;line-height:1.5;">Su documento <strong>${escapeHtml(documentName)}</strong> fue <strong>aprobado</strong> y ya está disponible para el equipo autorizado.</p>
      <p style="margin:0 0 16px;line-height:1.5;">
        <a href="${loginUrl}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Ver documentos</a>
      </p>
    `;
    return this.deliver(to, 'Documento aprobado', wrapCorporateEmail('Documento aprobado', body));
  }

  async sendDocumentRejected(
    to: string,
    nombre: string,
    documentName: string,
    reason: string | null,
  ): Promise<boolean> {
    const reasonBlock = reason
      ? `<p style="margin:0 0 12px;line-height:1.5;"><strong>Motivo:</strong> ${escapeHtml(reason)}</p>`
      : '';
    const body = `
      <p style="margin:0 0 12px;line-height:1.5;">Hola <strong>${escapeHtml(nombre)}</strong>,</p>
      <p style="margin:0 0 12px;line-height:1.5;">Su documento <strong>${escapeHtml(documentName)}</strong> fue <strong>rechazado</strong> por el gerente del área.</p>
      ${reasonBlock}
      <p style="margin:0;font-size:0.8125rem;color:#6b7280;">Puede contactar a su líder para más detalles o subir una versión corregida.</p>
    `;
    return this.deliver(to, 'Documento rechazado', wrapCorporateEmail('Documento rechazado', body));
  }

  async sendAnnouncementNotification(
    to: string,
    recipientName: string,
    title: string,
    summary: string,
    categoryLabel: string,
    announcementId: number,
  ): Promise<boolean> {
    const safeName = escapeHtml(recipientName);
    const safeTitle = escapeHtml(title);
    const safeSummary = escapeHtml(summary);
    const safeCategory = escapeHtml(categoryLabel);
    const detailUrl = escapeHtml(`${intranetAppUrl()}/comunicados/${announcementId}`);

    const body = `
      <p style="margin:0 0 12px;line-height:1.5;">Hola <strong>${safeName}</strong>,</p>
      <p style="margin:0 0 12px;line-height:1.5;">Hay un nuevo comunicado disponible en la intranet de ${BRAND}.</p>
      <p style="margin:0 0 4px;font-size:0.75rem;font-weight:600;text-transform:uppercase;color:#6b7280;">${safeCategory}</p>
      <h3 style="margin:0 0 8px;color:${BRAND_COLOR};font-size:1.0625rem;">${safeTitle}</h3>
      <p style="margin:0 0 20px;line-height:1.5;color:#4b5563;">${safeSummary}</p>
      <p style="margin:0 0 20px;line-height:1.5;">
        <a href="${detailUrl}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Ver comunicado</a>
      </p>
      <p style="margin:0;font-size:0.75rem;color:#6b7280;">Este es un mensaje automático. No responda a este correo.</p>
    `;

    return this.deliver(
      to,
      `Nuevo comunicado: ${title}`,
      wrapCorporateEmail('Nuevo comunicado en la intranet', body),
    );
  }

  async sendTicketCreatedToIt(
    to: string,
    agentName: string,
    code: string,
    title: string,
    requesterName: string,
    ticketId: number,
  ): Promise<boolean> {
    const url = escapeHtml(`${intranetAppUrl()}/service-desk/gestion/${ticketId}`);
    const body = `
      <p style="margin:0 0 12px;line-height:1.5;">Hola <strong>${escapeHtml(agentName)}</strong>,</p>
      <p style="margin:0 0 12px;line-height:1.5;">Se registró un nuevo ticket <strong>${escapeHtml(code)}</strong>: ${escapeHtml(title)}.</p>
      <p style="margin:0 0 12px;line-height:1.5;"><strong>Solicitante:</strong> ${escapeHtml(requesterName)}</p>
      <p style="margin:0 0 16px;line-height:1.5;">
        <a href="${url}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Abrir mesa de ayuda</a>
      </p>
    `;
    return this.deliver(
      to,
      `Nuevo ticket ${code}`,
      wrapCorporateEmail('Nuevo requerimiento TI', body),
    );
  }

  async sendTicketAssigned(
    to: string,
    nombre: string,
    code: string,
    title: string,
    isAgent: boolean,
    ticketId: number,
  ): Promise<boolean> {
    const path = isAgent ? 'gestion' : '';
    const url = escapeHtml(`${intranetAppUrl()}/service-desk/${path ? `${path}/` : ''}${ticketId}`);
    const intro = isAgent
      ? `Se le asignó el ticket <strong>${escapeHtml(code)}</strong>: ${escapeHtml(title)}.`
      : `Su ticket <strong>${escapeHtml(code)}</strong> fue asignado a un agente de TI.`;
    const body = `
      <p style="margin:0 0 12px;line-height:1.5;">Hola <strong>${escapeHtml(nombre)}</strong>,</p>
      <p style="margin:0 0 16px;line-height:1.5;">${intro}</p>
      <p style="margin:0 0 16px;line-height:1.5;">
        <a href="${url}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Ver ticket</a>
      </p>
    `;
    return this.deliver(
      to,
      `Ticket ${code} asignado`,
      wrapCorporateEmail('Asignación de ticket', body),
    );
  }

  async sendTicketComment(
    to: string,
    nombre: string,
    code: string,
    authorName: string,
    preview: string,
    ticketId: number,
    isAgentView: boolean,
  ): Promise<boolean> {
    const path = isAgentView ? 'gestion' : '';
    const url = escapeHtml(`${intranetAppUrl()}/service-desk/${path ? `${path}/` : ''}${ticketId}`);
    const body = `
      <p style="margin:0 0 12px;line-height:1.5;">Hola <strong>${escapeHtml(nombre)}</strong>,</p>
      <p style="margin:0 0 12px;line-height:1.5;">Nuevo comentario en <strong>${escapeHtml(code)}</strong> de <strong>${escapeHtml(authorName)}</strong>:</p>
      <p style="margin:0 0 16px;padding:12px;background:#f9fafb;border-radius:6px;line-height:1.5;">${escapeHtml(preview)}</p>
      <p style="margin:0 0 16px;line-height:1.5;">
        <a href="${url}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Responder en intranet</a>
      </p>
    `;
    return this.deliver(
      to,
      `Comentario en ${code}`,
      wrapCorporateEmail('Actualización de ticket', body),
    );
  }

  async sendTicketResolved(
    to: string,
    nombre: string,
    code: string,
    title: string,
    ticketId: number,
  ): Promise<boolean> {
    const url = escapeHtml(`${intranetAppUrl()}/service-desk/${ticketId}`);
    const body = `
      <p style="margin:0 0 12px;line-height:1.5;">Hola <strong>${escapeHtml(nombre)}</strong>,</p>
      <p style="margin:0 0 12px;line-height:1.5;">Su ticket <strong>${escapeHtml(code)}</strong> (${escapeHtml(title)}) fue marcado como <strong>resuelto</strong>.</p>
      <p style="margin:0 0 16px;line-height:1.5;">Si está conforme, puede cerrarlo desde la intranet.</p>
      <p style="margin:0 0 16px;line-height:1.5;">
        <a href="${url}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Ver ticket</a>
      </p>
    `;
    return this.deliver(to, `Ticket ${code} resuelto`, wrapCorporateEmail('Ticket resuelto', body));
  }

  async sendTaskAssigned(
    to: string,
    nombre: string,
    taskTitle: string,
    assignerName: string,
    taskId: number,
  ): Promise<boolean> {
    const url = escapeHtml(`${intranetAppUrl()}/actividades?task=${taskId}`);
    const body = `
      <p style="margin:0 0 12px;line-height:1.5;">Hola <strong>${escapeHtml(nombre)}</strong>,</p>
      <p style="margin:0 0 12px;line-height:1.5;"><strong>${escapeHtml(assignerName)}</strong> le asignó la tarea <strong>${escapeHtml(taskTitle)}</strong>.</p>
      <p style="margin:0 0 16px;line-height:1.5;">
        <a href="${url}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Ver tarea</a>
      </p>
    `;
    return this.deliver(to, 'Nueva tarea asignada', wrapCorporateEmail('Tarea asignada', body));
  }

  async sendTaskCreated(
    to: string,
    nombre: string,
    taskTitle: string,
    creatorName: string,
    taskId: number,
  ): Promise<boolean> {
    const url = escapeHtml(`${intranetAppUrl()}/actividades?task=${taskId}`);
    const body = `
      <p style="margin:0 0 12px;line-height:1.5;">Hola <strong>${escapeHtml(nombre)}</strong>,</p>
      <p style="margin:0 0 12px;line-height:1.5;"><strong>${escapeHtml(creatorName)}</strong> creó la tarea <strong>${escapeHtml(taskTitle)}</strong> y usted está asignado.</p>
      <p style="margin:0 0 16px;line-height:1.5;">
        <a href="${url}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Ver tarea</a>
      </p>
    `;
    return this.deliver(to, 'Nueva tarea creada', wrapCorporateEmail('Nueva tarea', body));
  }

  async sendTaskMoved(
    to: string,
    nombre: string,
    taskTitle: string,
    actorName: string,
    fromColumnName: string,
    toColumnName: string,
    statusLabel: string,
    taskId: number,
  ): Promise<boolean> {
    const url = escapeHtml(`${intranetAppUrl()}/actividades?task=${taskId}`);
    const columnChange =
      fromColumnName === toColumnName
        ? `en la columna <strong>${escapeHtml(toColumnName)}</strong>`
        : `de <strong>${escapeHtml(fromColumnName)}</strong> a <strong>${escapeHtml(toColumnName)}</strong>`;
    const body = `
      <p style="margin:0 0 12px;line-height:1.5;">Hola <strong>${escapeHtml(nombre)}</strong>,</p>
      <p style="margin:0 0 12px;line-height:1.5;"><strong>${escapeHtml(actorName)}</strong> movió la tarea <strong>${escapeHtml(taskTitle)}</strong> ${columnChange} (estado: <strong>${escapeHtml(statusLabel)}</strong>).</p>
      <p style="margin:0 0 16px;line-height:1.5;">
        <a href="${url}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Ver tarea</a>
      </p>
    `;
    return this.deliver(to, 'Tarea actualizada', wrapCorporateEmail('Tarea movida', body));
  }

  async sendTaskCompleted(
    to: string,
    nombre: string,
    taskTitle: string,
    actorName: string,
    taskId: number,
  ): Promise<boolean> {
    const url = escapeHtml(`${intranetAppUrl()}/actividades?task=${taskId}`);
    const body = `
      <p style="margin:0 0 12px;line-height:1.5;">Hola <strong>${escapeHtml(nombre)}</strong>,</p>
      <p style="margin:0 0 12px;line-height:1.5;"><strong>${escapeHtml(actorName)}</strong> marcó como <strong>completada</strong> la tarea <strong>${escapeHtml(taskTitle)}</strong>.</p>
      <p style="margin:0 0 16px;line-height:1.5;">
        <a href="${url}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Ver tarea</a>
      </p>
    `;
    return this.deliver(to, 'Tarea completada', wrapCorporateEmail('Tarea completada', body));
  }

  async sendTaskComment(
    to: string,
    nombre: string,
    taskTitle: string,
    authorName: string,
    preview: string,
    taskId: number,
  ): Promise<boolean> {
    const url = escapeHtml(`${intranetAppUrl()}/actividades?task=${taskId}`);
    const body = `
      <p style="margin:0 0 12px;line-height:1.5;">Hola <strong>${escapeHtml(nombre)}</strong>,</p>
      <p style="margin:0 0 12px;line-height:1.5;">Nuevo comentario en la tarea <strong>${escapeHtml(taskTitle)}</strong> de <strong>${escapeHtml(authorName)}</strong>:</p>
      <p style="margin:0 0 16px;padding:12px;background:#f9fafb;border-radius:6px;line-height:1.5;">${escapeHtml(preview)}</p>
      <p style="margin:0 0 16px;line-height:1.5;">
        <a href="${url}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Ver tarea</a>
      </p>
    `;
    return this.deliver(
      to,
      `Comentario en tarea: ${taskTitle}`,
      wrapCorporateEmail('Nuevo comentario en tarea', body),
    );
  }

  async sendTaskDueSoon(
    to: string,
    nombre: string,
    taskTitle: string,
    dueDateIso: string,
    taskId: number,
  ): Promise<boolean> {
    const url = escapeHtml(`${intranetAppUrl()}/actividades?task=${taskId}`);
    const dueLabel = dueDateIso
      ? escapeHtml(new Date(dueDateIso).toLocaleString('es-ES'))
      : 'próximamente';
    const body = `
      <p style="margin:0 0 12px;line-height:1.5;">Hola <strong>${escapeHtml(nombre)}</strong>,</p>
      <p style="margin:0 0 12px;line-height:1.5;">La tarea <strong>${escapeHtml(taskTitle)}</strong> vence el <strong>${dueLabel}</strong> (menos de 24 horas).</p>
      <p style="margin:0 0 16px;line-height:1.5;">
        <a href="${url}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Ver tarea</a>
      </p>
    `;
    return this.deliver(
      to,
      'Tarea próxima a vencer',
      wrapCorporateEmail('Recordatorio de vencimiento', body),
    );
  }

  async sendMeetingCreated(
    to: string,
    nombre: string,
    title: string,
    startLabel: string,
    modality: string,
    locationSummary: string,
    meetingId: number,
  ): Promise<boolean> {
    const url = escapeHtml(`${intranetAppUrl()}/reuniones/${meetingId}`);
    const body = `
      <p style="margin:0 0 12px;line-height:1.5;">Hola <strong>${escapeHtml(nombre)}</strong>,</p>
      <p style="margin:0 0 12px;line-height:1.5;">Ha sido invitado/a a la reunión <strong>${escapeHtml(title)}</strong>.</p>
      <p style="margin:0 0 8px;line-height:1.5;"><strong>Fecha:</strong> ${escapeHtml(startLabel)}</p>
      <p style="margin:0 0 8px;line-height:1.5;"><strong>Modalidad:</strong> ${escapeHtml(modality)}</p>
      <p style="margin:0 0 16px;line-height:1.5;"><strong>${modality === 'Remota' ? 'Enlace' : 'Ubicación'}:</strong> ${escapeHtml(locationSummary)}</p>
      <p style="margin:0 0 16px;line-height:1.5;">
        <a href="${url}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Ver reunión</a>
      </p>
    `;
    return this.deliver(to, `Invitación: ${title}`, wrapCorporateEmail('Nueva reunión', body));
  }

  async sendMeetingRescheduled(
    to: string,
    nombre: string,
    title: string,
    previousStartLabel: string,
    newStartLabel: string,
    modality: string,
    locationSummary: string,
    meetingId: number,
  ): Promise<boolean> {
    const url = escapeHtml(`${intranetAppUrl()}/reuniones/${meetingId}`);
    const body = `
      <p style="margin:0 0 12px;line-height:1.5;">Hola <strong>${escapeHtml(nombre)}</strong>,</p>
      <p style="margin:0 0 12px;line-height:1.5;">La reunión <strong>${escapeHtml(title)}</strong> fue reprogramada.</p>
      <p style="margin:0 0 8px;line-height:1.5;"><strong>Fecha anterior:</strong> ${escapeHtml(previousStartLabel)}</p>
      <p style="margin:0 0 8px;line-height:1.5;"><strong>Nueva fecha:</strong> ${escapeHtml(newStartLabel)}</p>
      <p style="margin:0 0 8px;line-height:1.5;"><strong>Modalidad:</strong> ${escapeHtml(modality)}</p>
      <p style="margin:0 0 16px;line-height:1.5;"><strong>${modality === 'Remota' ? 'Enlace' : 'Ubicación'}:</strong> ${escapeHtml(locationSummary)}</p>
      <p style="margin:0 0 16px;line-height:1.5;">
        <a href="${url}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Ver reunión</a>
      </p>
    `;
    return this.deliver(
      to,
      `Reprogramada: ${title}`,
      wrapCorporateEmail('Reunión reprogramada', body),
    );
  }

  async sendMeetingCancelled(
    to: string,
    nombre: string,
    title: string,
    startLabel: string,
    reason: string,
    meetingId: number,
  ): Promise<boolean> {
    const url = escapeHtml(`${intranetAppUrl()}/reuniones/${meetingId}`);
    const body = `
      <p style="margin:0 0 12px;line-height:1.5;">Hola <strong>${escapeHtml(nombre)}</strong>,</p>
      <p style="margin:0 0 12px;line-height:1.5;">La reunión <strong>${escapeHtml(title)}</strong> (${escapeHtml(startLabel)}) fue <strong>cancelada</strong>.</p>
      <p style="margin:0 0 16px;line-height:1.5;"><strong>Motivo:</strong> ${escapeHtml(reason)}</p>
      <p style="margin:0 0 16px;line-height:1.5;">
        <a href="${url}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Ver reunión</a>
      </p>
    `;
    return this.deliver(to, `Cancelada: ${title}`, wrapCorporateEmail('Reunión cancelada', body));
  }

  async sendMeetingReminder(
    to: string,
    nombre: string,
    title: string,
    startLabel: string,
    modality: string,
    locationSummary: string,
    hoursLabel: string,
    meetingId: number,
  ): Promise<boolean> {
    const url = escapeHtml(`${intranetAppUrl()}/reuniones/${meetingId}`);
    const body = `
      <p style="margin:0 0 12px;line-height:1.5;">Hola <strong>${escapeHtml(nombre)}</strong>,</p>
      <p style="margin:0 0 12px;line-height:1.5;">Recordatorio: la reunión <strong>${escapeHtml(title)}</strong> comienza en ${escapeHtml(hoursLabel)}.</p>
      <p style="margin:0 0 8px;line-height:1.5;"><strong>Fecha:</strong> ${escapeHtml(startLabel)}</p>
      <p style="margin:0 0 8px;line-height:1.5;"><strong>Modalidad:</strong> ${escapeHtml(modality)}</p>
      <p style="margin:0 0 16px;line-height:1.5;"><strong>${modality === 'Remota' ? 'Enlace' : 'Ubicación'}:</strong> ${escapeHtml(locationSummary)}</p>
      <p style="margin:0 0 16px;line-height:1.5;">
        <a href="${url}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Ver reunión</a>
      </p>
    `;
    return this.deliver(
      to,
      `Recordatorio: ${title}`,
      wrapCorporateEmail('Recordatorio de reunión', body),
    );
  }

  async sendRequestCreatedToRequester(
    to: string,
    nombre: string,
    code: string,
    requestId: number,
  ): Promise<boolean> {
    const url = escapeHtml(`${intranetAppUrl()}/solicitudes/${requestId}`);
    const body = `
      <p style="margin:0 0 12px;line-height:1.5;">Hola <strong>${escapeHtml(nombre)}</strong>,</p>
      <p style="margin:0 0 16px;line-height:1.5;">Tu solicitud <strong>${escapeHtml(code)}</strong> fue enviada correctamente.</p>
      <p style="margin:0 0 16px;line-height:1.5;">
        <a href="${url}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Ver solicitud</a>
      </p>
    `;
    return this.deliver(
      to,
      `Solicitud ${code} enviada`,
      wrapCorporateEmail('Solicitud enviada', body),
    );
  }

  async sendRequestCreatedToLeader(
    to: string,
    nombre: string,
    title: string,
    code: string,
    requestId: number,
  ): Promise<boolean> {
    const url = escapeHtml(`${intranetAppUrl()}/solicitudes/${requestId}?vista=bandeja`);
    const body = `
      <p style="margin:0 0 12px;line-height:1.5;">Hola <strong>${escapeHtml(nombre)}</strong>,</p>
      <p style="margin:0 0 16px;line-height:1.5;">Nueva solicitud recibida: <strong>${escapeHtml(title)}</strong> (${escapeHtml(code)}).</p>
      <p style="margin:0 0 16px;line-height:1.5;">
        <a href="${url}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Ver solicitud</a>
      </p>
    `;
    return this.deliver(
      to,
      `Nueva solicitud ${code}`,
      wrapCorporateEmail('Nueva solicitud interna', body),
    );
  }

  async sendRequestStatusToRequester(
    to: string,
    nombre: string,
    code: string,
    statusMessage: string,
    requestId: number,
  ): Promise<boolean> {
    const url = escapeHtml(`${intranetAppUrl()}/solicitudes/${requestId}`);
    const body = `
      <p style="margin:0 0 12px;line-height:1.5;">Hola <strong>${escapeHtml(nombre)}</strong>,</p>
      <p style="margin:0 0 16px;line-height:1.5;">Tu solicitud <strong>${escapeHtml(code)}</strong> ${escapeHtml(statusMessage)}.</p>
      <p style="margin:0 0 16px;line-height:1.5;">
        <a href="${url}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Ver solicitud</a>
      </p>
    `;
    return this.deliver(
      to,
      `Actualización ${code}`,
      wrapCorporateEmail('Actualización de solicitud', body),
    );
  }

  async sendRequestResolvedToRequester(
    to: string,
    nombre: string,
    code: string,
    requestId: number,
  ): Promise<boolean> {
    const url = escapeHtml(`${intranetAppUrl()}/solicitudes/${requestId}`);
    const body = `
      <p style="margin:0 0 12px;line-height:1.5;">Hola <strong>${escapeHtml(nombre)}</strong>,</p>
      <p style="margin:0 0 12px;line-height:1.5;">Tu solicitud <strong>${escapeHtml(code)}</strong> fue resuelta.</p>
      <p style="margin:0 0 16px;line-height:1.5;">Puedes cerrarla desde tu bandeja cuando estés conforme.</p>
      <p style="margin:0 0 16px;line-height:1.5;">
        <a href="${url}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Ver solicitud</a>
      </p>
    `;
    return this.deliver(
      to,
      `Solicitud ${code} resuelta`,
      wrapCorporateEmail('Solicitud resuelta', body),
    );
  }

  async sendRequestRejectedToRequester(
    to: string,
    nombre: string,
    code: string,
    reason: string,
    requestId: number,
  ): Promise<boolean> {
    const url = escapeHtml(`${intranetAppUrl()}/solicitudes/${requestId}`);
    const body = `
      <p style="margin:0 0 12px;line-height:1.5;">Hola <strong>${escapeHtml(nombre)}</strong>,</p>
      <p style="margin:0 0 12px;line-height:1.5;">Tu solicitud <strong>${escapeHtml(code)}</strong> fue rechazada.</p>
      <p style="margin:0 0 16px;line-height:1.5;"><strong>Motivo:</strong> ${escapeHtml(reason)}</p>
      <p style="margin:0 0 16px;line-height:1.5;">
        <a href="${url}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Ver solicitud</a>
      </p>
    `;
    return this.deliver(
      to,
      `Solicitud ${code} rechazada`,
      wrapCorporateEmail('Solicitud rechazada', body),
    );
  }

  async sendRequestClosedToLeader(
    to: string,
    nombre: string,
    code: string,
    requestId: number,
  ): Promise<boolean> {
    const url = escapeHtml(`${intranetAppUrl()}/solicitudes/${requestId}?vista=bandeja`);
    const body = `
      <p style="margin:0 0 12px;line-height:1.5;">Hola <strong>${escapeHtml(nombre)}</strong>,</p>
      <p style="margin:0 0 16px;line-height:1.5;">La solicitud <strong>${escapeHtml(code)}</strong> fue cerrada por el solicitante.</p>
      <p style="margin:0 0 16px;line-height:1.5;">
        <a href="${url}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Ver solicitud</a>
      </p>
    `;
    return this.deliver(
      to,
      `Solicitud ${code} cerrada`,
      wrapCorporateEmail('Solicitud cerrada', body),
    );
  }

  async sendInventoryLowStockAlert(
    to: string,
    nombre: string,
    count: number,
    itemsListHtml: string,
  ): Promise<boolean> {
    const url = escapeHtml(`${intranetAppUrl()}/ti/inventario`);
    const body = `
      <p style="margin:0 0 12px;line-height:1.5;">Hola <strong>${escapeHtml(nombre)}</strong>,</p>
      <p style="margin:0 0 12px;line-height:1.5;">Hay <strong>${count}</strong> consumible(s) en o por debajo del stock mínimo:</p>
      <ul style="margin:0 0 16px;padding-left:20px;line-height:1.5;">${itemsListHtml}</ul>
      <p style="margin:0 0 16px;line-height:1.5;">
        <a href="${url}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Ver inventario TI</a>
      </p>
    `;
    return this.deliver(
      to,
      `Stock crítico: ${count} consumible(s)`,
      wrapCorporateEmail('Alerta de inventario TI', body),
    );
  }

  async sendGeneric(to: string, subject: string, html: string): Promise<boolean> {
    const body = `
      <div style="line-height:1.5;">
        ${html}
      </div>
    `;
    return this.deliver(to, subject, wrapCorporateEmail(subject, body));
  }
}

export const emailService = new EmailService();

/** Envía correo sin bloquear el flujo principal (errores solo en log). */
export function notifyEmail(task: () => Promise<boolean>, context: string): void {
  void task().then((sent) => {
    if (!sent) {
      console.warn(`[email] Notificación no enviada: ${context}`);
    }
  });
}

export function displayName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}
