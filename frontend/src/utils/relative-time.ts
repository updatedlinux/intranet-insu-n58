const UNITS: { limit: number; divisor: number; word: string }[] = [
  { limit: 60, divisor: 1, word: 'segundo' },
  { limit: 3600, divisor: 60, word: 'minuto' },
  { limit: 86400, divisor: 3600, word: 'hora' },
  { limit: 604800, divisor: 86400, word: 'día' },
  { limit: 2592000, divisor: 604800, word: 'semana' },
  { limit: 31536000, divisor: 2592000, word: 'mes' },
  { limit: Infinity, divisor: 31536000, word: 'año' },
];

export function formatRelativeTime(isoDate: string, now = Date.now()): string {
  const then = new Date(isoDate).getTime();
  if (Number.isNaN(then)) return '';

  const seconds = Math.max(0, Math.floor((now - then) / 1000));
  if (seconds < 10) return 'ahora mismo';

  for (const unit of UNITS) {
    if (seconds < unit.limit) {
      const value = Math.max(1, Math.floor(seconds / unit.divisor));
      const label = value === 1 ? unit.word : `${unit.word}s`;
      return `hace ${value} ${label}`;
    }
  }

  return 'hace un momento';
}

export function formatDateTime(isoDate: string | null | undefined): string {
  if (!isoDate) return '—';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es-PA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
