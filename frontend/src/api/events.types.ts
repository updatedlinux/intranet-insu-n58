export type CorporateEventStatus = 'DRAFT' | 'PUBLISHED' | 'CANCELLED';

export type CorporateEventListTab = 'upcoming' | 'past';

export interface CorporateEvent {
  id: number;
  title: string;
  description: string | null;
  location: string | null;
  startDateTime: string;
  endDateTime: string;
  isCompanyWide: boolean;
  audienceLabel: string;
  status: CorporateEventStatus;
  statusLabel: string;
  areaIds: number[];
  areaNames: string[];
  createdBy: number;
  creatorName: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CorporateEventFormData {
  title: string;
  description: string | null;
  location: string | null;
  startDateTime: string;
  endDateTime: string;
  isCompanyWide: boolean;
  areaIds: number[];
}

export interface CorporateEventListFilters {
  tab?: CorporateEventListTab;
}

export interface CorporateEventManageFilters {
  status?: CorporateEventStatus;
  search?: string;
}
