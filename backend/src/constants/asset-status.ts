export const ASSET_STATUSES = ['ACTIVE', 'IN_MAINTENANCE', 'RETIRED', 'LOST', 'STOLEN'] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];
