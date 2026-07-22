import jQuery from 'jquery';
import 'lightbox2/dist/css/lightbox.min.css';

let initPromise: Promise<void> | null = null;

declare global {
  interface Window {
    jQuery?: typeof jQuery;
    $?: typeof jQuery;
    lightbox?: {
      option: (options: Record<string, unknown>) => void;
    };
  }
}

export function ensureLightbox(): Promise<void> {
  if (!initPromise) {
    window.jQuery = jQuery;
    window.$ = jQuery;

    initPromise = import('lightbox2/dist/js/lightbox.min.js').then(() => {
      window.lightbox?.option({
        resizeDuration: 200,
        wrapAround: true,
        albumLabel: 'Imagen %1 de %2',
        disableScrolling: true,
      });
    });
  }

  return initPromise;
}

export async function openLightboxImage(url: string, title: string): Promise<void> {
  await ensureLightbox();

  const link = document.createElement('a');
  link.href = url;
  link.dataset.lightbox = 'ticket-attachments';
  link.dataset.title = title;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
