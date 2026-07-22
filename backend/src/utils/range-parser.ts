export interface ByteRange {
  start: number;
  end: number;
}

/** Parse HTTP Range header (single range only). */
export function parseRangeHeader(
  rangeHeader: string | undefined,
  totalSize: number,
): ByteRange | null {
  if (!rangeHeader || totalSize <= 0) return null;

  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) return null;

  let start = match[1] ? Number.parseInt(match[1], 10) : NaN;
  let end = match[2] ? Number.parseInt(match[2], 10) : NaN;

  if (Number.isNaN(start) && !Number.isNaN(end)) {
    const suffix = end;
    start = Math.max(0, totalSize - suffix);
    end = totalSize - 1;
  } else if (!Number.isNaN(start) && Number.isNaN(end)) {
    end = totalSize - 1;
  } else if (Number.isNaN(start) || Number.isNaN(end)) {
    return null;
  }

  if (start < 0 || end < start || start >= totalSize) return null;

  end = Math.min(end, totalSize - 1);
  return { start, end };
}
