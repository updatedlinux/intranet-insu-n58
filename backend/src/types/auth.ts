export interface PublicUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: {
    id: number;
    name: string;
  };
  area: {
    id: number;
    name: string;
  };
  position: {
    id: number;
    name: string;
    isLeader: boolean;
  };
  /** Áreas que el usuario lidera (asignación explícita, independiente del cargo). */
  ledAreaIds: number[];
  ledAreas: { id: number; name: string }[];
  isItSupportAgent: boolean;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  avatarUrl: string | null;
}

export interface AuthenticatedUser extends PublicUser {
  roleName: string;
}

export interface AccessTokenPayload {
  sub: number;
  email: string;
  role: string;
  jti: string;
}

export interface LoginResult {
  user: PublicUser;
  mustChangePassword: boolean;
}
