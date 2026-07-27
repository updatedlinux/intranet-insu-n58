import type { NextFunction, Request, Response } from 'express';
import {
  buildTemplateExcel,
  readCedulasFromExcel,
} from '../services/seniat/excel';
import {
  createSeniatJob,
  getSeniatJob,
  subscribeSeniatJob,
} from '../services/seniat/seniat-jobs.service';
import type { AppError } from '../middlewares/error.middleware';

function badRequest(message: string): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = 400;
  return error;
}

export async function createSeniatJobHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const file = req.file;
    if (!file?.buffer) {
      throw badRequest('Debes subir un archivo Excel con las cédulas.');
    }

    const rows = await readCedulasFromExcel(file.buffer);
    if (!rows.length) {
      throw badRequest('No se encontraron cédulas en el archivo.');
    }

    const job = createSeniatJob(rows.map((r) => ({ cedula: r.cedula })));
    res.status(202).json(job);
  } catch (error) {
    next(error);
  }
}

export async function getSeniatJobHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const job = getSeniatJob(String(req.params.id));
    if (!job) {
      const error = new Error('Trabajo no encontrado o expirado') as AppError;
      error.statusCode = 404;
      throw error;
    }
    res.json({
      id: job.id,
      status: job.status,
      total: job.total,
      processed: job.processed,
      retryTotal: job.retryTotal,
      retryProcessed: job.retryProcessed,
      ok: job.ok,
      fail: job.fail,
      cacheHits: job.cacheHits,
      percent:
        job.total + job.retryTotal > 0
          ? Math.round(((job.processed + job.retryProcessed) / (job.total + job.retryTotal)) * 100)
          : 0,
      currentCedula: job.currentCedula,
      lastResult: job.lastResult,
      message: job.message,
      error: job.error,
      filename: job.filename,
    });
  } catch (error) {
    next(error);
  }
}

export async function streamSeniatJobEvents(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const job = getSeniatJob(String(req.params.id));
    if (!job) {
      const error = new Error('Trabajo no encontrado o expirado') as AppError;
      error.statusCode = 404;
      throw error;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const send = (data: unknown) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const unsubscribe = subscribeSeniatJob(job, send);
    const heartbeat = setInterval(() => {
      res.write(': ping\n\n');
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  } catch (error) {
    next(error);
  }
}

export async function downloadSeniatJobHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const job = getSeniatJob(String(req.params.id));
    if (!job) {
      const error = new Error('Trabajo no encontrado o expirado') as AppError;
      error.statusCode = 404;
      throw error;
    }
    if (job.status !== 'done' || !job.resultBuffer) {
      const error = new Error('El resultado aún no está listo') as AppError;
      error.statusCode = 409;
      throw error;
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${job.filename || 'cedulas-resultado.xlsx'}"`,
    );
    res.send(job.resultBuffer);
  } catch (error) {
    next(error);
  }
}

export async function downloadSeniatTemplateHandler(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const excelBuffer = await buildTemplateExcel();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="plantilla-cedulas-insular.xlsx"',
    );
    res.send(excelBuffer);
  } catch (error) {
    next(error);
  }
}
