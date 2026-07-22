import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { ApiError } from '../../api/client';
import { uploadLearningLessons } from '../../api/learning';

interface Props {
  moduleId: number;
  onUploaded: () => void;
}

export function ModuleLessonDropzone({ moduleId, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const handleFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    setUploading(true);
    setError('');
    setProgress(0);
    try {
      await uploadLearningLessons(moduleId, list, setProgress);
      onUploaded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al subir');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div
      className={`learning-dropzone ${dragging ? 'learning-dropzone--active' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void handleFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="d-none"
        accept="video/*,application/pdf,image/*,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
        onChange={(e) => {
          if (e.target.files) void handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <Upload className="mb-2 text-primary" size={28} />
      <p className="mb-0 fw-semibold">Arrastre archivos o haga clic para subir</p>
      <p className="small text-muted mb-0">Video, PDF, imagen o documento · varios a la vez</p>
      {uploading ? (
        <div className="mt-2">
          <div className="progress">
            <div className="progress-bar" style={{ width: `${progress}%` }} />
          </div>
          <span className="small">{progress}%</span>
        </div>
      ) : null}
      {error ? <p className="text-danger small mt-2 mb-0">{error}</p> : null}
    </div>
  );
}
