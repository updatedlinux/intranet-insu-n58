export interface AuthUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: { id: number; name: string };
  area: { id: number; name: string };
  position: { id: number; name: string; isLeader: boolean };
  ledAreaIds: number[];
  ledAreas: { id: number; name: string }[];
  isItSupportAgent: boolean;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  avatarUrl: string | null;
}

export interface LoginResponse {
  user: AuthUser;
  mustChangePassword: boolean;
}

export interface MeResponse {
  user: AuthUser;
}

export interface ApiErrorBody {
  error: { message: string };
}
