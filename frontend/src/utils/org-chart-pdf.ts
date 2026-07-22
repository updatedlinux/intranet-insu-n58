import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { OrgChartNode } from '../api/org-chart.types';
import { OrgChartTree } from '../components/org-chart/OrgChartTree';

const PDF_MARGIN_MM = 10;
const PDF_CAPTURE_SCALE = 2;
const PDF_BACKGROUND = '#0b1f4a';

function waitForImages(container: HTMLElement): Promise<void> {
  const images = Array.from(container.querySelectorAll('img'));
  return Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.addEventListener('load', () => resolve(), { once: true });
          img.addEventListener('error', () => resolve(), { once: true });
        }),
    ),
  ).then(() => undefined);
}

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

export async function downloadOrgChartPdf(
  nodes: OrgChartNode[],
  filename = 'organigrama-insular.pdf',
): Promise<void> {
  if (nodes.length === 0) return;

  const host = document.createElement('div');
  host.className = 'org-chart-pdf-export-host org-chart-fit--modal';
  host.setAttribute('aria-hidden', 'true');
  document.body.appendChild(host);

  const root = createRoot(host);

  try {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ]);

    root.render(
      createElement(OrgChartTree, {
        nodes,
        showLegalNotice: true,
        forExport: true,
      }),
    );

    await waitForPaint();
    await waitForImages(host);

    const chart = host.querySelector<HTMLElement>('.org-chart');
    if (!chart) {
      throw new Error('No se pudo preparar el organigrama para exportar');
    }

    const canvas = await html2canvas(chart, {
      scale: PDF_CAPTURE_SCALE,
      useCORS: true,
      backgroundColor: PDF_BACKGROUND,
      logging: false,
    });

    const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait';
    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format: 'a3',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const printableWidth = pageWidth - PDF_MARGIN_MM * 2;
    const printableHeight = pageHeight - PDF_MARGIN_MM * 2;
    const imgWidth = printableWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let positionY = PDF_MARGIN_MM;

    pdf.addImage(
      canvas.toDataURL('image/png'),
      'PNG',
      PDF_MARGIN_MM,
      positionY,
      imgWidth,
      imgHeight,
      undefined,
      'FAST',
    );
    heightLeft -= printableHeight;

    while (heightLeft > 0) {
      pdf.addPage('a3', orientation);
      positionY = PDF_MARGIN_MM - (imgHeight - heightLeft);
      pdf.addImage(
        canvas.toDataURL('image/png'),
        'PNG',
        PDF_MARGIN_MM,
        positionY,
        imgWidth,
        imgHeight,
        undefined,
        'FAST',
      );
      heightLeft -= printableHeight;
    }

    pdf.save(filename);
  } finally {
    root.unmount();
    host.remove();
  }
}
