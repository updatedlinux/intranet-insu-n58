export const ASSET_CONDITIONS = ['NEW', 'GOOD', 'FAIR', 'POOR'] as const;
export type AssetCondition = (typeof ASSET_CONDITIONS)[number];
