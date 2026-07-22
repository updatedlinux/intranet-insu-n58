/** Áreas cuyos líderes pueden publicar comunicados para toda la empresa (como gerencia general). */
export const CORPORATE_LEADERSHIP_AREA_NAMES = ['Dirección General'] as const;

export function isCorporateLeadershipArea(areaName: string): boolean {
  const normalized = areaName.trim().toLowerCase();
  return CORPORATE_LEADERSHIP_AREA_NAMES.some((n) => n.toLowerCase() === normalized);
}
