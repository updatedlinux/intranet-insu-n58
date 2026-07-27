import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import sharp from 'sharp';
import { inferGender } from './gender';

const COLORS = {
  navy: 'FF002B4E',
  navyMuted: 'FF1E5A8A',
  white: 'FFFFFFFF',
  outline: 'FFE2E8F0',
  cedulaBg: 'FFE8F1F8',
  rifBg: 'FFFFFFFF',
  sexoFemenino: 'FFFCE7F3',
  sexoMasculino: 'FFE0F2FE',
  sexoEmpty: 'FFF8FAFC',
  error: 'FFFEE4E2',
  text: 'FF0F172A',
  muted: 'FF475569',
} as const;

const LOGO_SVG_PATH = path.join(__dirname, '..', '..', '..', 'assets', 'favicon.svg');
const HEADER_ROW = 5;
const DATA_START_ROW = 6;

let logoPngCache: Buffer | null = null;

async function getLogoPng(): Promise<Buffer> {
  if (logoPngCache) return logoPngCache;
  const svg = fs.readFileSync(LOGO_SVG_PATH);
  logoPngCache = await sharp(svg).resize(160, 160).png().toBuffer();
  return logoPngCache;
}

function cellText(cell: ExcelJS.Cell | { value?: unknown }): string {
  const value = 'value' in cell ? cell.value : undefined;
  if (value == null) return '';
  if (typeof value === 'object') {
    const obj = value as {
      text?: string;
      result?: unknown;
      richText?: Array<{ text: string }>;
    };
    if (obj.text) return String(obj.text);
    if (obj.result != null) return String(obj.result);
    if (Array.isArray(obj.richText)) return obj.richText.map((t) => t.text).join('');
  }
  return String(value);
}

function normalizeHeader(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function applyHeaderStyle(cell: ExcelJS.Cell): void {
  cell.font = { bold: true, color: { argb: COLORS.white }, name: 'Calibri', size: 11 };
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: COLORS.navy },
  };
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  cell.border = {
    top: { style: 'thin', color: { argb: COLORS.navy } },
    left: { style: 'thin', color: { argb: COLORS.navy } },
    bottom: { style: 'thin', color: { argb: COLORS.navy } },
    right: { style: 'thin', color: { argb: COLORS.navy } },
  };
}

function thinBorder(color = COLORS.outline) {
  const edge: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: color } };
  return { top: edge, left: edge, bottom: edge, right: edge };
}

async function addBrandHeader(
  workbook: ExcelJS.Workbook,
  sheet: ExcelJS.Worksheet,
  { title, subtitle }: { title: string; subtitle: string },
): Promise<void> {
  const logo = await getLogoPng();
  const imageId = workbook.addImage({
    buffer: Buffer.from(logo) as unknown as ExcelJS.Buffer,
    extension: 'png',
  });

  sheet.addImage(imageId, {
    tl: { col: 0.15, row: 0.15 },
    ext: { width: 48, height: 48 },
  });

  sheet.getCell('F1').value = title;
  sheet.getCell('F1').font = {
    bold: true,
    name: 'Calibri',
    size: 16,
    color: { argb: COLORS.navy },
  };
  sheet.getCell('F1').alignment = { vertical: 'middle', horizontal: 'left' };

  sheet.getCell('F2').value = subtitle;
  sheet.getCell('F2').font = {
    name: 'Calibri',
    size: 10,
    color: { argb: COLORS.muted },
  };

  sheet.getCell('F3').value = 'Insular Cambios';
  sheet.getCell('F3').font = {
    bold: true,
    name: 'Calibri',
    size: 10,
    color: { argb: COLORS.navyMuted },
  };

  sheet.getRow(1).height = 26;
  sheet.getRow(2).height = 16;
  sheet.getRow(3).height = 16;
  sheet.getRow(4).height = 8;
  sheet.getRow(HEADER_ROW).height = 24;

  sheet.getColumn(1).width = 8;
  sheet.getColumn(2).width = 14;
  sheet.getColumn(3).width = 14;
  sheet.getColumn(4).width = 48;
  sheet.getColumn(5).width = 14;
  sheet.getColumn(6).width = 42;
}

function writeColumnHeaders(sheet: ExcelJS.Worksheet): void {
  const headers = [
    { col: 2, label: 'CÉDULA' },
    { col: 3, label: 'RIF' },
    { col: 4, label: 'NOMBRES Y APELLIDOS' },
    { col: 5, label: 'SEXO' },
  ];

  for (const { col, label } of headers) {
    const cell = sheet.getCell(HEADER_ROW, col);
    cell.value = label;
    applyHeaderStyle(cell);
  }
}

function styleDataRow(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  { sexo, hasError }: { sexo: string; hasError: boolean },
): void {
  const cedulaCell = sheet.getCell(rowNumber, 2);
  const rifCell = sheet.getCell(rowNumber, 3);
  const nombreCell = sheet.getCell(rowNumber, 4);
  const sexoCell = sheet.getCell(rowNumber, 5);

  cedulaCell.font = { name: 'Calibri', size: 11, color: { argb: COLORS.navy } };
  cedulaCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: COLORS.cedulaBg },
  };
  cedulaCell.alignment = { vertical: 'middle', horizontal: 'center' };
  cedulaCell.border = thinBorder();
  cedulaCell.numFmt = '0';

  rifCell.font = {
    name: 'Calibri',
    size: 11,
    bold: true,
    color: { argb: COLORS.navyMuted },
  };
  rifCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: hasError ? COLORS.error : 'FFEEF6FB' },
  };
  rifCell.alignment = { vertical: 'middle', horizontal: 'center' };
  rifCell.border = thinBorder();

  nombreCell.font = {
    name: 'Calibri',
    size: 11,
    color: { argb: hasError ? 'FFB42318' : COLORS.text },
  };
  nombreCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: hasError ? COLORS.error : COLORS.rifBg },
  };
  nombreCell.alignment = { vertical: 'middle', horizontal: 'left' };
  nombreCell.border = thinBorder();

  const sexoUpper = String(sexo || '').toUpperCase();
  let sexoBg: string = COLORS.sexoEmpty;
  if (sexoUpper === 'FEMENINO') sexoBg = COLORS.sexoFemenino;
  if (sexoUpper === 'MASCULINO') sexoBg = COLORS.sexoMasculino;

  sexoCell.font = {
    bold: true,
    name: 'Calibri',
    size: 10,
    color: { argb: COLORS.navy },
  };
  sexoCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: sexoBg },
  };
  sexoCell.alignment = { vertical: 'middle', horizontal: 'center' };
  sexoCell.border = thinBorder();

  sheet.getRow(rowNumber).height = 20;
}

export async function readCedulasFromExcel(
  input: Buffer | string,
): Promise<Array<{ rowNumber: number; cedula: string }>> {
  const workbook = new ExcelJS.Workbook();
  if (Buffer.isBuffer(input)) {
    await workbook.xlsx.load(input as unknown as ExcelJS.Buffer);
  } else {
    await workbook.xlsx.readFile(input);
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  let headerRow = 1;
  let cedulaCol = 1;
  let foundHeader = false;

  sheet.eachRow((row, rowNumber) => {
    const rawValues = Array.isArray(row.values) ? row.values : [];
    const values = Array.from(rawValues, (v) => {
      if (v == null) return '';
      if (typeof v === 'object') return normalizeHeader(cellText({ value: v }));
      return normalizeHeader(v);
    });

    const cedulaIdx = values.findIndex(
      (v) => v === 'CEDULA' || (v.startsWith('CEDULA') && v.length <= 20),
    );
    const rifIdx = values.findIndex(
      (v) =>
        v === 'RIF' || v === 'RIF NOMBRES Y APELLIDOS' || (v.includes('RIF') && v.length <= 40),
    );
    const sexoIdx = values.findIndex((v) => v === 'SEXO');

    if (cedulaIdx > 0 && (rifIdx > 0 || sexoIdx > 0)) {
      headerRow = rowNumber;
      cedulaCol = cedulaIdx;
      foundHeader = true;
    }
  });

  if (!foundHeader) {
    const b2 = normalizeHeader(cellText(sheet.getCell('B2')));
    if (b2.includes('CEDULA')) {
      headerRow = 2;
      cedulaCol = 2;
    }
  }

  const rows: Array<{ rowNumber: number; cedula: string }> = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRow) return;
    const cedula = cellText(row.getCell(cedulaCol)).replace(/\D/g, '').trim();
    if (!cedula) return;
    rows.push({ rowNumber, cedula });
  });

  return rows;
}

export async function buildTemplateExcel(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Insular Cambios';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('CEDULAS', {
    views: [{ state: 'frozen', ySplit: HEADER_ROW }],
  });

  await addBrandHeader(workbook, sheet, {
    title: 'Plantilla de cédulas',
    subtitle: 'Pega las cédulas en la columna CÉDULA (una por fila).',
  });

  writeColumnHeaders(sheet);

  const READY_ROWS = 300;
  for (let i = 0; i < READY_ROWS; i++) {
    const row = DATA_START_ROW + i;
    sheet.getCell(row, 2).value = null;
    sheet.getCell(row, 3).value = null;
    sheet.getCell(row, 4).value = null;
    sheet.getCell(row, 5).value = null;
    styleDataRow(sheet, row, { sexo: '', hasError: false });
    sheet.getCell(row, 2).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.white },
    };
  }

  const help = workbook.addWorksheet('INSTRUCCIONES');
  help.getColumn(1).width = 80;
  help.getCell('A1').value = 'Cómo usar esta plantilla';
  help.getCell('A1').font = { bold: true, size: 14, color: { argb: COLORS.navy }, name: 'Calibri' };
  help.getCell('A3').value = '1. Ve a la hoja CEDULAS.';
  help.getCell('A4').value = '2. Selecciona la celda B6 (primera fila bajo el encabezado CÉDULA).';
  help.getCell('A5').value = '3. Pega tu lista de cédulas (una por fila, solo números).';
  help.getCell('A6').value =
    '4. No llenes RIF, NOMBRES ni SEXO: el sistema los completa al consultar.';
  help.getCell('A7').value = '5. Guarda el archivo y súbelo en Consulta SENIAT.';
  help.getCell('A9').value = 'Tip: no pegues sobre el encabezado (fila 5). Empieza siempre en B6.';
  help.getCell('A9').font = { italic: true, color: { argb: COLORS.muted }, name: 'Calibri' };

  for (const r of [3, 4, 5, 6, 7, 9]) {
    help.getCell(`A${r}`).font = {
      name: 'Calibri',
      size: 11,
      color: { argb: COLORS.text },
    };
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

export async function buildResultExcel(
  records: Array<{
    cedula: string;
    rif?: string;
    nombre?: string;
    sexo?: string;
    error?: string;
  }>,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Insular Cambios';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('CEDULAS', {
    views: [{ state: 'frozen', ySplit: HEADER_ROW }],
  });

  await addBrandHeader(workbook, sheet, {
    title: 'Consulta SENIAT — Resultados',
    subtitle: `Generado el ${new Date().toLocaleString('es-VE')} · ${records.length} registro(s)`,
  });

  writeColumnHeaders(sheet);

  records.forEach((record, index) => {
    const row = DATA_START_ROW + index;
    const rif = record.rif || '';
    const nombre = record.nombre || '';
    const sexo = record.sexo || (nombre ? inferGender(nombre) : '');
    const hasError = Boolean(record.error) && !rif;

    sheet.getCell(row, 2).value = Number(record.cedula) || record.cedula;
    sheet.getCell(row, 3).value = rif;
    sheet.getCell(row, 4).value = nombre || (hasError ? `ERROR: ${record.error}` : '');
    sheet.getCell(row, 5).value = sexo;

    styleDataRow(sheet, row, { sexo, hasError });
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
