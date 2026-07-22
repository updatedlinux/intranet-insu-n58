export const MAINTENANCE_TYPES = ['PREVENTIVE', 'CORRECTIVE', 'UPGRADE'] as const;
export type MaintenanceType = (typeof MAINTENANCE_TYPES)[number];
