import { apiRequest } from './client';
import type { LoginResponse, MeResponse } from './types';

export function loginRequest(email: string, password: string) {
  return apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function meRequest() {
  return apiRequest<MeResponse>('/auth/me');
}

export function profileRequest() {
  return apiRequest<MeResponse>('/auth/profile');
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ChangePasswordResponse {
  user: MeResponse['user'];
  message: string;
}

export function changePasswordRequest(payload: ChangePasswordPayload) {
  return apiRequest<ChangePasswordResponse>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function logoutRequest() {
  return apiRequest<void>('/auth/logout', { method: 'POST' });
}

export function forgotPasswordRequest(email: string) {
  return apiRequest<{ message: string }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export interface ResetPasswordPayload {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

export function resetPasswordRequest(payload: ResetPasswordPayload) {
  return apiRequest<{ message: string }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
