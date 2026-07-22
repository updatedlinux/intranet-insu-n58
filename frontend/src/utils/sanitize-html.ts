import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
  'p',
  'h2',
  'h3',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'ul',
  'ol',
  'li',
  'a',
  'hr',
  'br',
  'span',
];

const ALLOWED_ATTR = ['href', 'target', 'rel', 'style'];

DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
  if (data.attrName === 'style' && node instanceof Element) {
    const align = data.attrValue.match(/text-align:\s*(left|center|right|justify)/i);
    data.attrValue = align ? `text-align: ${align[1]!.toLowerCase()}` : '';
  }
});

export function sanitizeAnnouncementHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  });
}

/** Indica si el HTML del editor tiene contenido visible. */
export function hasMeaningfulHtml(html: string): boolean {
  const text = DOMPurify.sanitize(html, { ALLOWED_TAGS: [] }).trim();
  return text.length > 0;
}
