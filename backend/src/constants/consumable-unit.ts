export const CONSUMABLE_UNITS = ['UNIT', 'BOX', 'PACK', 'ROLL'] as const;
export type ConsumableUnit = (typeof CONSUMABLE_UNITS)[number];
