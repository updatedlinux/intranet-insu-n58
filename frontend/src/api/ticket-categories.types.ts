export interface TicketCategory {
  id: number;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  ticketCount: number;
}

export interface TicketCategoryFormData {
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
}
