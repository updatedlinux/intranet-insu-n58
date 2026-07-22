export const STOCK_MOVEMENT_TYPES = ['IN', 'OUT', 'ADJUSTMENT'] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];
