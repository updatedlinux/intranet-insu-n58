import { useRef, useState } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import {
  createSeniatJob,
  seniatDownloadUrl,
  seniatTemplateUrl,
  watchSeniatJob,
  type SeniatJobProgress,
} from '../../api/seniat';
import '../../styles/seniat.css';

export function ConsultaSeniatPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [progress, setProgress] = useState<SeniatJobProgress | null>(null);

  function onFileChange() {
    const file = fileRef.current?.files?.[0];
    setFileName(file?.name || '');
    setError('');
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError('Selecciona un archivo Excel.');
      return;
    }

    setBusy(true);
    setModalOpen(true);
    setProgress({
      id: '',
      status: 'queued',
      total: 0,
      processed: 0,
      retryTotal: 0,
      retryProcessed: 0,
      ok: 0,
      fail: 0,
      cacheHits: 0,
      percent: 0,
      currentCedula: '',
      lastResult: null,
      message: 'Subiendo archivo y preparando consulta…',
      error: '',
      filename: '',
    });

    try {
      const job = await createSeniatJob(file);
      setProgress(job);
      const finalJob = await watchSeniatJob(job.id, setProgress);

      const anchor = document.createElement('a');
      anchor.href = seniatDownloadUrl(finalJob.id);
      anchor.download = finalJob.filename || 'cedulas-resultado.xlsx';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setModalOpen(false);
    } catch (err) {
      setModalOpen(false);
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setBusy(false);
    }
  }

  const percent = progress?.percent ?? 0;
  const detail = progress?.lastResult?.nombre
    ? `${progress.lastResult.rif || ''} ${progress.lastResult.nombre}`.trim()
    : progress?.currentCedula
      ? `Cédula actual: ${progress.currentCedula}`
      : progress?.lastResult?.error
        ? `Último error (${progress.lastResult.cedula}): ${progress.lastResult.error}`
        : '';

  return (
    <>
      <PageHeader
        title="Consulta Seniat"
        breadcrumbParent="Inicio"
        breadcrumbCurrent="Consulta Seniat"
      />

      <div className="row">
        <div className="col-12">
          <div className="card-style seniat-card">
            <p className="seniat-lead">
              Sube un Excel con cédulas. El sistema consulta primero la base interna; si no hay
              dato, consulta SENIAT, guarda el resultado y completa RIF, nombres y sexo.
            </p>

            <form className="seniat-form" onSubmit={onSubmit}>
              <label className="seniat-drop">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  required
                  onChange={onFileChange}
                  disabled={busy}
                />
                <span className="seniat-drop__title">Arrastra tu Excel o haz clic</span>
                <span className="seniat-drop__hint">Formato: columna CÉDULA</span>
                {fileName ? <span className="seniat-drop__file">{fileName}</span> : null}
              </label>

              <div className="seniat-actions">
                <a className="admin-btn admin-btn--ghost" href={seniatTemplateUrl()}>
                  Descargar plantilla
                </a>
                <button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>
                  Consultar y descargar
                </button>
              </div>
            </form>

            {error ? <p className="seniat-error">{error}</p> : null}

            <p className="seniat-help">
              Descarga la plantilla, completa la columna <strong>CÉDULA</strong> y súbela aquí. Las
              consultas exitosas quedan en caché para no repetir SENIAT.
            </p>
          </div>
        </div>
      </div>

      {modalOpen ? (
        <div
          className="seniat-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="seniat-modal-title"
        >
          <div className="seniat-modal__backdrop" />
          <div className="seniat-modal__dialog">
            <div className="seniat-modal__spinner" aria-hidden="true" />
            <h2 id="seniat-modal-title">Consultando SENIAT</h2>
            <p className="seniat-modal__desc">
              Por favor espera y <strong>no cierres ni recargues</strong> esta ventana. Si el dato
              ya está en caché, será inmediato; si no, puede demorar por el portal SENIAT.
            </p>
            <div className="seniat-progress">
              <div className="seniat-progress__meta">
                <span>{progress?.message || 'Consultando…'}</span>
                <span>{percent}%</span>
              </div>
              <div className="seniat-progress__track">
                <div className="seniat-progress__fill" style={{ width: `${percent}%` }} />
              </div>
              <div className="seniat-progress__stats">
                <span>
                  {progress?.processed || 0} / {progress?.total || 0}
                </span>
                <span>OK: {progress?.ok || 0}</span>
                <span>Error: {progress?.fail || 0}</span>
                <span>Caché: {progress?.cacheHits || 0}</span>
              </div>
              {detail ? <p className="seniat-progress__detail">{detail}</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
