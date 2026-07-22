export const REQUEST_PRIORITIES = ['Low', 'Medium', 'High'] as const;

export type RequestPriority = (typeof REQUEST_PRIORITIES)[number];
