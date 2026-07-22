/** Genera un PDF mínimo de una página con texto (Helvetica). */
export function buildSimpleTextPdf(lines: string[]): Buffer {
  const escaped = lines.map((l) =>
    l.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'),
  );

  let y = 750;
  const textOps = escaped
    .map((line) => {
      const op = `BT /F1 14 Tf 50 ${y} Td (${line}) Tj ET`;
      y -= 22;
      return op;
    })
    .join('\n');

  const stream = `${textOps}\n`;
  const streamLen = Buffer.byteLength(stream, 'utf8');

  const parts = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n',
    `4 0 obj << /Length ${streamLen} >> stream\n${stream}endstream\nendobj\n`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n',
  ];

  const offs: number[] = [0];
  let pdf = '%PDF-1.4\n';
  for (const part of parts) {
    offs.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += part;
  }

  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${offs.length}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offs.length; i++) {
    pdf += `${String(offs[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer << /Size ${offs.length} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, 'utf8');
}
