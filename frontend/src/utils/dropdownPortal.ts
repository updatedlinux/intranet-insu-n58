import type { CSSProperties } from 'react';

export const DROPDOWN_PORTAL_Z_INDEX = 5000;

export function computeFixedDropdownStyle(
  anchor: HTMLElement,
  panelMaxHeight = 220,
): CSSProperties {
  const rect = anchor.getBoundingClientRect();
  const gap = 4;
  const spaceBelow = window.innerHeight - rect.bottom - gap;
  const spaceAbove = rect.top - gap;
  const openUp = spaceBelow < Math.min(panelMaxHeight, 140) && spaceAbove > spaceBelow;
  const maxHeight = Math.min(panelMaxHeight, Math.max(100, openUp ? spaceAbove : spaceBelow));

  const base: CSSProperties = {
    position: 'fixed',
    left: rect.left,
    width: rect.width,
    zIndex: DROPDOWN_PORTAL_Z_INDEX,
    maxHeight,
    overflowY: 'auto',
  };

  if (openUp) {
    return {
      ...base,
      bottom: window.innerHeight - rect.top + gap,
      top: 'auto',
    };
  }

  return {
    ...base,
    top: rect.bottom + gap,
    bottom: 'auto',
  };
}
