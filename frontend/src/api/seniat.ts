const API_BASE = import.meta.env.VITE_API_URL ?? '/api/v1';

export interface SeniatJobProgress {
  id: string;
  status: 'queued' | 'running' | 'done' | 'error';
  total: number;
  processed: number;
  retryTotal: number;
  retryProcessed: number;
  ok: number;
  fail: number;
  cacheHits?: number;
  percent: number;
  currentCedula: string;
  lastResult: {
    cedula?: string;
    rif?: string;
    nombre?: string;
    sexo?: string;
    error?: string;
    fromCache?: boolean;
  } | null;
  message: string;
  error: string;
  filename: string;
}

export async function createSeniatJob(file: File): Promise<SeniatJobProgress> {
  const body = new FormData();
  body.append('file', file);

  const response = await fetch(`${API_BASE}/seniat/jobs`, {
    method: 'POST',
    body,
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || data?.error || 'No se pudo iniciar la consulta');
  }
  return data as SeniatJobProgress;
}

export function watchSeniatJob(
  jobId: string,
  onProgress: (data: SeniatJobProgress) => void,
): Promise<SeniatJobProgress> {
  return new Promise((resolve, reject) => {
    const source = new EventSource(`${API_BASE}/seniat/jobs/${jobId}/events`, {
      withCredentials: true,
    });

    source.onmessage = (event) => {
      let data: SeniatJobProgress;
      try {
        data = JSON.parse(event.data) as SeniatJobProgress;
      } catch {
        return;
      }
      onProgress(data);
      if (data.status === 'done') {
        source.close();
        resolve(data);
      }
      if (data.status === 'error') {
        source.close();
        reject(new Error(data.error || 'La consulta falló'));
      }
    };

    source.onerror = () => {
      fetch(`${API_BASE}/seniat/jobs/${jobId}`, { credentials: 'include' })
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((data: SeniatJobProgress) => {
          onProgress(data);
          if (data.status === 'done') {
            source.close();
            resolve(data);
          } else if (data.status === 'error') {
            source.close();
            reject(new Error(data.error || 'La consulta falló'));
          }
        })
        .catch(() => {
          /* keep listening */
        });
    };
  });
}

export function seniatTemplateUrl(): string {
  return `${API_BASE}/seniat/plantilla`;
}

export function seniatDownloadUrl(jobId: string): string {
  return `${API_BASE}/seniat/jobs/${jobId}/download`;
}
