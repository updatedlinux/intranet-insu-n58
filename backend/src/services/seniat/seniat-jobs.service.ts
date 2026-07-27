import { randomUUID } from 'node:crypto';
import { buildResultExcel } from './excel';
import { resolveCedula, type CedulaRecord } from './seniat-lookup.service';

const DELAY_BETWEEN_QUERIES_MS = Number(process.env.SENIAT_QUERY_DELAY_MS || 800);
const JOB_TTL_MS = 30 * 60 * 1000;

export type SeniatJobStatus = 'queued' | 'running' | 'done' | 'error';

export interface SeniatJobSnapshot {
  id: string;
  status: SeniatJobStatus;
  total: number;
  processed: number;
  retryTotal: number;
  retryProcessed: number;
  ok: number;
  fail: number;
  cacheHits: number;
  percent: number;
  currentCedula: string;
  lastResult: Partial<CedulaRecord> | null;
  message: string;
  error: string;
  filename: string;
}

interface SeniatJob extends SeniatJobSnapshot {
  resultBuffer: Buffer | null;
  listeners: Set<(data: SeniatJobSnapshot) => void>;
  rows: Array<{ cedula: string }>;
  createdAt: number;
}

const jobs = new Map<string, SeniatJob>();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toSnapshot(job: SeniatJob): SeniatJobSnapshot {
  const overallTotal = job.total + job.retryTotal;
  const overallProcessed = job.processed + job.retryProcessed;
  const percent = overallTotal > 0 ? Math.round((overallProcessed / overallTotal) * 100) : 0;

  return {
    id: job.id,
    status: job.status,
    total: job.total,
    processed: job.processed,
    retryTotal: job.retryTotal,
    retryProcessed: job.retryProcessed,
    ok: job.ok,
    fail: job.fail,
    cacheHits: job.cacheHits,
    percent,
    currentCedula: job.currentCedula,
    lastResult: job.lastResult,
    message: job.message,
    error: job.error,
    filename: job.filename,
  };
}

function emit(job: SeniatJob) {
  const data = toSnapshot(job);
  for (const listener of job.listeners) {
    try {
      listener(data);
    } catch {
      /* ignore */
    }
  }
}

export function getSeniatJob(id: string): SeniatJob | null {
  return jobs.get(id) || null;
}

export function subscribeSeniatJob(
  job: SeniatJob,
  listener: (data: SeniatJobSnapshot) => void,
): () => void {
  job.listeners.add(listener);
  listener(toSnapshot(job));
  return () => job.listeners.delete(listener);
}

export function createSeniatJob(rows: Array<{ cedula: string }>): SeniatJobSnapshot {
  const id = randomUUID();
  const job: SeniatJob = {
    id,
    status: 'queued',
    total: rows.length,
    processed: 0,
    retryTotal: 0,
    retryProcessed: 0,
    ok: 0,
    fail: 0,
    cacheHits: 0,
    percent: 0,
    currentCedula: '',
    lastResult: null,
    message: 'Preparando consulta…',
    error: '',
    filename: '',
    resultBuffer: null,
    listeners: new Set(),
    createdAt: Date.now(),
    rows,
  };

  jobs.set(id, job);
  setImmediate(() => {
    runJob(job).catch((err: Error) => {
      job.status = 'error';
      job.error = err.message || 'Error inesperado';
      job.message = job.error;
      emit(job);
    });
  });

  return toSnapshot(job);
}

async function runJob(job: SeniatJob) {
  job.status = 'running';
  job.message = 'Consultando… no cierres esta ventana.';
  emit(job);

  const results: CedulaRecord[] = [];

  for (let i = 0; i < job.rows.length; i++) {
    const { cedula } = job.rows[i];
    job.currentCedula = cedula;
    job.message = `Consultando cédula ${cedula} (${i + 1} de ${job.total})…`;
    emit(job);

    const item = await resolveCedula(cedula);
    if (item.fromCache) job.cacheHits += 1;
    if (item.rif) job.ok += 1;
    else job.fail += 1;

    results.push(item);
    job.processed = i + 1;
    job.lastResult = item;
    emit(job);

    // Solo pausar si salimos a SENIAT (no cache)
    if (!item.fromCache && i < job.rows.length - 1) {
      await sleep(DELAY_BETWEEN_QUERIES_MS);
    }
  }

  const failedIndexes = results
    .map((item, index) => (item.rif ? -1 : index))
    .filter((index) => index >= 0);

  if (failedIndexes.length > 0) {
    job.retryTotal = failedIndexes.length;
    job.retryProcessed = 0;
    job.message = `Reintentando ${failedIndexes.length} cédula(s) con error…`;
    emit(job);

    for (let r = 0; r < failedIndexes.length; r++) {
      const index = failedIndexes[r];
      const cedula = results[index].cedula;
      job.currentCedula = cedula;
      job.message = `Reintento ${r + 1} de ${failedIndexes.length}: cédula ${cedula}…`;
      emit(job);

      await sleep(DELAY_BETWEEN_QUERIES_MS);
      const retried = await resolveCedula(cedula);

      if (retried.rif) {
        if (retried.fromCache) job.cacheHits += 1;
        results[index] = retried;
        job.ok += 1;
        job.fail = Math.max(0, job.fail - 1);
      } else {
        results[index] = retried;
      }

      job.retryProcessed = r + 1;
      job.lastResult = retried;
      emit(job);
    }
  }

  job.message = 'Generando Excel de resultados…';
  job.currentCedula = '';
  emit(job);

  job.resultBuffer = await buildResultExcel(results);
  job.filename = `cedulas-resultado-${Date.now()}.xlsx`;
  job.status = 'done';
  job.message = 'Consulta finalizada.';
  job.processed = job.total;
  job.retryProcessed = job.retryTotal;
  emit(job);

  setTimeout(() => {
    jobs.delete(job.id);
  }, JOB_TTL_MS);
}
