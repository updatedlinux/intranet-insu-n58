export type TicketAttachmentPreviewKind = 'image' | 'pdf' | 'word' | 'unsupported';

export function getTicketAttachmentPreviewKind(
  mimeType: string,
  fileName: string,
): TicketAttachmentPreviewKind {
  const mime = mimeType.toLowerCase();

  if (mime.startsWith('image/') || /\.(jpe?g|png|gif|webp|svg|bmp)$/i.test(fileName)) {
    return 'image';
  }

  if (mime === 'application/pdf' || /\.pdf$/i.test(fileName)) {
    return 'pdf';
  }

  if (
    mime.includes('word') ||
    mime === 'application/msword' ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    /\.docx?$/i.test(fileName)
  ) {
    return 'word';
  }

  return 'unsupported';
}

export function canPreviewTicketAttachment(kind: TicketAttachmentPreviewKind): boolean {
  return kind !== 'unsupported';
}

export function isLegacyWordDocument(fileName: string): boolean {
  return /\.doc$/i.test(fileName) && !/\.docx$/i.test(fileName);
}
